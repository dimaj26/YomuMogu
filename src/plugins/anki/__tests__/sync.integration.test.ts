// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
import { ankiClient } from '../client';
import { POST as syncDbPost } from '@/app/api/anki/sync-db/route';
import { NextRequest } from 'next/server';
import { calculateNextFsrsState } from '@/core/scheduler';


// Настройка полифилла IndexedDB для Dexie в окружении Node/JSDOM ДО импорта Dexie
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Перехватываем fetch для перенаправления запросов к /api/anki/sync-db в обработчик роута Next.js
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  if (url.includes('/api/anki/sync-db')) {
    const req = new NextRequest('http://localhost' + url, {
      method: init?.method || 'POST',
      headers: init?.headers as any,
      body: init?.body,
    });
    return syncDbPost(req);
  }
  return originalFetch(input, init);
};

// Проверяем связь с Anki на верхнем уровне (top-level await), чтобы правильно зарегистрировать тесты в Vitest
const ankiConnected = await ankiClient.checkConnection();

describe.runIf(ankiConnected)('Anki Bilateral Sync Real Integration Test', () => {
  const testDeckName = 'Test YomuMogu';
  const profileId = 'integration-test-profile';

  // Динамические импорты для гарантированного порядка загрузки после полифиллов
  let db: any;
  let syncLocalDatabaseWithAnki: (profileId: string, deckName: string) => Promise<{ success: boolean; message: string }>;
  let getLocalWords: (profileId: string, deckName: string) => Promise<import('@/core/db').LocalWord[]>;
  let addLocalReview: (review: any) => Promise<void>;
  let getUnsyncedReviews: (profileId: string) => Promise<any[]>;
  let setProfileItem: (key: string, value: string, profileId?: string) => void;

  beforeAll(async () => {
    // Импортируем модули динамически, когда indexedDB уже есть в globalThis
    const dbModule = await import('@/core/db');
    db = dbModule.db;
    syncLocalDatabaseWithAnki = dbModule.syncLocalDatabaseWithAnki;
    getLocalWords = dbModule.getLocalWords;
    addLocalReview = dbModule.addLocalReview;
    getUnsyncedReviews = dbModule.getUnsyncedReviews;

    const profileModule = await import('@/lib/profile');
    setProfileItem = profileModule.setProfileItem;

    console.log('--- Начат интеграционный тест синхронизации с реальным Anki ---');

    // Настраиваем поля профиля в localStorage для JSDOM
    setProfileItem('front_field', 'Front', profileId);
    setProfileItem('back_field', 'Back', profileId);

    // Очищаем локальные таблицы Dexie перед стартом
    await db.words.clear();
    await db.reviews.clear();

    // Очищаем старые тестовые колоды, если они остались от прошлых упавших тестов
    try {
      const decks = await ankiClient.getDeckNames();
      if (decks.includes(testDeckName)) {
        await ankiClient.deleteDecks([testDeckName], true);
      }
    } catch (e) {
      console.warn('Не удалось очистить тестовую колоду в начале', e);
    }
  }, 10000);

  afterAll(async () => {
    // Удаляем тестовую колоду
    try {
      console.log('--- Очистка тестовой колоды Anki ---');
      await ankiClient.deleteDecks([testDeckName], true);
    } catch (e) {
      console.error('Ошибка очистки тестовой колоды в afterAll', e);
    }

    // Очищаем таблицы Dexie
    if (db) {
      await db.words.clear();
      await db.reviews.clear();
      await db.delete();
    }
  }, 15000);

  it('should successfully perform initial sync (import cards from Anki)', async () => {
    // 1. Создаем колоду в Anki
    await ankiClient.createDeck(testDeckName);

    // 2. Добавляем 5 тестовых карточек
    const testCards = [
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '猫[ねко]', Back: 'кошка' } },
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '犬[いぬ]', Back: 'собака' } },
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '水[みず]', Back: 'вода' } },
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '本[ほん]', Back: 'книга' } },
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '話す[はなす]', Back: 'говорить' } },
    ];
    
    const cardIds = await ankiClient.addNotes(testCards);
    expect(cardIds).toHaveLength(5);
    expect(cardIds.every(id => typeof id === 'number' && id > 0)).toBe(true);

    // 3. Запускаем синхронизацию
    console.log('Запуск начальной синхронизации...');
    const syncResult = await syncLocalDatabaseWithAnki(profileId, testDeckName);
    expect(syncResult.success).toBe(true);

    // 4. Проверяем локальную БД
    const localWords = await getLocalWords(profileId, testDeckName);
    expect(localWords).toHaveLength(5);

    // Проверяем правильность парсинга
    const catWord = localWords.find(w => w.translation === 'кошка');
    expect(catWord).toBeDefined();
    expect(catWord?.word).toBe('猫');
    expect(catWord?.reading).toBe('ねко');
    expect(catWord?.active.status).toBe('new');
  }, 20000);

  it('should sync local reviews back to Anki and update FSRS parameters', async () => {
    const localWords = await getLocalWords(profileId, testDeckName);
    expect(localWords.length).toBeGreaterThan(0);

    const targetWord = localWords[0];
    const cardId = targetWord.id;

    // 1. Создаем локальный отзыв (симулируем оценку "Good" = 3)
    const timestamp = Date.now();
    await addLocalReview({
      profileId,
      cardId,
      ease: 3, // Good
      interval: 1, // планируемый следующий интервал
      lastInterval: 0,
      duration: 3500, // 3.5 секунды
      timestamp,
      synced: 0 // несинхронизирован
    });

    const unsyncedBefore = await getUnsyncedReviews(profileId);
    expect(unsyncedBefore).toHaveLength(1);
    expect(unsyncedBefore[0].cardId).toBe(cardId);

    // 2. Выполняем синхронизацию
    console.log('Синхронизация отзывов обратно в Anki...');
    const syncResult = await syncLocalDatabaseWithAnki(profileId, testDeckName);
    expect(syncResult.success).toBe(true);

    // 3. Проверяем, что локальный отзыв помечен как синхронизированный
    const unsyncedAfter = await getUnsyncedReviews(profileId);
    expect(unsyncedAfter).toHaveLength(0);

    // 4. Запрашиваем историю повторений из Anki, чтобы подтвердить запись
    const remoteReviews = await ankiClient.getReviewsOfCards([cardId]);
    console.log('REVIEWS FOR CARD FROM ANKI:', JSON.stringify(remoteReviews, null, 2));
    const cardRevs = remoteReviews[cardId] || [];
    expect(cardRevs.length).toBeGreaterThanOrEqual(1);

    // Находим наш записанный отзыв по таймстампу
    const matchingRev = cardRevs.find(r => Math.abs(r.id - timestamp) < 2000); // погрешность до 2 сек
    expect(matchingRev).toBeDefined();
    expect(matchingRev?.ease).toBe(3);
    expect(matchingRev?.time).toBe(3500);

    // 5. Проверяем, что локальная карточка обновила статус на 'learning'/'review'
    const updatedWords = await getLocalWords(profileId, testDeckName);
    const updatedWord = updatedWords.find(w => w.id === cardId);
    expect(updatedWord).toBeDefined();
    expect(updatedWord?.active.status).not.toBe('new');
    expect(updatedWord?.active.reps).toBe(1);
  }, 25000);

  it('should handle large batches (100 cards) during synchronization', async () => {
    // 1. Генерируем 100 новых карточек
    const largeBatchCards = [];
    for (let i = 1; i <= 100; i++) {
      largeBatchCards.push({
        deckName: testDeckName,
        modelName: 'Basic',
        fields: {
          Front: `ТестСлово${i}[тестчтение${i}]`,
          Back: `тестперевод${i}`
        }
      });
    }

    console.log('Добавление 100 карточек в Anki...');
    const batchIds = await ankiClient.addNotes(largeBatchCards);
    expect(batchIds).toHaveLength(100);

    // 2. Синхронизируем базу данных
    console.log('Синхронизация 100 карточек...');
    const startTime = Date.now();
    const syncResult = await syncLocalDatabaseWithAnki(profileId, testDeckName);
    const duration = Date.now() - startTime;
    
    console.log(`Синхронизация 100 карточек завершена за ${duration}мс`);
    expect(syncResult.success).toBe(true);

    // 3. Проверяем общее количество карт в локальной БД
    const localWords = await getLocalWords(profileId, testDeckName);
    // Должно быть 5 старых + 100 новых = 105 карт
    expect(localWords.length).toBe(105);

    // Проверяем, что одно из пакетных слов записано верно
    const sampleWord = localWords.find(w => w.translation === 'тестперевод50');
    expect(sampleWord).toBeDefined();
    expect(sampleWord?.word).toBe('ТестСлово50[тестчтение50]');
  }, 45000);

  it('should correctly replay three distinct card histories (stable, fluctuating, forgotten) and schedule them non-linearly', async () => {
    // 1. Создаем 3 карточки в Anki
    const testCards = [
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '車テスト一[くるまてすといち]', Back: 'машина' } },
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '猫テスト二[ねкоてすとに]', Back: 'кошка' } },
      { deckName: testDeckName, modelName: 'Basic', fields: { Front: '水テスト三[みずてすとさん]', Back: 'вода' } }
    ];
    const cardIds = await ankiClient.addNotes(testCards);
    expect(cardIds).toHaveLength(3);
    const [card1Id, card2Id, card3Id] = cardIds;

    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Вспомогательная функция для получения уникального таймстампа для отзывов
    // Добавляем инкрементальное смещение, чтобы исключить UNIQUE constraint в Anki Connect (revlog.id)
    let offsetCounter = 0;
    const getUniqueTime = (daysAgo: number) => {
      offsetCounter += 1;
      return now - daysAgo * oneDayMs + offsetCounter * 1000;
    };

    // 2. Генерируем историю повторений в Anki
    const reviews: Array<[number, number, number, number, number, number, number, number, number]> = [];

    // Карточка 1: Стабильное прохождение (Good, Good, Good, Good)
    reviews.push(
      [getUniqueTime(90), card1Id, -1, 3, 3, 0, 0, 5000, 0],   // Good, ivl = 3
      [getUniqueTime(87), card1Id, -1, 3, 12, 3, 0, 5000, 1],  // Good, ivl = 12
      [getUniqueTime(75), card1Id, -1, 3, 30, 12, 0, 5000, 1], // Good, ivl = 30
      [getUniqueTime(45), card1Id, -1, 3, 75, 30, 0, 5000, 1]  // Good, ivl = 75
    );

    // Карточка 2: Колеблющееся прохождение (Good, Hard, Good, Hard, Good)
    reviews.push(
      [getUniqueTime(90), card2Id, -1, 3, 3, 0, 0, 5000, 0],   // Good, ivl = 3
      [getUniqueTime(87), card2Id, -1, 2, 4, 3, 0, 5000, 1],   // Hard, ivl = 4
      [getUniqueTime(83), card2Id, -1, 3, 10, 4, 0, 5000, 1],  // Good, ivl = 10
      [getUniqueTime(73), card2Id, -1, 2, 12, 10, 0, 5000, 1], // Hard, ivl = 12
      [getUniqueTime(61), card2Id, -1, 3, 28, 12, 0, 5000, 1]  // Good, ivl = 28
    );

    // Карточка 3: Проблемная/часто забываемая (Good, Again, Good, Again, Good, Again)
    reviews.push(
      [getUniqueTime(90), card3Id, -1, 3, 3, 0, 0, 5000, 0],   // Good, ivl = 3
      [getUniqueTime(87), card3Id, -1, 1, 0, 3, 0, 5000, 2],   // Again, ivl = 0
      [getUniqueTime(86), card3Id, -1, 3, 1, 0, 0, 5000, 0],   // Good, ivl = 1
      [getUniqueTime(85), card3Id, -1, 1, 0, 1, 0, 5000, 2],   // Again, ivl = 0
      [getUniqueTime(84), card3Id, -1, 3, 1, 0, 0, 5000, 0],   // Good, ivl = 1
      [getUniqueTime(60), card3Id, -1, 1, 0, 1, 0, 5000, 2]    // Again, ivl = 0
    );


    console.log('Вставка истории повторений в Anki...');
    await ankiClient.insertReviews(reviews);

    // 3. Синхронизируем базу данных
    console.log('Синхронизация трех карточек с историей...');
    const syncResult = await syncLocalDatabaseWithAnki(profileId, testDeckName);
    expect(syncResult.success).toBe(true);

    // 4. Проверяем локальное состояние в Dexie
    const localWords = await getLocalWords(profileId, testDeckName);
    
    const word1 = localWords.find(w => w.id === card1Id);
    const word2 = localWords.find(w => w.id === card2Id);
    const word3 = localWords.find(w => w.id === card3Id);

    expect(word1).toBeDefined();
    expect(word2).toBeDefined();
    expect(word3).toBeDefined();

    expect(word1?.active.reps).toBe(4);
    expect(word2?.active.reps).toBe(5);
    expect(word3?.active.reps).toBe(6);

    // 5. Выполняем FSRS-расчет для каждой карты с оценкой Good (3) СЕГОДНЯ
    const dbWord1 = await db.words.get([profileId, card1Id]);
    const dbWord2 = await db.words.get([profileId, card2Id]);
    const dbWord3 = await db.words.get([profileId, card3Id]);

    const res1 = calculateNextFsrsState(dbWord1, 3, 'active', new Date());
    const res2 = calculateNextFsrsState(dbWord2, 3, 'active', new Date());
    const res3 = calculateNextFsrsState(dbWord3, 3, 'active', new Date());

    console.log(`Новые интервалы - Стабильная: ${res1.newInterval}д, Колеблющаяся: ${res2.newInterval}д, Проблемная: ${res3.newInterval}д`);

    // Сравниваем нелинейность интервалов: стабильная > колеблющаяся > проблемная
    expect(res1.newInterval).toBeGreaterThan(res2.newInterval);
    expect(res2.newInterval).toBeGreaterThan(res3.newInterval);
    
    // Проблемная карта из-за частых забываний (последнее было Again) должна получить очень маленький интервал (1-3 дня)
    expect(res3.newInterval).toBeLessThanOrEqual(3);

    // 6. Записываем отзывы локально и синхронизируем с Anki
    await db.words.put(res1.updatedWord);
    await db.words.put(res2.updatedWord);
    await db.words.put(res3.updatedWord);

    await addLocalReview({
      profileId,
      cardId: card1Id,
      ease: 3,
      interval: res1.newInterval,
      lastInterval: dbWord1.active.interval,
      duration: 3000,
      timestamp: Date.now(),
      synced: 0
    });
 
    await addLocalReview({
      profileId,
      cardId: card2Id,
      ease: 3,
      interval: res2.newInterval,
      lastInterval: dbWord2.active.interval,
      duration: 3000,
      timestamp: Date.now() + 10,
      synced: 0
    });
 
    await addLocalReview({
      profileId,
      cardId: card3Id,
      ease: 3,
      interval: res3.newInterval,
      lastInterval: dbWord3.active.interval,
      duration: 3000,
      timestamp: Date.now() + 20,
      synced: 0
    });

    const syncResult2 = await syncLocalDatabaseWithAnki(profileId, testDeckName);
    expect(syncResult2.success).toBe(true);

    // 7. Проверяем, что в Anki интервалы установились в соответствии с нашими нелинейными расчетами
    const cardsInfo = await ankiClient.getCardsInfo([card1Id, card2Id, card3Id]);
    expect(cardsInfo[0].interval).toBe(res1.newInterval);
    expect(cardsInfo[1].interval).toBe(res2.newInterval);
    expect(cardsInfo[2].interval).toBe(res3.newInterval);
  }, 40000);
});


// Если Anki недоступен, регистрируем заглушку, чтобы тест завершался успехом
describe.skipIf(ankiConnected)('Anki Bilateral Sync Integration Test (Skipped)', () => {
  it('should be skipped because local Anki is offline', () => {
    expect(true).toBe(true);
  });
});

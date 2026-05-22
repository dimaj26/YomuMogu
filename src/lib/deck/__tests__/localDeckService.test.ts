// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fakeIndexedDB from 'fake-indexeddb';
import fakeIDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

// Инициализируем полифилл IndexedDB до загрузки Dexie
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = fakeIDBKeyRange;

// Динамически импортируем db и localDeckService
const { db } = await import('../../db');
const {
  LOCAL_DECK_NAME,
  DAILY_NEW_WORDS_LIMIT,
  MIN_WORDS_FOR_3_SESSIONS,
  LOCAL_STORAGE_KEY_PREFIX,
  isLocalDeckInitialized,
  importStarterDeck,
  getDailyNewWordsCount,
  incrementDailyNewWordsCount,
  getDailyActivePool,
  getLocalDeckStats,
} = await import('../localDeckService');

describe('LocalDeckService Unit Tests', () => {
  const profileId = 'test-profile';

  beforeEach(async () => {
    // Очищаем таблицы перед каждым тестом
    await db.words.clear();
    await db.reviews.clear();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isLocalDeckInitialized -> false когда таблица пуста', async () => {
    const initialized = await isLocalDeckInitialized(profileId);
    expect(initialized).toBe(false);
  });

  it('isLocalDeckInitialized -> true после importStarterDeck', async () => {
    await importStarterDeck(profileId, new Set());
    const initialized = await isLocalDeckInitialized(profileId);
    expect(initialized).toBe(true);
  });

  it('importStarterDeck: knownWordIds -> статус mature, остальные -> new', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const knownIds = new Set([1, 2, 3]);
    await importStarterDeck(profileId, knownIds);

    const allWords = await db.words.where('profileId').equals(profileId).toArray();
    expect(allWords.length).toBe(500); // Всего 500 слов

    const word1 = allWords.find(w => w.id === 1);
    expect(word1).toBeDefined();
    expect(word1?.status).toBe('mature');
    expect(word1?.interval).toBe(200);
    expect(word1?.stability).toBe(200);
    expect(word1?.reps).toBe(1);
    expect(word1?.due).toBeGreaterThan(Date.now());

    const word4 = allWords.find(w => w.id === 4);
    expect(word4).toBeDefined();
    expect(word4?.status).toBe('new');
    expect(word4?.interval).toBe(0);
    expect(word4?.stability).toBe(0);
    expect(word4?.reps).toBe(0);
  });

  it('importStarterDeck: слова со статусом review/mature в БД не перезаписываются (аддитивность)', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    
    // Сначала вставляем в БД слово с прогрессом
    await db.words.put({
      profileId,
      id: 1,
      word: '水',
      reading: 'みず',
      translation: 'вода',
      deckName: LOCAL_DECK_NAME,
      status: 'review',
      stability: 15,
      difficulty: 4.5,
      interval: 15,
      due: Date.now() + 500000,
      reps: 4,
      lapses: 1,
    });

    // Запускаем импорт с известным ID = 1 (в теории должно стать mature)
    await importStarterDeck(profileId, new Set([1]));

    const word1 = await db.words.where({ profileId, id: 1 }).first();
    expect(word1).toBeDefined();
    expect(word1?.status).toBe('review'); // статус остался review
    expect(word1?.interval).toBe(15);
    expect(word1?.reps).toBe(4);
  });

  it('getDailyActivePool: возвращает только due+learning при due >= 15', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData = [];
    // Создаем 20 слов со статусом learning/review, у которых due <= now
    for (let i = 1; i <= 20; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: i % 2 === 0 ? 'learning' : 'review',
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000, // уже просрочены
        reps: 2,
        lapses: 0,
      });
    }

    // Создаем 5 новых слов
    for (let i = 21; i <= 25; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'new',
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
      });
    }

    await db.words.bulkPut(wordsData);

    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // Должны вернуться только 20 просроченных слов, новые добираться не должны, т.к. 20 >= 15
    expect(pool.length).toBe(20);
    expect(pool.every(w => w.status !== 'new')).toBe(true);
  });

  it('getDailyActivePool: добирает new слова если due < 15, соблюдает DAILY_NEW_WORDS_LIMIT', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData = [];
    // 5 due слов
    for (let i = 1; i <= 5; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'learning',
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      });
    }

    // 20 new слов
    for (let i = 6; i <= 25; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'new',
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
      });
    }

    await db.words.bulkPut(wordsData);

    // Случай 1: сегодня новые слова еще не изучались (квота = 10)
    // due (5) + new (добрать 10) = 15
    let pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(15);
    expect(pool.filter(w => w.status === 'new').length).toBe(10);

    // Случай 2: сегодня уже изучено 7 слов, лимит оставшийся = 3
    // due (5) + new (добрать 3) = 8
    incrementDailyNewWordsCount(profileId, 7);
    pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(8);
    expect(pool.filter(w => w.status === 'new').length).toBe(3);
  });

  it('getDailyActivePool: добирает mature (по возрастанию interval) если due+new < 15', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData = [];
    // 3 due слов
    for (let i = 1; i <= 3; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'learning',
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      });
    }

    // 2 new слов
    for (let i = 4; i <= 5; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'new',
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
      });
    }

    // 15 mature слов с разным интервалом (due в будущем)
    for (let i = 6; i <= 20; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'mature',
        stability: 200,
        difficulty: 5,
        interval: 300 - i * 5, // интервалы будут уменьшаться с ростом i (от 270 до 200)
        due: now + 500000,
        reps: 1,
        lapses: 0,
      });
    }

    await db.words.bulkPut(wordsData);

    // due(3) + new(2) = 5. Нужно добрать 10 mature.
    // Сортировка по возрастанию interval. Наименьшие интервалы у слов с большими индексами (11-20).
    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(15);
    const matureInPool = pool.filter(w => w.status === 'mature');
    expect(matureInPool.length).toBe(10);
    // Проверим, что отсортированы по возрастанию интервала (от 200 до 245)
    expect(matureInPool[0].interval).toBe(200); // для i=20: 300 - 100 = 200
  });

  it('getDailyActivePool: mature слова с due > now НЕ попадают в пул как приоритет', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData = [];
    // 20 mature слов с due в будущем
    for (let i = 1; i <= 20; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'mature',
        stability: 200,
        difficulty: 5,
        interval: 200,
        due: now + 100000,
        reps: 1,
        lapses: 0,
      });
    }

    await db.words.bulkPut(wordsData);

    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // Так как due=0, new=0, мы вынуждены добирать mature по fallback.
    // Но если бы у нас было 15 due-слов, эти mature не попали бы.
    // Давайте добавим 15 due слов и проверим, что mature с due > now не попадают.
    const dueWords = [];
    for (let i = 21; i <= 35; i++) {
      dueWords.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        deckName: LOCAL_DECK_NAME,
        status: 'learning',
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      });
    }
    await db.words.bulkPut(dueWords);

    const poolWithDue = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(poolWithDue.length).toBe(15);
    expect(poolWithDue.every(w => w.status === 'learning')).toBe(true);
  });

  it('getDailyNewWordsCount: возвращает 0 при отсутствии ключа или от другой даты', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    expect(getDailyNewWordsCount(profileId)).toBe(0);

    // Записываем ключ от вчерашнего дня
    localStorage.setItem(`yomumogu_profile_${profileId}_${LOCAL_STORAGE_KEY_PREFIX}_2026-05-21`, '5');
    expect(getDailyNewWordsCount(profileId)).toBe(0);
  });

  it('getDailyNewWordsCount: возвращает корректное число для сегодняшнего ключа', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    localStorage.setItem(`yomumogu_profile_${profileId}_${LOCAL_STORAGE_KEY_PREFIX}_2026-05-22`, '7');
    expect(getDailyNewWordsCount(profileId)).toBe(7);
  });

  it('incrementDailyNewWordsCount: обновляет счетчик с правильным ключом даты', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    incrementDailyNewWordsCount(profileId, 3);
    expect(getDailyNewWordsCount(profileId)).toBe(3);

    incrementDailyNewWordsCount(profileId, 5);
    expect(getDailyNewWordsCount(profileId)).toBe(8);

    const storedValue = localStorage.getItem(`yomumogu_profile_${profileId}_${LOCAL_STORAGE_KEY_PREFIX}_2026-05-22`);
    expect(storedValue).toBe('8');
  });

  it('getLocalDeckStats: корректно считает total/new/learning/review/mature', async () => {
    const statsEmpty = await getLocalDeckStats(profileId);
    expect(statsEmpty).toEqual({ total: 0, new: 0, learning: 0, review: 0, mature: 0 });

    const wordsData = [
      { id: 1, status: 'new' },
      { id: 2, status: 'new' },
      { id: 3, status: 'learning' },
      { id: 4, status: 'review' },
      { id: 5, status: 'mature' },
      { id: 6, status: 'mature' },
    ].map(w => ({
      profileId,
      id: w.id,
      word: `Word${w.id}`,
      reading: `Read${w.id}`,
      translation: `Trans${w.id}`,
      deckName: LOCAL_DECK_NAME,
      status: w.status as any,
      stability: 1,
      difficulty: 1,
      interval: 1,
      due: Date.now(),
      reps: 1,
      lapses: 0,
    }));

    await db.words.bulkPut(wordsData);

    const stats = await getLocalDeckStats(profileId);
    expect(stats).toEqual({
      total: 6,
      new: 2,
      learning: 1,
      review: 1,
      mature: 2,
    });
  });
});

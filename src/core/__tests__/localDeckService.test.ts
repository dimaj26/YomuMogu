// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';

// Инициализируем полифилл IndexedDB до загрузки Dexie
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Динамически импортируем db и localDeckService
const { db } = await import('../db');
const {
  LOCAL_DECK_NAME,
  MIN_WORDS_FOR_3_SESSIONS,
  LOCAL_STORAGE_KEY_PREFIX,
  isLocalDeckInitialized,
  importStarterDeck,
  getDailyNewWordsCount,
  incrementDailyNewWordsCount,
  getDailyActivePool,
  getLocalDeckStats,
  getDailyNewWordsLimit,
  getPriorityWordsCount,
  getDailyNewWordsLimitOffset,
  incrementDailyNewWordsLimitOffset,
  syncDailyNewWordsCountWithDb,
  retagAllWords,
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
    expect(word1?.active.status).toBe('mature');
    expect(word1?.active.interval).toBe(200);
    expect(word1?.active.stability).toBe(200);
    expect(word1?.active.reps).toBe(1);
    expect(word1?.active.due).toBeGreaterThan(Date.now());

    const word4 = allWords.find(w => w.id === 4);
    expect(word4).toBeDefined();
    expect(word4?.active.status).toBe('new');
    expect(word4?.active.interval).toBe(0);
    expect(word4?.active.stability).toBe(0);
    expect(word4?.active.reps).toBe(0);
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
      category: LOCAL_DECK_NAME,
      source: 'starter',
      active: {
        status: 'review',
        stability: 15,
        difficulty: 4.5,
        interval: 15,
        due: Date.now() + 500000,
        reps: 4,
        lapses: 1,
      },
      contextExamples: []
    });

    // Запускаем импорт с известным ID = 1 (в теории должно стать mature)
    await importStarterDeck(profileId, new Set([1]));

    const word1 = await db.words.where({ profileId, id: 1 }).first();
    expect(word1).toBeDefined();
    expect(word1?.active.status).toBe('review'); // статус остался review
    expect(word1?.active.interval).toBe(15);
    expect(word1?.active.reps).toBe(4);
  });

  it('getDailyActivePool: возвращает только due+learning при due >= 15', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];
    // Создаем 20 слов со статусом learning/review, у которых due <= now
    for (let i = 1; i <= 20; i++) {
      const fsrs = {
        status: (i % 2 === 0 ? 'learning' : 'review') as any,
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000, // уже просрочены
        reps: 2,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    // Создаем 5 новых слов
    for (let i = 21; i <= 25; i++) {
      const fsrs = {
        status: 'new' as any,
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    await db.words.bulkPut(wordsData);

    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // Должны вернуться только 20 просроченных слов, новые добираться не должны, т.к. 20 >= 15
    expect(pool.length).toBe(20);
    expect(pool.every(w => w.status !== 'new')).toBe(true);
  });

  it('getDailyNewWordsLimit: корректно возвращает лимиты для различных пресетов и кастомного значения', () => {
    // Дефолт без настроек
    expect(getDailyNewWordsLimit(profileId)).toBe(10);

    // Мало
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'easy');
    expect(getDailyNewWordsLimit(profileId)).toBe(5);

    // Стандартно
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'standard');
    expect(getDailyNewWordsLimit(profileId)).toBe(10);

    // Много
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'hard');
    expect(getDailyNewWordsLimit(profileId)).toBe(20);

    // Кастомное корректное значение
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'custom');
    localStorage.setItem(`yomumogu_profile_${profileId}_daily_new_words_limit`, '15');
    expect(getDailyNewWordsLimit(profileId)).toBe(15);

    // Кастомное некорректное значение (меньше 1) -> фоллбек 10
    localStorage.setItem(`yomumogu_profile_${profileId}_daily_new_words_limit`, '0');
    expect(getDailyNewWordsLimit(profileId)).toBe(10);

    // Кастомное некорректное значение (больше 50) -> фоллбек 10
    localStorage.setItem(`yomumogu_profile_${profileId}_daily_new_words_limit`, '51');
    expect(getDailyNewWordsLimit(profileId)).toBe(10);

    // Не число -> фоллбек 10
    localStorage.setItem(`yomumogu_profile_${profileId}_daily_new_words_limit`, 'abc');
    expect(getDailyNewWordsLimit(profileId)).toBe(10);
  });

  it('getDailyActivePool: добирает new слова если due < 15, соблюдает getDailyNewWordsLimit', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];
    // 5 due слов
    for (let i = 1; i <= 5; i++) {
      const fsrs = {
        status: 'learning' as any,
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    // 20 new слов
    for (let i = 6; i <= 25; i++) {
      const fsrs = {
        status: 'new' as any,
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    await db.words.bulkPut(wordsData);

    // Случай 1: пресет 'standard' (квота = 10)
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'standard');
    let pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(15);
    expect(pool.filter(w => w.status === 'new').length).toBe(10);

    // Случай 2: пресет 'easy' (квота = 5)
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'easy');
    pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(10); // due(5) + new(5)
    expect(pool.filter(w => w.status === 'new').length).toBe(5);

    // Случай 3: пресет 'custom' с лимитом 12
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'custom');
    localStorage.setItem(`yomumogu_profile_${profileId}_daily_new_words_limit`, '12');
    pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // Нам нужно добрать до 15, при 5 due требуется 10 new. 10 < 12, поэтому добираем 10.
    expect(pool.length).toBe(15);
    expect(pool.filter(w => w.status === 'new').length).toBe(10);

    // Случай 4: лимит 12, но сегодня уже изучено 7 слов, лимит оставшийся = 5
    // due (5) + new (добрать 5) = 10
    incrementDailyNewWordsCount(profileId, 7);
    pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(10);
    expect(pool.filter(w => w.status === 'new').length).toBe(5);

    // Случай 5: проверим, что лимит действительно ограничивает новые слова, если потребность больше лимита
    // Сбросим счетчик дня
    localStorage.removeItem(`yomumogu_profile_${profileId}_daily_new_words_2026-05-22`);
    // Очистим БД и положим только 2 due слова и 20 new слов
    await db.words.clear();
    const testWords: import('../db').LocalWord[] = [];
    for (let i = 1; i <= 2; i++) {
      const fsrs = {
        status: 'learning' as any,
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      };
      testWords.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }
    for (let i = 3; i <= 25; i++) {
      const fsrs = {
        status: 'new' as any,
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now,
        reps: 0,
        lapses: 0,
      };
      testWords.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }
    await db.words.bulkPut(testWords);

    pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // due(2) + new(12) = 14. Нам нужно добрать 13 слов, но лимит равен 12. Добирается ровно 12.
    expect(pool.length).toBe(14);
    expect(pool.filter(w => w.status === 'new').length).toBe(12);
  });

  it('getDailyActivePool: добирает mature (по возрастанию interval) если пул полностью пуст', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];

    // 0 due-слов, 0 new-слов (квота уже исчерпана)
    // Устанавливаем лимит = 0 (исчерпана квота)
    localStorage.setItem(`yomumogu_profile_${profileId}_quota_preset`, 'custom');
    localStorage.setItem(`yomumogu_profile_${profileId}_daily_new_words_limit`, '1');
    incrementDailyNewWordsCount(profileId, 1); // уже использовано 1 из 1

    // 15 mature слов с разным интервалом (due в будущем)
    for (let i = 6; i <= 20; i++) {
      const fsrs = {
        status: 'mature' as any,
        stability: 200,
        difficulty: 5,
        interval: 300 - (i - 5) * 10,
        due: now + 500000,
        reps: 1,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    await db.words.bulkPut(wordsData);

    // Пул пуст (0 due, 0 new с оставшейся квотой) → добираем до 15 mature
    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(15);
    const matureInPool = pool.filter(w => w.status === 'mature');
    expect(matureInPool.length).toBe(15);
    // Проверим, что отсортированы по возрастанию интервала
    expect(matureInPool[0].interval).toBeLessThan(matureInPool[1].interval);
  });

  it('getDailyActivePool: mature слова с due > now НЕ попадают в пул как приоритет', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];
    // 20 mature слов с due в будущем
    for (let i = 1; i <= 20; i++) {
      const fsrs = {
        status: 'mature' as any,
        stability: 200,
        difficulty: 5,
        interval: 200,
        due: now + 100000,
        reps: 1,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    await db.words.bulkPut(wordsData);

    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // Так как due=0, new=0, мы вынуждены добирать mature по fallback.
    // Но если бы у нас было 15 due-слов, эти mature не попали бы.
    // Давайте добавим 15 due слов и проверим, что mature с due > now не попадают.
    const dueWords: import('../db').LocalWord[] = [];
    for (let i = 21; i <= 35; i++) {
      const fsrs = {
        status: 'learning' as any,
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      };
      dueWords.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
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

  it('incrementDailyNewWordsLimitOffset: updates limit offsets and recalculates limit correctly', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    expect(getDailyNewWordsLimitOffset(profileId)).toBe(0);
    expect(getDailyNewWordsLimit(profileId)).toBe(10); // Standard limit is 10

    incrementDailyNewWordsLimitOffset(profileId, 10);
    expect(getDailyNewWordsLimitOffset(profileId)).toBe(10);
    expect(getDailyNewWordsLimit(profileId)).toBe(20); // 10 base + 10 offset

    incrementDailyNewWordsLimitOffset(profileId, 5);
    expect(getDailyNewWordsLimitOffset(profileId)).toBe(15);
    expect(getDailyNewWordsLimit(profileId)).toBe(25); // 10 base + 15 offset

    // Проверяем, что на другую дату смещение сбрасывается
    vi.setSystemTime(new Date('2026-05-23T10:00:00Z'));
    expect(getDailyNewWordsLimitOffset(profileId)).toBe(0);
    expect(getDailyNewWordsLimit(profileId)).toBe(10);
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
    ].map(w => {
      const fsrs = {
        status: w.status as any,
        stability: 1,
        difficulty: 1,
        interval: 1,
        due: Date.now(),
        reps: 1,
        lapses: 0,
      };
      return {
        profileId,
        id: w.id,
        word: `Word${w.id}`,
        reading: `Read${w.id}`,
        translation: `Trans${w.id}`,
        category: LOCAL_DECK_NAME,
        source: 'starter' as const,
        active: { ...fsrs },
        contextExamples: []
      };
    });

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

  it('getDailyActivePool: mature fallback added only if pool is empty', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];
    // 5 due-слов (learning)
    for (let i = 1; i <= 5; i++) {
      const fsrs = {
        status: 'learning' as any,
        stability: 5,
        difficulty: 5,
        interval: 5,
        due: now - 10000,
        reps: 2,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    // 20 mature слов с due в будущем (NOT due — только для fallback)
    for (let i = 6; i <= 25; i++) {
      const fsrs = {
        status: 'mature' as any,
        stability: 200,
        difficulty: 5,
        interval: 200,
        due: now + 500000,
        reps: 1,
        lapses: 0,
      };
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { ...fsrs },
        contextExamples: []
      });
    }

    await db.words.bulkPut(wordsData);

    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    // Должно быть 5 due-слов. Mature НЕ добираются, т.к. pool НЕ пуст (5 > 0).
    // Старое поведение добрало бы до 15, новое — нет.
    expect(pool.length).toBe(5);
    expect(pool.every(w => w.status === 'learning')).toBe(true);
  });

  it('getDailyActivePool: помечает трудные слова isHard в выдаче и сортирует их первыми', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];
    
    // 1. Обычное learning слово (due, не hard: stability = 5, lapses = 0)
    wordsData.push({
      profileId,
      id: 1,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: LOCAL_DECK_NAME,
      source: 'starter',
      active: { status: 'learning', stability: 5, difficulty: 5, interval: 5, due: now - 10000, reps: 2, lapses: 0 },
      contextExamples: []
    });

    // 2. Трудное learning слово (due, hard: lapses = 2)
    wordsData.push({
      profileId,
      id: 2,
      word: '犬',
      reading: 'いぬ',
      translation: 'собака',
      category: LOCAL_DECK_NAME,
      source: 'starter',
      active: { status: 'learning', stability: 5, difficulty: 5, interval: 5, due: now - 10000, reps: 2, lapses: 2 },
      contextExamples: []
    });

    await db.words.bulkPut(wordsData);

    const pool = await getDailyActivePool(profileId, LOCAL_DECK_NAME);
    expect(pool.length).toBe(2);
    
    // Проверяем, что '犬' (id: 2) помечен как isHard и идет первым в выдаче пула
    expect(pool[0].word).toBe('犬');
    expect(pool[0].isHard).toBe(true);

    // Проверяем, что '猫' (id: 1) не является hard и идет вторым в выдаче пула
    expect(pool[1].word).toBe('猫');
    expect(pool[1].isHard).toBe(false);
  });

  it('getPriorityWordsCount: не считает new-слова как due даже если due <= now', async () => {
    vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
    const now = Date.now();

    const wordsData: import('../db').LocalWord[] = [];

    // 3 learning слова с due <= now (это настоящие due)
    for (let i = 1; i <= 3; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { status: 'learning', stability: 5, difficulty: 5, interval: 5, due: now - 10000, reps: 2, lapses: 0 },
        contextExamples: []
      });
    }

    // 10 new слов с due = now (ошибочно могут считаться due)
    for (let i = 4; i <= 13; i++) {
      wordsData.push({
        profileId,
        id: i,
        word: `Слово${i}`,
        reading: `Чтение${i}`,
        translation: `Перевод${i}`,
        category: LOCAL_DECK_NAME,
        source: 'starter',
        active: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        contextExamples: []
      });
    }

    await db.words.bulkPut(wordsData);

    // due = 3 (learning) + new в рамках лимита (10, лимит по умолчанию = 10) = 13
    const count = await getPriorityWordsCount(profileId, LOCAL_DECK_NAME);
    expect(count).toBe(13);
  });

  describe('syncDailyNewWordsCountWithDb', () => {
    it('returns 0 and updates localStorage when there are no reviews in DB, ignoring stale cache', async () => {
      // Имитируем устаревший кэш в localStorage
      vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
      localStorage.setItem(`yomumogu_profile_${profileId}_${LOCAL_STORAGE_KEY_PREFIX}_2026-05-22`, '10');

      // База пуста
      const count = await syncDailyNewWordsCountWithDb(profileId);
      expect(count).toBe(0);

      // Проверяем, что localStorage сбросился в "0"
      expect(localStorage.getItem(`yomumogu_profile_${profileId}_${LOCAL_STORAGE_KEY_PREFIX}_2026-05-22`)).toBe('0');
    });

    it('returns the correct number of new words studied today based on reviews in DB', async () => {
      vi.setSystemTime(new Date('2026-05-22T10:00:00Z'));
      const now = Date.now();
      const boundary = new Date(now);
      boundary.setHours(4, 0, 0, 0);
      const startTimestamp = boundary.getTime();

      // Добавим слово 1 (первый отзыв сегодня) -> должно считаться новым словом сегодня
      await db.reviews.add({
        profileId,
        cardId: 1,
        ease: 3,
        interval: 1,
        lastInterval: 0,
        duration: 1000,
        timestamp: startTimestamp + 1000,
        synced: 0
      });

      // Добавим слово 2 (отзыв сегодня, но был отзыв вчера) -> НЕ должно считаться новым сегодня
      await db.reviews.add({
        profileId,
        cardId: 2,
        ease: 3,
        interval: 3,
        lastInterval: 1,
        duration: 1000,
        timestamp: startTimestamp - 50000, // Вчерашний отзыв
        synced: 1
      });
      await db.reviews.add({
        profileId,
        cardId: 2,
        ease: 3,
        interval: 5,
        lastInterval: 3,
        duration: 1000,
        timestamp: startTimestamp + 2000, // Сегодняшний отзыв
        synced: 0
      });

      // Добавим слово 3 (отзыв только вчера) -> НЕ должно считаться сегодня
      await db.reviews.add({
        profileId,
        cardId: 3,
        ease: 3,
        interval: 1,
        lastInterval: 0,
        duration: 1000,
        timestamp: startTimestamp - 100000,
        synced: 1
      });

      const count = await syncDailyNewWordsCountWithDb(profileId);
      expect(count).toBe(1); // Только слово 1 изучено сегодня впервые

      // Убеждаемся, что localStorage обновился
      expect(localStorage.getItem(`yomumogu_profile_${profileId}_${LOCAL_STORAGE_KEY_PREFIX}_2026-05-22`)).toBe('1');
    });
  });

  describe('JLPT Retagging', () => {
    it('retagAllWords помечает существующие слова и не создаёт дублей при повторном запуске', async () => {
      const defaultState = {
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: Date.now(),
        reps: 0,
        lapses: 0,
        status: 'new' as const
      };

      // 1. Вставляем тестовые слова без тегов
      await db.words.bulkPut([
        {
          profileId,
          id: 10001,
          word: '学生', // Должно стать N5 -> jlpt:n5
          reading: 'がくせい',
          translation: 'студент',
          category: LOCAL_DECK_NAME,
          source: 'anki',
          active: { ...defaultState },
          contextExamples: [],
          tags: ['custom']
        },
        {
          profileId,
          id: 10002,
          word: 'несуществующееслово', // Не должно получить тегов
          reading: 'нет',
          translation: 'нет',
          category: LOCAL_DECK_NAME,
          source: 'anki',
          active: { ...defaultState },
          contextExamples: [],
          tags: []
        }
      ]);


      // 2. Запускаем переразметку
      const updatedCount = await retagAllWords(profileId);
      expect(updatedCount).toBe(1); // Обновлено только 1 слово ('学生')

      // Проверяем теги у '学生'
      const word1 = await db.words.get([profileId, 10001]);
      expect(word1?.tags).toContain('custom');
      expect(word1?.tags).toContain('jlpt:n5');

      // Проверяем 'несуществующееслово'
      const word2 = await db.words.get([profileId, 10002]);
      expect(word2?.tags).toEqual([]);

      // 3. Запускаем повторно
      const secondRunCount = await retagAllWords(profileId);
      expect(secondRunCount).toBe(0); // Ничего не поменялось

      const word1Again = await db.words.get([profileId, 10001]);
      expect(word1Again?.tags).toEqual(['custom', 'jlpt:n5']);
    });
  });
});


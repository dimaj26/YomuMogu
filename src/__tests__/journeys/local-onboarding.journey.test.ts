// @vitest-environment jsdom
/**
 * Journey-тест (golden path) локального онбординга.
 *
 * Покрывает СТЫКИ систем, которые не видят изолированные unit-тесты:
 *   import starter-deck -> chat entry gating [PL-5.9] -> daily pool [PL-6]
 *   -> генерация сессий (route /api/gemini/sessions) -> чат-ход (route /api/chat)
 *   -> запись review + FSRS-продвижение.
 *
 * Внешние границы (Gemini) замоканы согласно [CP-3.6]: никаких живых LLM/Anki/MeCab.
 * Работает на fake-indexeddb (поднимается в vitest.setup.ts), поэтому детерминирован
 * и попадает в дефолтный прогон `npm run test`.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { GeneratedSession } from '@/lib/gemini/client';
import type { ChatResponse } from '@/lib/gemini/chat';
import type { LocalWord } from '@/core/types';

// --- Мок границы Gemini: генерация сессий ---
const MOCK_SESSIONS: GeneratedSession[] = [
  {
    id: 'session-1',
    title: 'Покупки',
    description: 'Диалог в магазине',
    scenario: 'ИИ — продавец, пользователь — покупатель. Купить рубашку.',
    targetWords: [
      { word: '買う', translation: 'покупать' },
      { word: '選ぶ', translation: 'выбирать' },
    ],
  },
  {
    id: 'session-2',
    title: 'Дом',
    description: 'Бытовой диалог',
    scenario: 'ИИ — сосед, пользователь — жилец.',
    targetWords: [{ word: '住む', translation: 'жить' }],
  },
  {
    id: 'session-3',
    title: 'Общение',
    description: 'Знакомство',
    scenario: 'ИИ — новый знакомый.',
    targetWords: [{ word: '話す', translation: 'говорить' }],
  },
];

const MOCK_CHAT: ChatResponse = {
  reply: 'こんにちは。何を選びますか。',
  translation: 'Здравствуйте. Что вы выбираете?',
  grammarFeedback: { isCorrect: true, correction: '', explanation: '' },
  wordsDetected: ['選ぶ'],
  grammarRuleDetected: false,
};

// Мокаем синглтоны Gemini, сохраняя остальные экспорты модулей через importActual.
vi.mock('@/lib/gemini/client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/gemini/client')>();
  return {
    ...actual,
    geminiClient: {
      ...actual.geminiClient,
      generateSessions: vi.fn().mockResolvedValue(MOCK_SESSIONS),
    },
  };
});

vi.mock('@/lib/gemini/chat', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/gemini/chat')>();
  return {
    ...actual,
    chatService: {
      ...actual.chatService,
      sendMessage: vi.fn().mockResolvedValue(MOCK_CHAT),
    },
  };
});

describe('Journey: локальный онбординг (golden path)', () => {
  const PROFILE = 'journey-profile';

  // Динамические импорты после установки полифиллов/моков
  let db: typeof import('@/core/db').db;
  let getLocalWords: typeof import('@/core/db').getLocalWords;
  let addLocalReview: typeof import('@/core/db').addLocalReview;
  let getUnsyncedReviews: typeof import('@/core/db').getUnsyncedReviews;
  let getDailyActivePool: typeof import('@/core/localDeckService').getDailyActivePool;
  let LOCAL_DECK_NAME: string;
  let canEnterChat: typeof import('@/core/scheduler').canEnterChat;
  let calculateNextFsrsState: typeof import('@/core/scheduler').calculateNextFsrsState;
  let createDefaultFsrsState: typeof import('@/core/scheduler').createDefaultFsrsState;
  let sessionsPOST: typeof import('@/app/api/gemini/sessions/route').POST;
  let chatPOST: typeof import('@/app/api/chat/route').POST;
  let NextRequest: typeof import('next/server').NextRequest;

  beforeAll(async () => {
    // Роуты Gemini требуют наличие ключа — реального вызова не будет (синглтон замокан).
    process.env.GEMINI_API_KEY = 'test-journey-key';

    const dbMod = await import('@/core/db');
    db = dbMod.db;
    getLocalWords = dbMod.getLocalWords;
    addLocalReview = dbMod.addLocalReview;
    getUnsyncedReviews = dbMod.getUnsyncedReviews;

    const localMod = await import('@/core/localDeckService');
    getDailyActivePool = localMod.getDailyActivePool;
    LOCAL_DECK_NAME = localMod.LOCAL_DECK_NAME;

    const schedMod = await import('@/core/scheduler');
    canEnterChat = schedMod.canEnterChat;
    calculateNextFsrsState = schedMod.calculateNextFsrsState;
    createDefaultFsrsState = schedMod.createDefaultFsrsState;

    sessionsPOST = (await import('@/app/api/gemini/sessions/route')).POST;
    chatPOST = (await import('@/app/api/chat/route')).POST;
    NextRequest = (await import('next/server')).NextRequest;
  });

  beforeEach(async () => {
    await db.words.clear();
    await db.reviews.clear();
  });

  /**
   * Лёгкий сид локальной колоды (~20 слов) вместо импорта 500-словного starter_deck.json.
   * Сам импорт starter-deck покрыт unit-тестом localDeckService.test.ts; здесь нас интересует
   * СТЫК систем (gating -> pool -> routes -> FSRS), а не повторный импорт. Это держит journey
   * быстрым и не нагружает параллельный прогон `npm run test`.
   */
  async function seedLocalDeck(count: number): Promise<void> {
    const now = Date.now();
    const words: LocalWord[] = Array.from({ length: count }, (_, i) => ({
      profileId: PROFILE,
      id: 1000 + i,
      word: `語${i}`,
      reading: `ご${i}`,
      translation: `слово${i}`,
      category: LOCAL_DECK_NAME,
      source: 'starter',
      passive: createDefaultFsrsState(now),
      active: createDefaultFsrsState(now),
      contextExamples: [],
      tags: ['universal'],
    }));
    await db.words.bulkPut(words);
  }

  /** Промоутит первые N слов профиля в активный статус (симуляция пройденной разминки/квиза). */
  async function promoteWords(count: number): Promise<number[]> {
    const all = await getLocalWords(PROFILE, LOCAL_DECK_NAME);
    const targets = all.slice(0, count);
    const now = Date.now();
    for (const w of targets) {
      w.active = {
        ...w.active,
        status: 'review',
        stability: 10,
        difficulty: 5,
        interval: 10,
        reps: 1,
        lapses: 0,
        due: now - 1000,
      };
    }
    await db.words.bulkPut(targets);
    return targets.map(w => w.id);
  }

  it('import -> gating -> sessions -> chat -> review: проходит весь путь', async () => {
    // 1. Колода заполнена (сид локального режима)
    await seedLocalDeck(20);
    const afterImport = await getLocalWords(PROFILE, LOCAL_DECK_NAME);
    expect(afterImport.length).toBeGreaterThanOrEqual(15);

    // 2. Gating: сразу после импорта все слова new -> вход в чат запрещён [PL-5.9]
    expect(canEnterChat(afterImport)).toBe(false);

    // 3. Пользователь "проходит разминку" -> 5 слов становятся активными
    await promoteWords(5);
    const afterPromote = await getLocalWords(PROFILE, LOCAL_DECK_NAME);
    expect(canEnterChat(afterPromote)).toBe(true);

    // 4. Формируется дневной пул слов для генерации сессий [PL-6]
    const pool = await getDailyActivePool(PROFILE, LOCAL_DECK_NAME);
    expect(pool.length).toBeGreaterThan(0);

    // 5. Генерация сессий через API-роут (Gemini замокан, форма ответа по [PL-5.3])
    const sessReq = new NextRequest('http://localhost/api/gemini/sessions', {
      method: 'POST',
      body: JSON.stringify({ words: pool }),
    });
    const sessRes = await sessionsPOST(sessReq);
    expect(sessRes.status).toBe(200);
    const sessJson = await sessRes.json();
    expect(Array.isArray(sessJson.sessions)).toBe(true);
    expect(sessJson.sessions).toHaveLength(3);

    // 6. Вход в чат: отправка хода через API-роут
    const session = sessJson.sessions[0];
    const chatReq = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        scenario: session.scenario,
        targetWords: session.targetWords,
        history: [],
        message: '半袖のシャツを選びます。',
        level: 2,
      }),
    });
    const chatRes = await chatPOST(chatReq);
    expect(chatRes.status).toBe(200);
    const chatJson = await chatRes.json();
    expect(chatJson.reply).toBeTruthy();
    expect(chatJson.wordsDetected).toContain('選ぶ');

    // 7. Сбор слова -> запись review -> FSRS продвигает карточку из new
    const promotedId = (await getLocalWords(PROFILE, LOCAL_DECK_NAME))
      .find(w => w.active.status === 'review')!.id;
    const dbWord = await db.words.get([PROFILE, promotedId]);
    const fsrs = calculateNextFsrsState(dbWord!, 3, 'active', new Date());
    expect(fsrs.newInterval).toBeGreaterThan(0);
    expect(fsrs.updatedWord.active.status).not.toBe('new');

    await db.words.put(fsrs.updatedWord);
    await addLocalReview({
      profileId: PROFILE,
      cardId: promotedId,
      ease: 3,
      interval: fsrs.newInterval,
      lastInterval: dbWord!.active.interval,
      duration: 3000,
      timestamp: Date.now(),
      synced: 0,
    });
    const unsynced = await getUnsyncedReviews(PROFILE);
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].cardId).toBe(promotedId);
  });

  it('gating blocks chat entry with fewer than 5 active words', async () => {
    await seedLocalDeck(20);
    await promoteWords(4);
    const words = await getLocalWords(PROFILE, LOCAL_DECK_NAME);
    expect(canEnterChat(words)).toBe(false);
  });
});

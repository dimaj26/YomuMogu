import { describe, it, expect } from 'vitest';
import { 
  alignToDayBoundary, 
  mapLocalToFsrsCard, 
  mapFsrsToLocalWord, 
  calculateNextFsrsState,
  createDefaultFsrsState,
  isGoodContextExample,
  canEnterChat
} from '../scheduler';
import type { LocalWord } from '../types';


describe('FSRS Scheduling logic', () => {
  it('should align date to local day boundary (04:00:00)', () => {
    const testDate = new Date('2026-05-22T15:30:45Z');
    const aligned = alignToDayBoundary(testDate);
    expect(aligned.getHours()).toBe(4);
    expect(aligned.getMinutes()).toBe(0);
    expect(aligned.getSeconds()).toBe(0);
    expect(aligned.getMilliseconds()).toBe(0);
  });

  it('should correctly map LocalWord to ts-fsrs Card', () => {
    const word: any = {
      profileId: 'test-user',
      id: 12345,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      status: 'review',
      deckName: 'Default',
      stability: 5.2,
      difficulty: 4.1,
      interval: 10,
      due: new Date('2026-05-22T00:00:00').getTime(),
      lastReview: new Date('2026-05-12T00:00:00').getTime(),
      reps: 3,
      lapses: 1
    };

    const card = mapLocalToFsrsCard(word);
    expect(card.stability).toBe(5.2);
    expect(card.difficulty).toBe(4.1);
    expect(card.scheduled_days).toBe(10);
    expect(card.state).toBe(2); // State.Review is 2
    expect(card.last_review?.getTime()).toBe(word.lastReview);
    expect(card.reps).toBe(3);
    expect(card.lapses).toBe(1);
  });

  it('should correctly map LocalWord to ts-fsrs Card with a reference date', () => {
    const word: any = {
      profileId: 'test-user',
      id: 12345,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      status: 'review',
      deckName: 'Default',
      stability: 5.2,
      difficulty: 4.1,
      interval: 10,
      due: new Date('2026-05-22T00:00:00').getTime(),
      lastReview: new Date('2026-05-12T00:00:00').getTime(),
      reps: 3,
      lapses: 1
    };

    const referenceDate = new Date('2026-05-17T00:00:00');
    const card = mapLocalToFsrsCard(word, referenceDate);
    expect(card.elapsed_days).toBe(5);
  });

  it('should calculate next state and return updated intervals', () => {
    const word: any = {
      profileId: 'test-user',
      id: 12345,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      status: 'new',
      deckName: 'Default',
      stability: 0,
      difficulty: 0,
      interval: 0,
      due: Date.now(),
      reps: 0,
      lapses: 0
    };

    // Повторяем слово с оценкой Good (3) - теперь оно должно сразу выпуститься в статус review с интервалом > 0 дней, так как краткосрочные шаги отключены
    const now = new Date('2026-05-22T12:00:00');
    const result = calculateNextFsrsState(word, 3, now);

    expect(result.updatedWord.status).toBe('review');
    expect(result.newInterval).toBeGreaterThan(0); // Интервал должен быть > 0 (обычно около 3 дней)
    expect(result.updatedWord.stability).toBeGreaterThan(0);
    expect(result.updatedWord.difficulty).toBeGreaterThan(0);
    expect(result.updatedWord.lastReview).toBe(now.getTime());
    expect(result.updatedWord.reps).toBe(1);
    expect(result.updatedWord.lapses).toBe(0);

    // Повторяем слово с оценкой Easy (4) - оно должно также сразу выпуститься с интервалом > 0 дней
    const resultEasy = calculateNextFsrsState(word, 4, now);
    expect(resultEasy.updatedWord.status).toBe('review');
    expect(resultEasy.newInterval).toBeGreaterThan(0);
    expect(resultEasy.updatedWord.reps).toBe(1);
    expect(resultEasy.updatedWord.lapses).toBe(0);

  });

  it('should always produce intervals in order: Again < Hard < Good < Easy for review cards', () => {
    const reviewWord: any = {
      profileId: 'test-user',
      id: 12345,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      status: 'review',
      deckName: 'Default',
      stability: 30,
      difficulty: 5.0,
      interval: 30,
      due: new Date('2026-04-20T04:00:00').getTime(),
      lastReview: new Date('2026-03-21T04:00:00').getTime(),
      reps: 5,
      lapses: 1
    };

    const now = new Date('2026-05-23T12:00:00');
    const again = calculateNextFsrsState(reviewWord, 1, now);
    const hard = calculateNextFsrsState(reviewWord, 2, now);
    const good = calculateNextFsrsState(reviewWord, 3, now);
    const easy = calculateNextFsrsState(reviewWord, 4, now);

    expect(again.newInterval).toBeLessThanOrEqual(hard.newInterval);
    expect(hard.newInterval).toBeLessThanOrEqual(good.newInterval);
    expect(good.newInterval).toBeLessThanOrEqual(easy.newInterval);
  });

  it('should always produce intervals in order: Again < Hard < Good < Easy for mature cards', () => {
    const matureWord: any = {
      profileId: 'test-user',
      id: 12345,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      status: 'mature',
      deckName: 'Default',
      stability: 100,
      difficulty: 4.0,
      interval: 60,
      due: new Date('2026-04-01T04:00:00').getTime(),
      lastReview: new Date('2026-02-01T04:00:00').getTime(),
      reps: 10,
      lapses: 0
    };

    const now = new Date('2026-05-23T12:00:00');
    const again = calculateNextFsrsState(matureWord, 1, now);
    const hard = calculateNextFsrsState(matureWord, 2, now);
    const good = calculateNextFsrsState(matureWord, 3, now);
    const easy = calculateNextFsrsState(matureWord, 4, now);

    expect(again.newInterval).toBeLessThanOrEqual(hard.newInterval);
    expect(hard.newInterval).toBeLessThanOrEqual(good.newInterval);
    expect(good.newInterval).toBeLessThanOrEqual(easy.newInterval);
  });

  it('should not produce absurdly inflated intervals for overdue cards rated Good', () => {
    // Карта с interval=30д, но overdue на 33 дня (elapsed=63, scheduled=30)
    const overdueWord: any = {
      profileId: 'test-user',
      id: 12345,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      status: 'review',
      deckName: 'Default',
      stability: 30,
      difficulty: 5.0,
      interval: 30,
      due: new Date('2026-04-20T04:00:00').getTime(),
      lastReview: new Date('2026-03-21T04:00:00').getTime(),
      reps: 5,
      lapses: 1
    };

    const now = new Date('2026-05-23T12:00:00');
    const result = calculateNextFsrsState(overdueWord, 3, now);
    
    // Хотя карта overdue, Good не должен давать интервал > 200 дней
    // для карты со stability=30
    expect(result.newInterval).toBeLessThan(200);
    expect(result.newInterval).toBeGreaterThan(0);
  });

  it('should not produce absurdly inflated intervals for new cards on first Good', () => {
    const newWord: any = {
      profileId: 'test-user',
      id: 12345,
      word: '新しい',
      reading: 'あたらしい',
      translation: 'новый',
      status: 'new',
      deckName: 'Default',
      stability: 0,
      difficulty: 0,
      interval: 0,
      due: Date.now(),
      reps: 0,
      lapses: 0
    };

    const now = new Date('2026-05-23T12:00:00');
    const result = calculateNextFsrsState(newWord, 3, now);
    
    // Первый Good на новой карте должен дать 1-5 дней, не больше
    expect(result.newInterval).toBeGreaterThan(0);
    expect(result.newInterval).toBeLessThanOrEqual(10);
  });

  it('should handle sequential reviews and maintain reasonable intervals', () => {
    // Симулируем: New → Good → Good → Good
    let word: any = {
      profileId: 'test-user',
      id: 12345,
      word: '走る',
      reading: 'はしる',
      translation: 'бежать',
      status: 'new',
      deckName: 'Default',
      stability: 0,
      difficulty: 0,
      interval: 0,
      due: Date.now(),
      reps: 0,
      lapses: 0
    };

    const dates = [
      new Date('2026-05-01T12:00:00'),
      new Date('2026-05-04T12:00:00'),  // +3 дня
      new Date('2026-05-15T12:00:00'),  // +11 дней
    ];

    let prevInterval = 0;
    for (const date of dates) {
      const result = calculateNextFsrsState(word, 3, date);
      // Каждый Good должен давать интервал >= предыдущего
      expect(result.newInterval).toBeGreaterThanOrEqual(prevInterval);
      // Но не более чем 10x предыдущего (защита от взрыва)
      if (prevInterval > 0) {
        expect(result.newInterval).toBeLessThanOrEqual(prevInterval * 10);
      }
      prevInterval = result.newInterval;
      word = result.updatedWord;
    }
  });

  // §2.6: dual-curve схлопнут — слово ведёт ЕДИНСТВЕННУЮ active-кривую.
  it('обновляет только active-кривую и не создаёт поле passive', () => {
    const word: LocalWord = {
      profileId: 'test-user',
      id: 99999,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: 'Japanese',
      source: 'manual',
      active: createDefaultFsrsState(new Date('2026-05-01T12:00:00').getTime())
    };

    const date = new Date('2026-05-01T12:00:00');
    const result = calculateNextFsrsState(word, 3, 'active', date);

    // active продвинулась
    expect(result.updatedWord.active.status).toBe('review');
    expect(result.updatedWord.active.reps).toBe(1);

    // пассивной кривой больше нет — поле passive не должно появляться
    expect(result.updatedWord.passive).toBeUndefined();
  });

  it('игнорирует устаревший тип "passive" и всё равно считает active-кривую', () => {
    const word: LocalWord = {
      profileId: 'test-user',
      id: 99998,
      word: '水',
      reading: 'みず',
      translation: 'вода',
      category: 'Japanese',
      source: 'manual',
      active: createDefaultFsrsState(new Date('2026-05-01T12:00:00').getTime())
    };

    const date = new Date('2026-05-01T12:00:00');
    const result = calculateNextFsrsState(word, 3, 'passive', date);

    expect(result.updatedWord.active.reps).toBe(1);
    expect(result.updatedWord.passive).toBeUndefined();
  });

  describe('isGoodContextExample', () => {
    it('should validate good sentences and reject poor context or simple copulas', () => {
      // 1. Слишком короткое
      expect(isGoodContextExample('猫です', '猫')).toBe(false);
      // 2. Нет падежей и нет кандзи вне слова
      expect(isGoodContextExample('ねこ 食べる', 'ねこ')).toBe(false);
      // 3. Отличный пример с частицей и кандзи
      expect(isGoodContextExample('私は毎日公園で猫を見ます。', '猫')).toBe(true);
      // 4. Простой шаблон объявления
      expect(isGoodContextExample('猫があります', '猫')).toBe(false);
      expect(isGoodContextExample('猫です', '猫')).toBe(false);
      // 5. Короткое, но с частицей (длина >= 8)
      expect(isGoodContextExample('寿司を食べます', '寿司')).toBe(true);
    });
  });

  describe('canEnterChat', () => {
    it('возвращает false при менее CHAT_MIN_ENTRY_WORDS слов learning/review', () => {
      const defaultState = { stability: 0, difficulty: 0, interval: 0, due: 0, reps: 0, lapses: 0, status: 'new' as const };
      
      // 1. Пустой массив
      expect(canEnterChat([])).toBe(false);

      // 2. 4 слова со статусом learning
      const words4: LocalWord[] = Array.from({ length: 4 }, (_, i) => ({
        profileId: 'test',
        id: i,
        word: `w${i}`,
        reading: `r${i}`,
        translation: `t${i}`,
        category: 'test',
        source: 'starter',
        active: { ...defaultState, status: 'learning' }
      }));
      expect(canEnterChat(words4)).toBe(false);

      // 3. Добавляем 5-е слово
      const words5: LocalWord[] = [...words4, {
        profileId: 'test',
        id: 4,
        word: 'w4',
        reading: 'r4',
        translation: 't4',
        category: 'test',
        source: 'starter',
        active: { ...defaultState, status: 'review' }
      }];
      expect(canEnterChat(words5)).toBe(true);

      // 4. Слова со статусом mature или new не должны считаться в лимит для входа в чат
      const mixWords: LocalWord[] = [
        ...words4,
        {
          profileId: 'test',
          id: 4,
          word: 'w4',
          reading: 'r4',
          translation: 't4',
          category: 'test',
          source: 'starter',
          active: { ...defaultState, status: 'mature' } // mature
        },
        {
          profileId: 'test',
          id: 5,
          word: 'w5',
          reading: 'r5',
          translation: 't5',
          category: 'test',
          source: 'starter',
          active: { ...defaultState, status: 'new' } // new
        }
      ];
      expect(canEnterChat(mixWords)).toBe(false);
    });
  });
});


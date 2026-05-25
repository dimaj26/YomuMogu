import { describe, it, expect } from 'vitest';
import { 
  alignToDayBoundary, 
  mapLocalToFsrsCard, 
  mapFsrsToLocalWord, 
  calculateNextFsrsState 
} from '../scheduler';
import type { LocalWord } from '../db';

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
    const word: LocalWord = {
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
    const word: LocalWord = {
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
    const word: LocalWord = {
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
    const reviewWord: LocalWord = {
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
    const matureWord: LocalWord = {
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
    const overdueWord: LocalWord = {
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
    const newWord: LocalWord = {
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
    let word: LocalWord = {
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
});

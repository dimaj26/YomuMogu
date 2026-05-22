import { describe, it, expect } from 'vitest';
import { 
  alignToDayBoundary, 
  mapLocalToFsrsCard, 
  mapFsrsToLocalWord, 
  calculateNextFsrsState 
} from '../fsrs';
import type { LocalWord } from '../../db';

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

    // Повторяем слово с оценкой Good (3)
    const now = new Date('2026-05-22T12:00:00');
    const result = calculateNextFsrsState(word, 3, now);

    expect(result.updatedWord.status).toBe('learning');
    expect(result.newInterval).toBe(0); // В фазе обучения интервал равен 0 дней (повторение сегодня)
    expect(result.updatedWord.stability).toBeGreaterThan(0);
    expect(result.updatedWord.difficulty).toBeGreaterThan(0);
    expect(result.updatedWord.lastReview).toBe(now.getTime());
    expect(result.updatedWord.reps).toBe(1);
    expect(result.updatedWord.lapses).toBe(0);

    // Повторяем слово с оценкой Easy (4) - оно должно сразу выпуститься с интервалом > 0 дней
    const resultEasy = calculateNextFsrsState(word, 4, now);
    expect(resultEasy.updatedWord.status).toBe('review');
    expect(resultEasy.newInterval).toBeGreaterThan(0);
    expect(resultEasy.updatedWord.reps).toBe(1);
    expect(resultEasy.updatedWord.lapses).toBe(0);
  });
});


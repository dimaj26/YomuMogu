import { describe, it, expect } from 'vitest';
import { assessKaraokeQuality } from '../karaokeQuality';
import { SubtitleSegment } from '../parser';

describe('assessKaraokeQuality', () => {
  it('words отсутствует — отказ', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5,
      text: 'こんにちは世界'
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('words');
  });

  it('words пустой или содержит меньше 3 слов — отказ', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5,
      text: 'こんにちは世界',
      words: [
        { text: 'こんにちは', offsetMs: 100 },
        { text: '世界', offsetMs: 500 }
      ]
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('меньше 3 слов');
  });

  it('плейсхолдерный сегмент ручных субтитров не проходит гейт', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5,
      text: 'こんにちは世界',
      words: [
        { text: 'こんにちは世界', offsetMs: 0 }
      ]
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('меньше 3 слов');
  });

  it('доля offsetMs > 0 ниже 0.8 — отказ', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5,
      text: 'A B C D E',
      words: [
        { text: 'A', offsetMs: 0 },
        { text: 'B', offsetMs: 0 },
        { text: 'C', offsetMs: 0 },
        { text: 'D', offsetMs: 500 },
        { text: 'E', offsetMs: 1000 }
      ]
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('доля offsetMs > 0');
  });

  it('немонотонные оффсеты — отказ', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5,
      text: 'A B C',
      words: [
        { text: 'A', offsetMs: 100 },
        { text: 'B', offsetMs: 500 },
        { text: 'C', offsetMs: 300 }
      ]
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('монотонность');
  });

  it('оффсет выходит за рамки длительности сегмента — отказ', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5, // 5000 ms
      text: 'A B C',
      words: [
        { text: 'A', offsetMs: 100 },
        { text: 'B', offsetMs: 500 },
        { text: 'C', offsetMs: 6000 }
      ]
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('выходит за рамки длительности');
  });

  it('плотный монотонный ASR-сегмент — допуск', () => {
    const segment: SubtitleSegment = {
      start: 0,
      duration: 5,
      text: 'A B C D',
      words: [
        { text: 'A', offsetMs: 100 },
        { text: 'B', offsetMs: 500 },
        { text: 'C', offsetMs: 1000 },
        { text: 'D', offsetMs: 1500 }
      ]
    };
    const result = assessKaraokeQuality(segment);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('');
  });
});

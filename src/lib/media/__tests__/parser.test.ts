import { describe, it, expect } from 'vitest';
import { normalizeSegments, SubtitleSegment } from '../parser';

describe('normalizeSegments', () => {
  it('сегмент с duration=0 получает длительность до старта следующего', () => {
    const input: SubtitleSegment[] = [
      { start: 1.0, duration: 0, text: 'Первый' },
      { start: 3.5, duration: 1.5, text: 'Второй' },
    ];
    const output = normalizeSegments(input);
    expect(output[0].duration).toBe(2.5); // 3.5 - 1.0 = 2.5
    expect(output[1].duration).toBe(1.5);
  });

  it('ограничивает длительность сегмента, если он перекрывает следующий (overlap clamp)', () => {
    const input: SubtitleSegment[] = [
      { start: 1.0, duration: 4.0, text: 'Первый' }, // Заходит на территорию второго (1.0 + 4.0 = 5.0 > 3.0)
      { start: 3.0, duration: 2.0, text: 'Второй' },
    ];
    const output = normalizeSegments(input);
    expect(output[0].duration).toBe(2.0); // 3.0 - 1.0 = 2.0
    expect(output[1].duration).toBe(2.0);
  });

  it('для последнего сегмента рассчитывает длительность на основе длины текста с ограничением', () => {
    // Длина текста 12 символов. textLen / 6 = 2 секунды. min(10, 2) = 2. max(0, 2) = 2.
    const inputShort: SubtitleSegment[] = [
      { start: 1.0, duration: 0, text: '123456789012' }
    ];
    const outputShort = normalizeSegments(inputShort);
    expect(outputShort[0].duration).toBe(2);

    // Длина текста 90 символов. textLen / 6 = 15 секунд. min(10, 15) = 10. max(0, 10) = 10.
    const longText = 'А'.repeat(90);
    const inputLong: SubtitleSegment[] = [
      { start: 1.0, duration: 0, text: longText }
    ];
    const outputLong = normalizeSegments(inputLong);
    expect(outputLong[0].duration).toBe(10);
  });

  it('сохраняет дополнительные поля words и source', () => {
    const input: SubtitleSegment[] = [
      { 
        start: 1.0, 
        duration: 1.0, 
        text: 'Тест',
        words: [{ text: 'Тест', offsetMs: 0 }],
        source: 'scraped'
      } as any
    ];
    const output = normalizeSegments(input);
    expect(output[0].words).toEqual([{ text: 'Тест', offsetMs: 0 }]);
    expect(output[0].source).toBe('scraped');
  });

  it('сортирует сегменты по времени начала', () => {
    const input: SubtitleSegment[] = [
      { start: 5.0, duration: 1.0, text: 'Второй' },
      { start: 2.0, duration: 1.0, text: 'Первый' },
    ];
    const output = normalizeSegments(input);
    expect(output[0].start).toBe(2.0);
    expect(output[0].text).toBe('Первый');
    expect(output[1].start).toBe(5.0);
    expect(output[1].text).toBe('Второй');
  });
});

import { describe, it, expect } from 'vitest';
import { regroupIntoSentences } from '../sentences';
import { SubtitleSegment } from '../parser';

describe('regroupIntoSentences', () => {
  it('склеивает сегменты до терминальной пунктуации', () => {
    const input: SubtitleSegment[] = [
      { start: 1.0, duration: 1.5, text: 'こんにちは' },
      { start: 2.5, duration: 1.0, text: '世界。' },
      { start: 4.0, duration: 1.0, text: '元気？' },
      { start: 5.5, duration: 2.0, text: 'テストです！' },
      { start: 8.0, duration: 1.0, text: '終わり' }
    ];

    const result = regroupIntoSentences(input);

    expect(result).toEqual([
      { start: 1.0, duration: 2.5, text: 'こんにちは世界。' }, // 1.0 до 3.5 (2.5+1.0)
      { start: 4.0, duration: 1.0, text: '元気？' },
      { start: 5.5, duration: 2.0, text: 'テストです！' },
      { start: 8.0, duration: 1.0, text: '終わり' } // Конец без пунктуации остается как есть
    ]);
  });

  it('принудительный разрыв по капу 90 символов', () => {
    const input: SubtitleSegment[] = [
      { start: 0.0, duration: 2.0, text: 'A'.repeat(50) },
      { start: 2.0, duration: 2.0, text: 'B'.repeat(50) } // В сумме 100 символов > 90
    ];

    const result = regroupIntoSentences(input);
    expect(result).toHaveLength(2); // Должен быть разрыв
    expect(result[0].text).toBe('A'.repeat(50));
    expect(result[1].text).toBe('B'.repeat(50));
  });

  it('принудительный разрыв по капу 15 секунд', () => {
    const input: SubtitleSegment[] = [
      { start: 0.0, duration: 8.0, text: 'A' },
      { start: 8.0, duration: 8.0, text: 'B' } // В сумме 16 секунд > 15
    ];

    const result = regroupIntoSentences(input);
    expect(result).toHaveLength(2); // Должен быть разрыв
    expect(result[0].duration).toBe(8.0);
    expect(result[1].duration).toBe(8.0);
  });

  it('words ребейзятся к началу склеенного сегмента', () => {
    const input: SubtitleSegment[] = [
      { 
        start: 1.0, 
        duration: 1.0, 
        text: 'A',
        words: [{ text: 'A', offsetMs: 100 }]
      },
      { 
        start: 2.5, 
        duration: 1.0, 
        text: 'B。',
        words: [{ text: 'B', offsetMs: 200 }]
      }
    ];

    const result = regroupIntoSentences(input);

    expect(result).toHaveLength(1);
    expect(result[0].start).toBe(1.0);
    expect(result[0].duration).toBe(2.5); // (2.5+1.0) - 1.0 = 2.5
    expect(result[0].text).toBe('AB。');
    expect(result[0].words).toEqual([
      { text: 'A', offsetMs: 100 },
      { text: 'B', offsetMs: 1700 } // 200 + (2.5 - 1.0) * 1000 = 1700
    ]);
  });
});

import { describe, it, expect } from 'vitest';
import { convertJson3ToSegments } from '../extension/convert.js';

describe('convertJson3ToSegments', () => {
  it('конвертирует json3 events в SubtitleSegment[] с корректными start/duration', () => {
    const mockJson3 = {
      events: [
        {
          tStartMs: 1000,
          dDurationMs: 2000,
          segs: [{ utf8: '今日' }]
        },
        {
          tStartMs: 3500,
          dDurationMs: 1500,
          segs: [{ utf8: '天気' }, { utf8: 'がいい' }]
        },
        {
          tStartMs: 5000,
          segs: [] // Без segs — должен быть пропущен
        },
        {
          tStartMs: 6000,
          dDurationMs: 1000,
          segs: [{ utf8: '  ' }] // Пустая строка после trim — должна быть пропущена
        }
      ]
    };

    const result = convertJson3ToSegments(mockJson3);

    expect(result).toEqual([
      { start: 1, duration: 2, text: '今日' },
      { start: 3.5, duration: 1.5, text: '天気がいい' }
    ]);
  });

  it('возвращает пустой массив, если данные некорректны или пусты', () => {
    expect(convertJson3ToSegments(null)).toEqual([]);
    expect(convertJson3ToSegments({})).toEqual([]);
    expect(convertJson3ToSegments({ events: [] })).toEqual([]);
  });
});

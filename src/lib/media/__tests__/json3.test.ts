import { describe, it, expect } from 'vitest';
import { parseJson3ToSegments } from '../json3';

describe('parseJson3ToSegments', () => {
  it('парсит события json3 в сегменты с пословными offsetMs', () => {
    const json3Data = {
      events: [
        {
          tStartMs: 1000,
          dDurationMs: 2000,
          segs: [
            { utf8: '今日', tOffsetMs: 0 },
            { utf8: 'は', tOffsetMs: 500 }
          ]
        },
        {
          tStartMs: 3500,
          dDurationMs: 1500,
          segs: [
            { utf8: '天気', tOffsetMs: 0 },
            { utf8: 'がいい', tOffsetMs: 800 }
          ]
        }
      ]
    };

    const segments = parseJson3ToSegments(json3Data);

    expect(segments).toEqual([
      {
        start: 1.0,
        duration: 2.0,
        text: '今日は',
        words: [
          { text: '今日', offsetMs: 0 },
          { text: 'は', offsetMs: 500 }
        ]
      },
      {
        start: 3.5,
        duration: 1.5,
        text: '天気がいい',
        words: [
          { text: '天気', offsetMs: 0 },
          { text: 'がいい', offsetMs: 800 }
        ]
      }
    ]);
  });
});

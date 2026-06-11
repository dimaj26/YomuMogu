import { describe, it, expect } from 'vitest';
import {
  RANKING_CONSTANTS,
  assessSubtitleQuality,
  computeLevelFit,
  rankCandidates,
  ScoredCandidate
} from '../ranking';
import { SubtitleSegment } from '../parser';

describe('Video Ranking Engine', () => {
  it('RANKING_CONSTANTS соответствуют контракту', () => {
    expect(RANKING_CONSTANTS.CR_WINDOW).toEqual([0.85, 0.98]);
    expect(RANKING_CONSTANTS.WEIGHTS.levelFit).toBe(0.6);
    expect(RANKING_CONSTANTS.WEIGHTS.subQuality).toBe(0.4);
    expect(RANKING_CONSTANTS.SUB_QUALITY_FLOOR).toBe(0.3);
  });

  it('CR внутри окна → levelFit=1, вне окна — линейный штраф', () => {
    // Внутри окна: 0.85 - 0.98
    expect(computeLevelFit(0.90)).toBe(1.0);
    expect(computeLevelFit(0.85)).toBe(1.0);
    expect(computeLevelFit(0.98)).toBe(1.0);
    
    // Ниже окна: линейно падает от 0.85 (1.0) до 0.0 (0.0) -> f(x) = x / 0.85
    expect(computeLevelFit(0.425)).toBeCloseTo(0.5, 5);
    expect(computeLevelFit(0.0)).toBe(0.0);
    
    // Выше окна: линейно падает от 0.98 (1.0) до 1.0 (0.0) -> f(x) = (1.0 - x) / (1.0 - 0.98) = (1.0 - x) / 0.02
    expect(computeLevelFit(0.99)).toBeCloseTo(0.5, 5);
    expect(computeLevelFit(1.0)).toBe(0.0);
  });

  it('ручной трек не штрафуется за отсутствие пословных таймингов', () => {
    const segments: SubtitleSegment[] = [
      { start: 0, duration: 2, text: 'あいうえお' },
      { start: 2, duration: 2, text: 'かきくけこ' },
      { start: 4, duration: 2, text: 'さしすせそ' }
    ];
    // manual-трек: нет words (таймингов слов) - не штрафуется. Качество должно быть высоким.
    const quality = assessSubtitleQuality('manual', segments);
    expect(quality).toBeGreaterThanOrEqual(0.8);
  });

  it('ASR-трек получает тайминговую компоненту через assessKaraokeQuality', () => {
    // У ASR-трека без таймингов слов качество падает ниже 0.3
    const badASR: SubtitleSegment[] = [
      { start: 0, duration: 2, text: 'あいうえお' },
      { start: 2, duration: 2, text: 'かきくけこ' },
      { start: 4, duration: 2, text: 'さしすсесо' }
    ];
    const badQuality = assessSubtitleQuality('asr', badASR);
    expect(badQuality).toBeLessThan(0.3);

    // С хорошими таймингами слов качество высокое
    const goodASR: SubtitleSegment[] = [
      {
        start: 0,
        duration: 2,
        text: 'A B C',
        words: [
          { text: 'A', offsetMs: 100 },
          { text: 'B', offsetMs: 500 },
          { text: 'C', offsetMs: 1000 }
        ]
      },
      {
        start: 2,
        duration: 2,
        text: 'D E F',
        words: [
          { text: 'D', offsetMs: 100 },
          { text: 'E', offsetMs: 500 },
          { text: 'F', offsetMs: 1000 }
        ]
      },
      {
        start: 4,
        duration: 2,
        text: 'G H I',
        words: [
          { text: 'G', offsetMs: 100 },
          { text: 'H', offsetMs: 500 },
          { text: 'I', offsetMs: 1000 }
        ]
      }
    ];
    const goodQuality = assessSubtitleQuality('asr', goodASR);
    expect(goodQuality).toBeGreaterThanOrEqual(0.7);
  });

  it('кандидат без ja-субтитров отсечён гейтом или subQuality < 0.3 отсечён', () => {
    const scored: ScoredCandidate[] = [
      {
        candidate: { videoId: 'v1', title: 'Video 1', channel: 'Ch 1' },
        trackKind: 'asr',
        segments: [], // Пустые субтитры -> subQuality < 0.3
        cr: 0.9,
        subQuality: 0.1,
        levelFit: 1.0,
        score: 0.0
      },
      {
        candidate: { videoId: 'v2', title: 'Video 2', channel: 'Ch 2' },
        trackKind: 'manual',
        segments: [{ start: 0, duration: 5, text: 'テスト' }],
        cr: 0.90,
        subQuality: 0.8,
        levelFit: 1.0,
        score: 0.0
      }
    ];

    const ranked = rankCandidates(scored);
    expect(ranked.length).toBe(1);
    expect(ranked[0].candidate.videoId).toBe('v2');
  });

  it('итоговый ранг = 0.6·levelFit + 0.4·subQuality', () => {
    const scored: ScoredCandidate[] = [
      {
        candidate: { videoId: 'v1', title: 'V1', channel: 'C1' },
        trackKind: 'manual',
        segments: [{ start: 0, duration: 5, text: 'テスト' }],
        cr: 0.9,
        subQuality: 0.8, // 0.8 * 0.4 = 0.32
        levelFit: 1.0,   // 1.0 * 0.6 = 0.60
        score: 0.0       // total = 0.92
      },
      {
        candidate: { videoId: 'v2', title: 'V2', channel: 'C2' },
        trackKind: 'manual',
        segments: [{ start: 0, duration: 5, text: 'テスト' }],
        cr: 0.9,
        subQuality: 0.9, // 0.9 * 0.4 = 0.36
        levelFit: 1.0,   // 1.0 * 0.6 = 0.60
        score: 0.0       // total = 0.96
      }
    ];

    const ranked = rankCandidates(scored);
    expect(ranked[0].candidate.videoId).toBe('v2');
    expect(ranked[0].score).toBeCloseTo(0.96, 5);
    expect(ranked[1].candidate.videoId).toBe('v1');
    expect(ranked[1].score).toBeCloseTo(0.92, 5);
  });

  it('пустая выдача (все отсечены) → окно расширяется до ближайших кандидатов', () => {
    // В обычной ситуации все кандидаты имеют subQuality < 0.3 или cr вне оптимального,
    // но если абсолютно все отфильтрованы, мы возвращаем кандидатов, снижая строгий гейт subQuality,
    // то есть делаем фолбек, чтобы не показывать пустой список.
    const scored: ScoredCandidate[] = [
      {
        candidate: { videoId: 'v1', title: 'V1', channel: 'C1' },
        trackKind: 'asr',
        segments: [{ start: 0, duration: 5, text: 'A' }], // subQuality < 0.3
        cr: 0.9,
        subQuality: 0.2,
        levelFit: 1.0,
        score: 0.0
      },
      {
        candidate: { videoId: 'v2', title: 'V2', channel: 'C2' },
        trackKind: 'asr',
        segments: [{ start: 0, duration: 5, text: 'B' }], // subQuality < 0.3
        cr: 0.9,
        subQuality: 0.1,
        levelFit: 1.0,
        score: 0.0
      }
    ];

    const ranked = rankCandidates(scored);
    expect(ranked.length).toBe(2);
    expect(ranked[0].candidate.videoId).toBe('v1'); // v1 лучше по subQuality (0.2 > 0.1)
  });
});

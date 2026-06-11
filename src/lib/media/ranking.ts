import { SubtitleSegment } from './parser';
import { assessKaraokeQuality } from './karaokeQuality';
import { Candidate } from './search';

export type { Candidate };

export interface ScoredCandidate {
  candidate: Candidate;
  trackKind: 'manual' | 'asr';
  segments: SubtitleSegment[];
  cr: number; // Comprehension Rate
  subQuality: number;
  levelFit: number;
  score: number;
}

export const RANKING_CONSTANTS = {
  CR_WINDOW: [0.85, 0.98] as [number, number],
  WEIGHTS: {
    levelFit: 0.6,
    subQuality: 0.4
  },
  SUB_QUALITY_FLOOR: 0.3,
  MANUAL_TRACK_BONUS: 0.1
};

/**
 * Оценивает пригодность уровня видео для пользователя (Level Fit).
 * 1.0 внутри оптимального окна [0.85, 0.98], линейно снижается до 0 вне окна.
 */
export function computeLevelFit(cr: number): number {
  const [minCr, maxCr] = RANKING_CONSTANTS.CR_WINDOW;
  if (cr >= minCr && cr <= maxCr) {
    return 1.0;
  }
  if (cr < minCr) {
    return Math.max(0, cr / minCr);
  }
  // cr > maxCr
  return Math.max(0, (1.0 - cr) / (1.0 - maxCr));
}

/**
 * Оценивает качество субтитров (Subtitle Quality) в диапазоне [0, 1].
 * Состоит из контентного качества (доля не-мусорных сегментов)
 * и таймингового качества (для ASR - прохождение караоке гейта).
 */
export function assessSubtitleQuality(trackKind: 'manual' | 'asr', segments: SubtitleSegment[]): number {
  if (!segments || segments.length === 0) {
    return 0;
  }

  let junkCount = 0;
  let eligibleCount = 0;

  for (const seg of segments) {
    const trimmed = seg.text ? seg.text.trim() : '';
    // Мусорными считаются пустые сегменты, плашки с музыкальными нотами ♪ или слишком короткие фразы
    const isJunk = trimmed === '' || trimmed.includes('♪') || trimmed.length < 2;
    if (isJunk) {
      junkCount++;
    }

    if (trackKind === 'asr') {
      const gate = assessKaraokeQuality(seg);
      if (gate.eligible) {
        eligibleCount++;
      }
    }
  }

  const junkShare = junkCount / segments.length;
  const contentQuality = 1.0 - junkShare;

  if (trackKind === 'manual') {
    // Ручные субтитры получают бонус и не штрафуются за отсутствие пословных таймингов
    return Math.min(1.0, contentQuality + RANKING_CONSTANTS.MANUAL_TRACK_BONUS);
  } else {
    // ASR субтитры умножаются на долю сегментов, прошедших караоке гейт
    const timingComponent = eligibleCount / segments.length;
    return contentQuality * timingComponent;
  }
}

/**
 * Фильтрует и ранжирует кандидатов на основе взвешенной суммы оценок Level Fit и Subtitle Quality.
 * Если все кандидаты отсечены гейтом качества субтитров, снижает требования (фолбек на все).
 */
export function rankCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  // Вычисляем итоговый ранг
  const scored = candidates.map(c => {
    const score = RANKING_CONSTANTS.WEIGHTS.levelFit * c.levelFit +
                  RANKING_CONSTANTS.WEIGHTS.subQuality * c.subQuality;
    return { ...c, score };
  });

  // Отсекаем кандидатов с качеством субтитров ниже SUB_QUALITY_FLOOR
  let filtered = scored.filter(c => c.subQuality >= RANKING_CONSTANTS.SUB_QUALITY_FLOOR);

  // Фолбек: если все отсечены, расслабляем гейт
  if (filtered.length === 0) {
    filtered = [...scored];
  }

  // Сортируем по убыванию итогового балла
  return filtered.sort((a, b) => b.score - a.score);
}

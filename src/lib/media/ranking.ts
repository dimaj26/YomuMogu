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
  durationFit?: number; // Пригодность длины ролика под уровень (заполняется в rankCandidates)
  score: number;
}

// Уровневые тиры подбора: новичку нужен короткий поддержанный контент при низкой понятности
// (familiarization), продвинутому — высокое покрытие (incidental acquisition).
export type MediaTier = 'beginner' | 'bridge' | 'acquisition';

interface RankingProfile {
  crWindow: [number, number];   // окно оптимальной понятности (levelFit=1 внутри)
  levelFitFloor: number;        // нижний предел levelFit для cr ниже окна (новичка не отсекаем в 0)
  maxDurationSec: number;       // длиннее → durationFit падает; Infinity = без лимита
  weights: { levelFit: number; subQuality: number; durationFit: number };
  penalizeMusicJunk: boolean;   // считать ли ♪-сегменты мусором (для новичка — нет)
}

export const RANKING_PROFILES: Record<MediaTier, RankingProfile> = {
  beginner: {
    crWindow: [0.20, 0.70],
    levelFitFloor: 0.4,
    maxDurationSec: 90,
    weights: { levelFit: 0.2, subQuality: 0.3, durationFit: 0.5 },
    penalizeMusicJunk: false,
  },
  bridge: {
    crWindow: [0.40, 0.85],
    levelFitFloor: 0.25,
    maxDurationSec: 240,
    weights: { levelFit: 0.4, subQuality: 0.3, durationFit: 0.3 },
    penalizeMusicJunk: true,
  },
  acquisition: {
    crWindow: [0.85, 0.98],
    levelFitFloor: 0,
    maxDurationSec: Infinity,
    weights: { levelFit: 0.6, subQuality: 0.4, durationFit: 0 },
    penalizeMusicJunk: true,
  },
};

// Обратная совместимость: контракт продвинутого тира (acquisition) как набор констант.
export const RANKING_CONSTANTS = {
  CR_WINDOW: RANKING_PROFILES.acquisition.crWindow,
  WEIGHTS: {
    levelFit: RANKING_PROFILES.acquisition.weights.levelFit,
    subQuality: RANKING_PROFILES.acquisition.weights.subQuality
  },
  SUB_QUALITY_FLOOR: 0.3,
  MANUAL_TRACK_BONUS: 0.1
};

/**
 * Оценивает пригодность уровня видео для пользователя (Level Fit) с учётом тира.
 * 1.0 внутри окна тира; ниже окна — линейный спад, но не ниже levelFitFloor тира;
 * выше окна — линейный спад до 0 (слишком лёгкий контент не нужен).
 */
export function computeLevelFit(cr: number, tier: MediaTier = 'acquisition'): number {
  const { crWindow, levelFitFloor } = RANKING_PROFILES[tier];
  const [minCr, maxCr] = crWindow;
  if (cr >= minCr && cr <= maxCr) {
    return 1.0;
  }
  if (cr < minCr) {
    const linear = minCr > 0 ? cr / minCr : 0;
    return Math.max(levelFitFloor, linear);
  }
  // cr > maxCr
  const denom = 1.0 - maxCr;
  const linear = denom > 0 ? (1.0 - cr) / denom : 0;
  return Math.max(0, linear);
}

/**
 * Оценивает пригодность длины ролика под тир.
 * 1.0 если длина в пределах maxDurationSec (или неизвестна, или лимита нет);
 * выше лимита — гиперболический спад maxDurationSec / durationSec.
 */
export function computeDurationFit(durationSec: number | undefined, tier: MediaTier = 'acquisition'): number {
  const { maxDurationSec } = RANKING_PROFILES[tier];
  // Неизвестная длина не штрафуется — не отсекаем кандидата только из-за отсутствия метаданных.
  if (durationSec === undefined || durationSec <= 0) return 1;
  if (!isFinite(maxDurationSec)) return 1;
  if (durationSec <= maxDurationSec) return 1;
  return Math.max(0, maxDurationSec / durationSec);
}

/**
 * Оценивает качество субтитров (Subtitle Quality) в диапазоне [0, 1].
 * Состоит из контентного качества (доля не-мусорных сегментов)
 * и таймингового качества (для ASR - прохождение караоке гейта).
 * Для тира beginner ♪-сегменты не считаются мусором (полезный музыкальный/детский контент).
 */
export function assessSubtitleQuality(
  trackKind: 'manual' | 'asr',
  segments: SubtitleSegment[],
  tier: MediaTier = 'acquisition'
): number {
  if (!segments || segments.length === 0) {
    return 0;
  }

  const { penalizeMusicJunk } = RANKING_PROFILES[tier];

  let junkCount = 0;
  let eligibleCount = 0;

  for (const seg of segments) {
    const trimmed = seg.text ? seg.text.trim() : '';
    // Мусорными считаются пустые/слишком короткие сегменты; плашки с ♪ — только если тир их штрафует
    const isJunk = trimmed === '' || trimmed.length < 2 || (penalizeMusicJunk && trimmed.includes('♪'));
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
 * Фильтрует и ранжирует кандидатов на основе взвешенной суммы Level Fit, Subtitle Quality и Duration Fit
 * по весам выбранного тира. Если все кандидаты отсечены гейтом качества субтитров, делает фолбек на всех.
 */
export function rankCandidates(candidates: ScoredCandidate[], tier: MediaTier = 'acquisition'): ScoredCandidate[] {
  const profile = RANKING_PROFILES[tier];

  // Вычисляем durationFit и итоговый ранг
  const scored = candidates.map(c => {
    const durationFit = computeDurationFit(c.candidate.durationSec, tier);
    const score = profile.weights.levelFit * c.levelFit +
                  profile.weights.subQuality * c.subQuality +
                  profile.weights.durationFit * durationFit;
    return { ...c, durationFit, score };
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

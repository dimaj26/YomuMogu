// ЕДИНЫЙ РЕЕСТР ИНТЕРВАЛЬНЫХ СИСТЕМ YomuMogu.
// Правила: (1) этот файл не импортирует ничего из проекта; (2) каждая система
// импортирует ОТСЮДА только свои константы; (3) системы не зависят друг от друга;
// (4) изменение значения — только через Route B (аудит). Зеркало-документация: PROJECT_LOGIC [PL-10].

/** [СИСТЕМА 1] Dual-curve FSRS (лексика): интервалы рассчитывает ts-fsrs динамически.
 *  Констант здесь нет намеренно — НЕ дублировать параметры ts-fsrs. Владелец: core/scheduler.ts. */

/** [СИСТЕМА 2] Грамматика — лестница Лейтнера (дни между повторениями ступени). Владелец: grammar_progress. */
export const GRAMMAR_LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

/** [СИСТЕМА 3] Угасающая фуригана (дни active.interval). full < FADE_FROM; fade < HIDE_FROM; hidden >= HIDE_FROM. */
export const FURIGANA_FADE_FROM_DAYS = 3;
export const FURIGANA_HIDE_FROM_DAYS = 21;
/** Прозрачность rt для tier fade (используется в CSS-классе rtFade). */
export const FURIGANA_FADE_OPACITY = 0.6;

/** [СИСТЕМА 4] Fluency-режим: плоский лимит хода = max(FLOOR, (BASE_OFFSET + BASE_PER_LEVEL × уровень) × k[раунд]). */
export const FLUENCY_FLOOR_SECONDS = 20;
export const FLUENCY_BASE_OFFSET_SECONDS = 30;
export const FLUENCY_BASE_PER_LEVEL_SECONDS = 10;
export const FLUENCY_ROUND_FACTORS = { 1: 1.0, 2: 0.75, 3: 0.5 } as const;

/** [СИСТЕМА 5] Daily-квесты: граница суток (час локального времени). */
export const QUEST_RESET_HOUR = 4;

/** [СИСТЕМА 6] Компетентностный профиль и советник (Phase 4). */
export const COMPETENCY_MIN_SESSIONS = 3;
export const COMPETENCY_MIN_TURNS = 15;
export const COMPETENCY_SESSION_CAP = 10;
export const ADVICE_UP_GRAMMAR_COVERAGE = 0.7;
export const ADVICE_UP_CORRECTION_RATE = 0.8;
export const ADVICE_DOWN_CORRECTION_RATE = 0.4;
/** Порог «уровень лестницы закрыт» (LearningTrack): лексика и грамматика. */
export const LADDER_COMPLETE_LEX_COVERAGE = 0.8;
export const LADDER_COMPLETE_GRAMMAR_COVERAGE = 1.0;

/** [СИСТЕМА 7] Exposure Log и Mining (Phase 9b). Порог встреч слова вне колоды для предложения к добавлению. */
export const EXPOSURE_MINING_THRESHOLD = 5;

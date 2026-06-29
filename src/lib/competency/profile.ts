import type { LocalWord } from '../../core/types';
import jlptLevels from '../../resources/jlpt_levels.json';
import grammarRules from '../../resources/grammar_rules.json';
import {
  COMPETENCY_MIN_SESSIONS,
  COMPETENCY_MIN_TURNS,
  ADVICE_UP_GRAMMAR_COVERAGE,
  ADVICE_UP_CORRECTION_RATE,
  ADVICE_DOWN_CORRECTION_RATE,
  LADDER_COMPLETE_LEX_COVERAGE,
  LADDER_COMPLETE_GRAMMAR_COVERAGE
} from '../../core/intervals';

export type JlptLevelId = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface SessionStat {
  date: number;
  userTurns: number;
  correctTurns: number;
  chatLevel: number;
}

export interface CompetencyProfile {
  level: JlptLevelId;
  lexCoverage: number; // 0..1
  grammarCoverage: number; // 0..1
  recentCorrectionRate: number | null; // 0..1 or null if < MIN_SESSIONS
}

export interface PresetAdvice {
  suggestion: 'up' | 'down' | 'stay';
  reason: string;
}

/**
 * Рассчитывает лексическое покрытие (lexCoverage) для заданного уровня.
 * lexCoverage = (кол-во слов пользователя с тегом jlpt:level и активным статусом review/mature) / (каноническое кол-во слов уровня)
 * Результат ограничивается 1 (clamp to 1).
 */
export function computeLexCoverage(userWords: LocalWord[], level: JlptLevelId): number {
  const canonicalList = (jlptLevels.levels as Record<string, unknown[]>)[level];
  if (!canonicalList || canonicalList.length === 0) {
    return 0;
  }

  const targetTag = `jlpt:${level.toLowerCase()}`;
  let count = 0;
  for (const word of userWords) {
    const hasTag = word.tags?.includes(targetTag);
    const isActive = word.active?.status === 'review' || word.active?.status === 'mature';
    if (hasTag && isActive) {
      count++;
    }
  }

  return Math.min(1, count / canonicalList.length);
}

/**
 * Рассчитывает грамматическое покрытие (grammarCoverage) для заданного уровня.
 * grammarCoverage = (кол-во закрытых нод грамматики со статусом 'mature') / (кол-во авторских не-placeholder нод уровня)
 */
export function computeGrammarCoverage(
  progressMap: Record<string, { status: string }>,
  level: JlptLevelId
): number {
  const levelRules = grammarRules.filter(r => r.level === level && !r.isPlaceholder);
  if (levelRules.length === 0) {
    return 0;
  }

  let closedCount = 0;
  for (const rule of levelRules) {
    const progress = progressMap[rule.id];
    if (progress && progress.status === 'mature') {
      closedCount++;
    }
  }

  return closedCount / levelRules.length;
}

/**
 * Рассчитывает недавний показатель верных ответов (recentCorrectionRate) по последним 3 сессиям.
 * Возвращает null, если сессий меньше 3 или общее кол-во ходов за последние 3 сессии меньше 15.
 */
export function computeRecentCorrectionRate(sessions: SessionStat[]): number | null {
  if (sessions.length < COMPETENCY_MIN_SESSIONS) {
    return null;
  }

  const lastThree = sessions.slice(-COMPETENCY_MIN_SESSIONS);
  let totalUserTurns = 0;
  let totalCorrectTurns = 0;

  for (const s of lastThree) {
    totalUserTurns += s.userTurns;
    totalCorrectTurns += s.correctTurns;
  }

  if (totalUserTurns < COMPETENCY_MIN_TURNS) {
    return null;
  }

  return totalCorrectTurns / totalUserTurns;
}

/**
 * Строит профиль компетентности на основе данных пользователя.
 * Версия 1: уровень (level) жестко зафиксирован как 'N5'.
 */
export function buildCompetencyProfile(
  userWords: LocalWord[],
  progressMap: Record<string, { status: string }>,
  sessions: SessionStat[]
): CompetencyProfile {
  const level: JlptLevelId = 'N5';
  const lexCoverage = computeLexCoverage(userWords, level);
  const grammarCoverage = computeGrammarCoverage(progressMap, level);
  const recentCorrectionRate = computeRecentCorrectionRate(sessions);

  return {
    level,
    lexCoverage,
    grammarCoverage,
    recentCorrectionRate
  };
}

/** Покрытие одного уровня: лексика + грамматика (0..1). */
export interface LevelCoverage {
  lexCoverage: number;
  grammarCoverage: number;
}

const ALL_JLPT_LEVELS: JlptLevelId[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

/**
 * Считает лексическое и грамматическое покрытие для ВСЕХ пяти уровней JLPT (N5–N1),
 * переиспользуя существующие per-level хелперы. Версия 1 движка считала только N5 —
 * из-за чего N4–N1 навсегда оставались «заблокированными» (004 C-07/C-08).
 */
export function computeAllLevelCoverages(
  userWords: LocalWord[],
  progressMap: Record<string, { status: string }>
): Partial<Record<JlptLevelId, LevelCoverage>> {
  const result: Partial<Record<JlptLevelId, LevelCoverage>> = {};
  for (const level of ALL_JLPT_LEVELS) {
    result[level] = {
      lexCoverage: computeLexCoverage(userWords, level),
      grammarCoverage: computeGrammarCoverage(progressMap, level)
    };
  }
  return result;
}

/**
 * Выводит реальный рабочий уровень из покрытий по тому же правилу, что использует
 * LearningTrack.isLevelCompleted: уровень завершён ⟺ lex ≥ LADDER_COMPLETE_LEX_COVERAGE
 * И grammar ≥ LADDER_COMPLETE_GRAMMAR_COVERAGE. Активный уровень — первый незавершённый
 * в порядке N5→N1. Если завершены все — 'N1'; если данных нет — 'N5'.
 */
export function deriveActiveLevel(
  coverages: Partial<Record<JlptLevelId, LevelCoverage>>
): JlptLevelId {
  for (const level of ALL_JLPT_LEVELS) {
    const c = coverages[level];
    const completed =
      !!c &&
      c.lexCoverage >= LADDER_COMPLETE_LEX_COVERAGE &&
      c.grammarCoverage >= LADDER_COMPLETE_GRAMMAR_COVERAGE;
    if (!completed) {
      return level;
    }
  }
  return 'N1';
}

/**
 * Формирует рекомендацию по смене уровня сложности чата.
 * up: если грамматика >= 0.7 и точность >= 0.8 и текущий уровень < 5
 * down: если точность < 0.4 и текущий уровень > 1
 * stay: иначе
 */
export function getPresetAdvice(profile: CompetencyProfile, currentChatLevel: number): PresetAdvice {
  const { grammarCoverage, recentCorrectionRate } = profile;

  if (
    grammarCoverage >= ADVICE_UP_GRAMMAR_COVERAGE &&
    recentCorrectionRate !== null &&
    recentCorrectionRate >= ADVICE_UP_CORRECTION_RATE &&
    currentChatLevel < 5
  ) {
    const nextLevel = currentChatLevel + 1;
    const grammarPct = Math.round(grammarCoverage * 100);
    const ratePct = Math.round(recentCorrectionRate * 100);
    return {
      suggestion: 'up',
      reason: `Закрыто ${grammarPct}% грамматики N5, точность за последние сессии ${ratePct}% — попробуй уровень ${nextLevel}`
    };
  }

  if (recentCorrectionRate !== null && recentCorrectionRate < ADVICE_DOWN_CORRECTION_RATE && currentChatLevel > 1) {
    const prevLevel = currentChatLevel - 1;
    const ratePct = Math.round(recentCorrectionRate * 100);
    return {
      suggestion: 'down',
      reason: `Точность ответов за последние сессии снизилась до ${ratePct}% — рекомендуем вернуться на уровень ${prevLevel}`
    };
  }

  return {
    suggestion: 'stay',
    reason: 'Текущий уровень сложности соответствует твоим знаниям.'
  };
}

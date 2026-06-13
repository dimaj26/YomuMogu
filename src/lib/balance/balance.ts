import type { JlptLevelId } from '../competency/profile';
import {
  BALANCE_STRUCTURE_TARGET,
  BALANCE_ACTIVITY_WINDOW,
  BALANCE_MIN_ACTIVITIES
} from '../../core/intervals';

export type Strand = 'structure' | 'immersion';

/**
 * Возвращает рекомендуемую долю структурных занятий для заданного уровня JLPT.
 */
export function getRecommendedStructureShare(level: JlptLevelId): number {
  return BALANCE_STRUCTURE_TARGET[level] ?? 0.2;
}

/**
 * Вычисляет фактическую долю структурных занятий в логе активности за последнее скользящее окно.
 * Возвращает null, если количество записей меньше минимального порога.
 */
export function computeActualShare(log: Strand[]): number | null {
  if (!log || log.length < BALANCE_MIN_ACTIVITIES) {
    return null;
  }

  // Берем последние BALANCE_ACTIVITY_WINDOW записей
  const recentLog = log.slice(-BALANCE_ACTIVITY_WINDOW);
  const structureCount = recentLog.filter(item => item === 'structure').length;

  return structureCount / recentLog.length;
}

interface BalanceHint {
  recommended: number;
  actual: number | null;
  message: string;
}

/**
 * Возвращает рекомендацию по балансу структуры и иммерсии на основе текущего уровня и лога активности.
 * Сообщения носят исключительно информационный и не принуждающий характер.
 */
export function getBalanceHint(level: JlptLevelId, log: Strand[]): BalanceHint {
  const recommended = getRecommendedStructureShare(level);
  const actual = computeActualShare(log);

  if (actual === null) {
    return {
      recommended,
      actual,
      message: 'Занимайся как удобно — со временем покажем баланс'
    };
  }

  const diff = actual - recommended;

  if (Math.abs(diff) <= 0.15) {
    return {
      recommended,
      actual,
      message: 'Хороший баланс структуры и реального материала'
    };
  } else if (diff > 0.15) {
    return {
      recommended,
      actual,
      message: 'Много структуры — попробуй больше чата и медиа'
    };
  } else {
    return {
      recommended,
      actual,
      message: 'Много практики — добавь немного грамматики/квизов'
    };
  }
}

/**
 * Добавляет новое действие в лог активности с соблюдением ограничения на максимальный размер окна.
 */
export function recordActivity(strand: Strand, log: Strand[]): Strand[] {
  const newLog = [...log, strand];
  if (newLog.length > BALANCE_ACTIVITY_WINDOW) {
    return newLog.slice(newLog.length - BALANCE_ACTIVITY_WINDOW);
  }
  return newLog;
}

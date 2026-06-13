// Модуль для поддержки режима беглости (Timed Scenario Replay)
// Все расчеты времени и фильтрации производятся в чистых функциях.
import {
  FLUENCY_FLOOR_SECONDS,
  FLUENCY_BASE_OFFSET_SECONDS,
  FLUENCY_BASE_PER_LEVEL_SECONDS,
  FLUENCY_ROUND_FACTORS
} from '../../core/intervals';

export interface FluencyTurn {
  ms: number;      // Фактическое время ответа пользователя в миллисекундах
  limitMs: number; // Лимит времени на ход в миллисекундах
}

/**
 * Возвращает лимит времени на ход в секундах.
 * Формула: max(20, Math.round((30 + 10 * chatLevel) * k))
 * k = 1.0 для раунда 1, 0.75 для раунда 2, 0.5 для раунда 3.
 */
export function getTurnLimit(round: 1 | 2 | 3, chatLevel: number): number {
  const k = FLUENCY_ROUND_FACTORS[round] ?? 1.0;
  const base = FLUENCY_BASE_OFFSET_SECONDS + FLUENCY_BASE_PER_LEVEL_SECONDS * chatLevel;
  return Math.max(FLUENCY_FLOOR_SECONDS, Math.round(base * k));
}

/**
 * Создает новую replay-сессию на базе существующей с суффиксом ID и флагами беглости.
 */
export function buildFluencyReplaySession<T extends { id: string }>(
  session: T,
  round: 1 | 2 | 3
): T & { id: string; fluencyMode: true; fluencyRound: 1 | 2 | 3 } {
  return {
    ...session,
    id: `${session.id}-fluency-${Date.now()}`,
    fluencyMode: true,
    fluencyRound: round,
  };
}

/**
 * Фильтрует разрешенную грамматику для режима беглости.
 * Оставляет только mature-ноды.
 */
export function filterScopeForFluency(
  allowed: Array<{ id: string; construction: string }>,
  progressMap: Record<string, { status: string }>
): Array<{ id: string; construction: string }> {
  return allowed.filter(node => progressMap[node.id]?.status === 'mature');
}

/**
 * Рассчитывает статистику сессии беглости.
 */
export function computeFluencyStats(turns: FluencyTurn[]): {
  total: number;
  within: number;
  withinPct: number;
  avgSeconds: number;
} {
  if (turns.length === 0) {
    return { total: 0, within: 0, withinPct: 0, avgSeconds: 0 };
  }
  const total = turns.length;
  const within = turns.filter(t => t.ms <= t.limitMs).length;
  const withinPct = Math.round((100 * within) / total);
  
  const totalMs = turns.reduce((acc, t) => acc + t.ms, 0);
  const avgSeconds = parseFloat((totalMs / (total * 1000)).toFixed(2));
  
  return { total, within, withinPct, avgSeconds };
}

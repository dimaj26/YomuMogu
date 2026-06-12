import { isNodeUnlocked } from './graph';

/**
 * Фиксированный список формульных выражений (лексических единиц),
 * которые освобождены от проверки скоупа грамматики.
 */
export const FORMULAIC_CHUNKS = [
  'ください',
  'お願いします',
  'すみません',
  'ありがとうございます',
  'はい',
  'いいえ',
  'こんにちは',
  'こんばんは',
  'おはようございます',
  'わかりました',
  '〜はありますか',
  'はありますか'
] as const;

export interface MinimalProgress {
  status: string;
  due: number;
}

/**
 * Вычисляет разрешенный скоуп грамматики и фокусный элемент для ИИ чата.
 * 
 * Формула: закрытые ноды (mature) + текущие таргетные ноды (unlocked && !mature) + формульный whitelist.
 */
export function getAllowedScope(
  nodes: any[],
  progressMap: Record<string, MinimalProgress>
) {
  const allowedConstructions: Array<{ id: string; construction: string }> = [];
  
  for (const node of nodes) {
    const progress = progressMap[node.id];
    const isMature = progress?.status === 'mature';
    const isBase = node.id === 'g_n5_s1_1';
    const isStarted = progress && progress.status !== 'new';
    
    // g_n5_s1_1 всегда доступна, mature всегда доступна, иначе проверяем unlocked и started статус
    const isUnlocked = isNodeUnlocked(node.id, nodes, progressMap as any);
    
    if (isBase || isMature || (isUnlocked && isStarted)) {
      allowedConstructions.push({ id: node.id, construction: node.construction });
    }
  }

  // Выбор фокусной конструкции
  const now = Date.now();
  
  // Приоритет 1: изучаемая нода с ближайшим due (status в процессе, т.е. не mature и не new)
  const activeNodes = nodes
    .filter(node => {
      const progress = progressMap[node.id];
      if (!progress) return false;
      const isActive = progress.status !== 'mature' && progress.status !== 'new';
      return isActive && (node.id === 'g_n5_s1_1' || isNodeUnlocked(node.id, nodes, progressMap as any));
    })
    .map(node => ({ node, progress: progressMap[node.id] }))
    .sort((a, b) => a.progress.due - b.progress.due);

  if (activeNodes.length > 0) {
    const focusNode = activeNodes[0].node;
    return {
      allowedConstructions,
      focus: { id: focusNode.id, construction: focusNode.construction }
    };
  }

  // Приоритет 2: просроченная зрелая нода (due <= now) для интервального повторения
  const dueClosedNodes = nodes
    .filter(node => {
      const progress = progressMap[node.id];
      if (!progress) return false;
      const isDueClosed = progress.status === 'mature' && progress.due <= now;
      return isDueClosed;
    })
    .map(node => ({ node, progress: progressMap[node.id] }))
    .sort((a, b) => a.progress.due - b.progress.due);

  if (dueClosedNodes.length > 0) {
    const focusNode = dueClosedNodes[0].node;
    return {
      allowedConstructions,
      focus: { id: focusNode.id, construction: focusNode.construction }
    };
  }

  // Фолбэк: g_n5_s1_1
  const fallbackNode = nodes.find(n => n.id === 'g_n5_s1_1');
  return {
    allowedConstructions,
    focus: fallbackNode 
      ? { id: fallbackNode.id, construction: fallbackNode.construction }
      : { id: 'g_n5_s1_1', construction: 'АはБです' }
  };
}

/**
 * Проверяет, входят ли использованные конструкции в разрешенный список и формульный whitelist.
 */
export function validateUsedConstructions(
  used: string[],
  allowedIds: string[]
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  const allowedSet = new Set(allowedIds);
  const chunkSet = new Set<string>(FORMULAIC_CHUNKS);
  
  for (const item of used) {
    if (!allowedSet.has(item) && !chunkSet.has(item)) {
      violations.push(item);
    }
  }
  
  return {
    ok: violations.length === 0,
    violations
  };
}

/**
 * Генерирует блок системного промпта для ограничения грамматики и фокуса.
 */
export function getGrammarScopeInstruction(scope: {
  allowedConstructions: Array<{ id: string; construction: string }>;
  focus?: { id: string; construction: string };
}): string {
  const allowedConstructionsStr = scope.allowedConstructions
    .map(c => `- ${c.construction} (ID: ${c.id})`)
    .join('\n');
    
  const chunksStr = FORMULAIC_CHUNKS.map(c => `- ${c}`).join('\n');
  
  let instruction = `CRITICAL GRAMMAR CONSTRAINT:
You must compose your responses using ONLY the allowed grammatical constructions and formulaic expressions listed below.
Do not use any other complex grammar patterns outside this scope.

ALLOWED GRAMMATICAL CONSTRUCTIONS:
${allowedConstructionsStr}

ALLOWED FORMULAIC EXPRESSIONS (FREE TO USE):
${chunksStr}
`;

  if (scope.focus) {
    instruction += `\nNUDGE/FOCUS:
Your primary pedagogical target is to nudge the user to practice the construction: ${scope.focus.construction} (ID: ${scope.focus.id}).
Design your prompt or question to encourage them to reply using this pattern where natural.
`;
  }
  
  return instruction;
}

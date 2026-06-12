import type { GrammarProgress } from '@/core/db';

/**
 * Интерфейс узла графа грамматики.
 */
export interface GrammarGraphNode {
  id: string;
  prerequisites: string[];
  isPlaceholder?: boolean;
}

/**
 * Проверяет граф грамматики на наличие дубликатов, висячих связей и циклов.
 * Возвращает список строк с описанием ошибок (пустой массив, если ошибок нет).
 */
export function validateGraph(nodes: GrammarGraphNode[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const nodeMap = new Map<string, GrammarGraphNode>();

  // 1. Проверяем дубликаты ID
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Дублирующийся ID ноды: ${node.id}`);
    }
    nodeIds.add(node.id);
    nodeMap.set(node.id, node);
  }

  // 2. Проверяем висячие ссылки в пререквизитах
  for (const node of nodes) {
    if (node.prerequisites) {
      for (const prereqId of node.prerequisites) {
        if (!nodeIds.has(prereqId)) {
          errors.push(`Висячий пререквизит: нода ${node.id} ссылается на несуществующую ${prereqId}`);
        }
      }
    }
  }

  // Если есть критические ошибки связности, циклы проверять небезопасно
  if (errors.length > 0) {
    return errors;
  }

  // 3. Поиск циклов с помощью DFS (алгоритм раскраски вершин)
  // 0 - белый (не посещен), 1 - серый (в процессе посещения), 2 - черный (полностью обработан)
  const visited = new Map<string, number>();
  for (const id of nodeIds) {
    visited.set(id, 0);
  }

  function dfs(nodeId: string): boolean {
    visited.set(nodeId, 1); // красим в серый

    const node = nodeMap.get(nodeId);
    if (node && node.prerequisites) {
      for (const prereqId of node.prerequisites) {
        const state = visited.get(prereqId);
        if (state === 1) {
          // Обнаружен серый узел — это цикл!
          errors.push(`Обнаружен цикл в зависимостях графа грамматики: ${nodeId} -> ${prereqId}`);
          return true;
        } else if (state === 0) {
          if (dfs(prereqId)) {
            return true;
          }
        }
      }
    }

    visited.set(nodeId, 2); // красим в черный
    return false;
  }

  for (const id of nodeIds) {
    if (visited.get(id) === 0) {
      dfs(id);
    }
  }

  return errors;
}

/**
 * Проверяет, начато ли изучение узла (статус отличен от 'new').
 */
export function isNodeStarted(progress?: GrammarProgress): boolean {
  return !!progress && progress.status !== 'new';
}

/**
 * Проверяет, разблокирована ли нода грамматики.
 * Нода разблокирована, если:
 * 1. Она не является плейсхолдером (плейсхолдеры всегда заблокированы).
 * 2. У неё нет пререквизитов, ИЛИ все пререквизиты были начаты (status !== 'new').
 */
export function isNodeUnlocked(
  id: string,
  nodes: GrammarGraphNode[],
  progressMap: Record<string, GrammarProgress>
): boolean {
  const node = nodes.find(n => n.id === id);
  if (!node) {
    return false;
  }

  // Плейсхолдеры всегда заблокированы
  if (node.isPlaceholder) {
    return false;
  }

  // Если пререквизитов нет — всегда разблокирована
  if (!node.prerequisites || node.prerequisites.length === 0) {
    return true;
  }

  // Все пререквизиты должны быть начаты (status !== 'new')
  return node.prerequisites.every(prereqId => {
    const progress = progressMap[prereqId];
    return isNodeStarted(progress);
  });
}

/**
 * Проверяет, закрыта ли нода (полностью изучена).
 * Нода считается закрытой, если её статус равен 'mature'.
 */
export function isNodeClosed(progress?: GrammarProgress): boolean {
  return !!progress && progress.status === 'mature';
}

/**
 * Возвращает список всех рёбер (связей) графа.
 * Выводится массив объектов { from, to }, где to зависит от from (т.е. from является пререквизитом для to).
 */
export function getEdges(nodes: GrammarGraphNode[]): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  for (const node of nodes) {
    if (node.prerequisites) {
      for (const prereqId of node.prerequisites) {
        edges.push({ from: prereqId, to: node.id });
      }
    }
  }
  return edges;
}

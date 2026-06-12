import { describe, it, expect } from 'vitest';
import { 
  FORMULAIC_CHUNKS, 
  getAllowedScope, 
  validateUsedConstructions, 
  getGrammarScopeInstruction 
} from '../promptScope';
import { GrammarGraphNode } from '../graph';

// Mock grammar rules/nodes for testing
const mockNodes: Array<GrammarGraphNode & { construction: string; level?: string; coords?: { x: number; y: number } }> = [
  { id: 'g_n5_s1_1', construction: 'АはБです', level: 'N5', prerequisites: [], coords: { x: 0, y: 0 } },
  { id: 'g_n5_s2', construction: '〜の', level: 'N5', prerequisites: ['g_n5_s1_1'], coords: { x: 0, y: 1 } },
  { id: 'g_n5_s3', construction: 'ます-форма', level: 'N5', prerequisites: ['g_n5_s2'], coords: { x: 0, y: 2 } },
  { id: 'g_n5_s4', construction: '〜に (направление)', level: 'N5', prerequisites: ['g_n5_s3'], coords: { x: 0, y: 3 } },
];

describe('Derived chat grammar scope (promptScope)', () => {
  it('zero-grammar: скоуп = только s1_1 и формульные чанки, чат не блокируется', () => {
    // При пустом прогрессе
    const progressMap = {};
    const scope = getAllowedScope(mockNodes, progressMap);
    
    // g_n5_s1_1 всегда разблокирована (базовый узел)
    const allowedIds = scope.allowedConstructions.map(c => c.id);
    expect(allowedIds).toContain('g_n5_s1_1');
    expect(allowedIds).not.toContain('g_n5_s2');
    
    // Чат всегда доступен, нет блокировок
    expect(scope.focus).toEqual({ id: 'g_n5_s1_1', construction: 'АはБです' });
  });

  it('закрытые ноды попадают в allowedConstructions, незакрытые недоступные — нет', () => {
    // g_n5_s1_1 и g_n5_s2 закрыты (mature)
    // g_n5_s3 - в процессе (unlocked, not closed)
    // g_n5_s4 - заблокирована (dangling/locked)
    const progressMap = {
      'g_n5_s1_1': { status: 'mature', due: Date.now() + 100000 },
      'g_n5_s2': { status: 'mature', due: Date.now() + 100000 },
      'g_n5_s3': { status: 'learning', due: Date.now() - 50000 } // просрочена/в фокусе
    };
    
    const scope = getAllowedScope(mockNodes, progressMap);
    const allowedIds = scope.allowedConstructions.map(c => c.id);
    
    expect(allowedIds).toContain('g_n5_s1_1');
    expect(allowedIds).toContain('g_n5_s2');
    expect(allowedIds).toContain('g_n5_s3'); // текущий таргет (unlocked && not closed)
    expect(allowedIds).not.toContain('g_n5_s4'); // заблокирован
  });

  it('focus приоритет 1: изучаемая нода с ближайшим due', () => {
    // Две ноды со статусом learning/review. Нода s3 имеет меньший due (уже просрочен).
    const progressMap = {
      'g_n5_s1_1': { status: 'mature', due: Date.now() + 100000 },
      'g_n5_s2': { status: 'learning', due: Date.now() + 5000 }, // ду более отдаленный
      'g_n5_s3': { status: 'review', due: Date.now() - 1000 } // ду ближайший/просроченный
    };
    
    const scope = getAllowedScope(mockNodes, progressMap);
    expect(scope.focus?.id).toBe('g_n5_s3');
  });

  it('focus приоритет 2: закрытая нода с due <= now (spaced re-use)', () => {
    // Нет активных learning/review нод. Но s2 закрыта и ее due прошел.
    const now = Date.now();
    const progressMap = {
      'g_n5_s1_1': { status: 'mature', due: now + 100000 },
      'g_n5_s2': { status: 'mature', due: now - 5000 } // просроченная зрелая нода
    };
    
    const scope = getAllowedScope(mockNodes, progressMap);
    expect(scope.focus?.id).toBe('g_n5_s2');
  });

  it('focus fallback: s1_1 при пустом прогрессе', () => {
    const scope = getAllowedScope(mockNodes, {});
    expect(scope.focus?.id).toBe('g_n5_s1_1');
  });

  it('validateUsedConstructions ловит конструкцию вне скоупа и пропускает чанки', () => {
    const allowedIds = ['g_n5_s1_1', 'g_n5_s2'];
    
    // Нормальный случай: используется только разрешенное
    const res1 = validateUsedConstructions(['g_n5_s1_1'], allowedIds);
    expect(res1.ok).toBe(true);
    expect(res1.violations).toEqual([]);
    
    // Выход за пределы: используется g_n5_s3, которой нет в allowedIds
    const res2 = validateUsedConstructions(['g_n5_s1_1', 'g_n5_s3'], allowedIds);
    expect(res2.ok).toBe(false);
    expect(res2.violations).toEqual(['g_n5_s3']);
    
    // Формульные чанки не должны считаться нарушениями (они пропускаются)
    const chunkName = FORMULAIC_CHUNKS[0]; // e.g. "ください"
    const res3 = validateUsedConstructions(['g_n5_s1_1', chunkName], allowedIds);
    expect(res3.ok).toBe(true);
    expect(res3.violations).toEqual([]);
  });

  it('getGrammarScopeInstruction перечисляет все разрешённые конструкции и не содержит запрещённых слов промпта', () => {
    const scope = {
      allowedConstructions: [
        { id: 'g_n5_s1_1', construction: 'АはБです' },
        { id: 'g_n5_s2', construction: '〜の' }
      ],
      focus: { id: 'g_n5_s1_1', construction: 'АはБです' }
    };
    
    const instruction = getGrammarScopeInstruction(scope);
    
    // Должна перечислять конструкции
    expect(instruction).toContain('АはБです');
    expect(instruction).toContain('〜の');
    
    // Должна перечислять чанки
    expect(instruction).toContain(FORMULAIC_CHUNKS[0]);
    
    // Должна содержать фокус
    expect(instruction).toContain('NUDGE/FOCUS:');
    
    // Запрещенные слова из [CP-3.3] не должны содержаться
    expect(instruction.toLowerCase()).not.toContain('ролевая игра');
    expect(instruction.toLowerCase()).not.toContain('роль ии');
    expect(instruction.toLowerCase()).not.toContain('роль пользователя');
  });
});

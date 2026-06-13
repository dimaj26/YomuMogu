import { describe, it, expect } from 'vitest';
import {
  validateGraph,
  isNodeStarted,
  isNodeUnlocked,
  isNodeClosed,
  getEdges,
  GrammarGraphNode
} from '../graph';
import type { GrammarProgress } from '@/core/db';
import realRules from '@/resources/grammar_rules.json';

describe('Grammar DAG Graph Engine', () => {
  it('нода без пререквизитов всегда разблокирована', () => {
    const nodes: GrammarGraphNode[] = [
      { id: 'g_n5_s1_1', prerequisites: [] }
    ];
    const progressMap: Record<string, GrammarProgress> = {};
    expect(isNodeUnlocked('g_n5_s1_1', nodes, progressMap)).toBe(true);
  });

  it('развилка: s1_2 и s2 разблокируются одновременно после старта s1_1', () => {
    const nodes: GrammarGraphNode[] = [
      { id: 'g_n5_s1_1', prerequisites: [] },
      { id: 'g_n5_s1_2', prerequisites: ['g_n5_s1_1'] },
      { id: 'g_n5_s2', prerequisites: ['g_n5_s1_1'] }
    ];
    // Если s1_1 еще не начата (или отсутствует в progressMap)
    const progressMapEmpty: Record<string, GrammarProgress> = {};
    expect(isNodeUnlocked('g_n5_s1_2', nodes, progressMapEmpty)).toBe(false);
    expect(isNodeUnlocked('g_n5_s2', nodes, progressMapEmpty)).toBe(false);

    // Если s1_1 начата (status !== 'new')
    const progressMapStarted: Record<string, GrammarProgress> = {
      g_n5_s1_1: {
        profileId: 'default',
        ruleId: 'g_n5_s1_1',
        stepIndex: 1,
        status: 'learning',
        due: 0
      }
    };
    expect(isNodeUnlocked('g_n5_s1_2', nodes, progressMapStarted)).toBe(true);
    expect(isNodeUnlocked('g_n5_s2', nodes, progressMapStarted)).toBe(true);
  });

  it('нода с несколькими пререквизитами требует старта всех', () => {
    const nodes: GrammarGraphNode[] = [
      { id: 'g_n5_s1_1', prerequisites: [] },
      { id: 'g_n5_s1_2', prerequisites: [] },
      { id: 'g_n5_exam', prerequisites: ['g_n5_s1_1', 'g_n5_s1_2'] }
    ];

    // Только одна пройдена
    const progressOneStarted: Record<string, GrammarProgress> = {
      g_n5_s1_1: {
        profileId: 'default',
        ruleId: 'g_n5_s1_1',
        stepIndex: 1,
        status: 'learning',
        due: 0
      }
    };
    expect(isNodeUnlocked('g_n5_exam', nodes, progressOneStarted)).toBe(false);

    // Обе пройдены
    const progressBothStarted: Record<string, GrammarProgress> = {
      g_n5_s1_1: {
        profileId: 'default',
        ruleId: 'g_n5_s1_1',
        stepIndex: 1,
        status: 'learning',
        due: 0
      },
      g_n5_s1_2: {
        profileId: 'default',
        ruleId: 'g_n5_s1_2',
        stepIndex: 2,
        status: 'review',
        due: 0
      }
    };
    expect(isNodeUnlocked('g_n5_exam', nodes, progressBothStarted)).toBe(true);
  });

  it('плейсхолдер заблокирован даже при выполненных пререквизитах', () => {
    const nodes: GrammarGraphNode[] = [
      { id: 'g_n5_s1_1', prerequisites: [] },
      { id: 'g_n5_s7', prerequisites: ['g_n5_s1_1'], isPlaceholder: true }
    ];
    const progressMap: Record<string, GrammarProgress> = {
      g_n5_s1_1: {
        profileId: 'default',
        ruleId: 'g_n5_s1_1',
        stepIndex: 4,
        status: 'mature',
        due: 0
      }
    };
    expect(isNodeUnlocked('g_n5_s7', nodes, progressMap)).toBe(false);
  });

  it('validateGraph ловит цикл', () => {
    const nodes: GrammarGraphNode[] = [
      { id: 'A', prerequisites: ['B'] },
      { id: 'B', prerequisites: ['A'] }
    ];
    const errors = validateGraph(nodes);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('cycle') || e.includes('цикл'))).toBe(true);
  });

  it('validateGraph ловит висячий пререквизит', () => {
    const nodes: GrammarGraphNode[] = [
      { id: 'A', prerequisites: ['NON_EXISTENT'] }
    ];
    const errors = validateGraph(nodes);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.toLowerCase().includes('dangling') || e.toLowerCase().includes('висячий') || e.toLowerCase().includes('prerequisite'))).toBe(true);
  });

  it('validateGraph пропускает реальный grammar_rules.json без ошибок', () => {
    // Кастим реальные правила под GrammarGraphNode
    const errors = validateGraph(realRules as any);
    expect(errors).toEqual([]);
  });

  it('grammar_rules.json содержит уровень N4: 5 авторских нод, плейсхолдеры отсутствуют', () => {
    const n4Nodes = (realRules as any).filter((n: any) => n.level === 'N4');
    expect(n4Nodes.filter((n: any) => !n.isPlaceholder).length).toBe(5);
    expect(n4Nodes.find((n: any) => n.id === 'g_n4_exam')).toBeUndefined();
    expect(n4Nodes.some((n: any) => n.isPlaceholder)).toBe(false);
  });

  it('все пререквизиты N4-нод указывают на реальные (не placeholder) ноды N5', () => {
    const n4Nodes = (realRules as any).filter((n: any) => n.level === 'N4');
    for (const node of n4Nodes) {
      for (const prereqId of node.prerequisites) {
        const prereq = (realRules as any).find((n: any) => n.id === prereqId);
        expect(prereq).toBeDefined();
        if (prereq.level === 'N5') {
          expect(prereq.isPlaceholder).not.toBe(true);
        }
      }
    }
  });

  it('isNodeClosed истинно только для mature', () => {
    expect(isNodeClosed()).toBe(false);
    expect(isNodeClosed({
      profileId: 'default',
      ruleId: 'g_n5_s1_1',
      stepIndex: 1,
      status: 'learning',
      due: 0
    })).toBe(false);
    expect(isNodeClosed({
      profileId: 'default',
      ruleId: 'g_n5_s1_1',
      stepIndex: 4,
      status: 'mature',
      due: 0
    })).toBe(true);
  });

  it('обратная совместимость: профиль, начавший линейную цепь, не теряет доступ ни к одной ноде', () => {
    // В старой линейной цепи: s1_1 (mature) -> s1_2 (review) -> s2 (learning) -> s3 (new) -> s4 -> s5 -> s6
    // Симулируем этот прогресс в нашей новой DAG-структуре
    // С новой DAG:
    // s1_1: mature
    // s1_2: review (нужна s1_1, разблокирована)
    // s2: learning (нужна s1_1, разблокирована)
    // s3: new (нужна s2, разблокирована т.к. s2 'learning' !== 'new')
    // s4: new (нужна s2, разблокирована)
    // s5: new (нужна s2, разблокирована)
    // Все они должны быть доступны
    const nodes: GrammarGraphNode[] = [
      { id: 'g_n5_s1_1', prerequisites: [] },
      { id: 'g_n5_s1_2', prerequisites: ['g_n5_s1_1'] },
      { id: 'g_n5_s2', prerequisites: ['g_n5_s1_1'] },
      { id: 'g_n5_s3', prerequisites: ['g_n5_s2'] },
      { id: 'g_n5_s4', prerequisites: ['g_n5_s2'] },
      { id: 'g_n5_s5', prerequisites: ['g_n5_s2'] }
    ];

    const progressMap: Record<string, GrammarProgress> = {
      g_n5_s1_1: {
        profileId: 'default',
        ruleId: 'g_n5_s1_1',
        stepIndex: 4,
        status: 'mature',
        due: 0
      },
      g_n5_s1_2: {
        profileId: 'default',
        ruleId: 'g_n5_s1_2',
        stepIndex: 3,
        status: 'review',
        due: 0
      },
      g_n5_s2: {
        profileId: 'default',
        ruleId: 'g_n5_s2',
        stepIndex: 2,
        status: 'learning',
        due: 0
      }
    };

    expect(isNodeUnlocked('g_n5_s1_1', nodes, progressMap)).toBe(true);
    expect(isNodeUnlocked('g_n5_s1_2', nodes, progressMap)).toBe(true);
    expect(isNodeUnlocked('g_n5_s2', nodes, progressMap)).toBe(true);
    expect(isNodeUnlocked('g_n5_s3', nodes, progressMap)).toBe(true);
    expect(isNodeUnlocked('g_n5_s4', nodes, progressMap)).toBe(true);
    expect(isNodeUnlocked('g_n5_s5', nodes, progressMap)).toBe(true);
  });
});

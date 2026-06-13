import { describe, it, expect } from 'vitest';
import { getRecommendedStructureShare, computeActualShare, getBalanceHint, recordActivity, Strand } from '../balance';

describe('Balance Logic', () => {
  it('getRecommendedStructureShare: N5=0.5, N3=0.3', () => {
    expect(getRecommendedStructureShare('N5')).toBe(0.5);
    expect(getRecommendedStructureShare('N4')).toBe(0.4);
    expect(getRecommendedStructureShare('N3')).toBe(0.3);
    expect(getRecommendedStructureShare('N2')).toBe(0.2);
    expect(getRecommendedStructureShare('N1')).toBe(0.2);
  });

  it('computeActualShare: null при количестве действий меньше минимума', () => {
    const log: Strand[] = ['structure', 'immersion', 'structure'];
    // Минимум 6 действий по условию
    expect(computeActualShare(log)).toBeNull();
  });

  it('computeActualShare: доля структуры по окну последних действий', () => {
    // В окне последних 30 действий, проверим правильный расчет доли
    // 10 действий, 6 structure, 4 immersion -> 6/10 = 0.6
    const log: Strand[] = [
      'structure', 'structure', 'structure',
      'immersion', 'immersion', 'immersion', 'immersion',
      'structure', 'structure', 'structure'
    ];
    expect(computeActualShare(log)).toBeCloseTo(0.6, 2);

    // Проверим, что учитываются только последние 30 действий
    // Сделаем лог из 40 действий: первые 10 - immersion, последние 30 - 15 structure и 15 immersion
    const longLog: Strand[] = [
      ...Array(10).fill('immersion'),
      ...Array(15).fill('structure'),
      ...Array(15).fill('immersion')
    ];
    // Должно быть ровно 15 / 30 = 0.5, так как первые 10 отбрасываются
    expect(computeActualShare(longLog)).toBe(0.5);
  });

  it('getBalanceHint: сообщения для баланса/перекоса вверх/вниз/недостатка данных, без принуждения', () => {
    // 1. Недостаток данных
    const hintNull = getBalanceHint('N5', []);
    expect(hintNull.actual).toBeNull();
    expect(hintNull.message).toContain('Занимайся как удобно');

    // N5 рекомендовано 0.5
    // 2. Хороший баланс (в пределах +-0.15, т.е. 0.35..0.65)
    // 5 structure, 5 immersion -> 0.5
    const balancedLog: Strand[] = [
      'structure', 'structure', 'structure', 'structure', 'structure',
      'immersion', 'immersion', 'immersion', 'immersion', 'immersion'
    ];
    const hintBalanced = getBalanceHint('N5', balancedLog);
    expect(hintBalanced.actual).toBe(0.5);
    expect(hintBalanced.message).toContain('Хороший баланс');

    // 3. Перекос в структуру (больше рекомендованного + 0.15, т.е. > 0.65)
    // 8 structure, 2 immersion -> 0.8
    const highStructureLog: Strand[] = [
      'structure', 'structure', 'structure', 'structure', 'structure', 'structure', 'structure', 'structure',
      'immersion', 'immersion'
    ];
    const hintHighStruct = getBalanceHint('N5', highStructureLog);
    expect(hintHighStruct.actual).toBe(0.8);
    expect(hintHighStruct.message).toContain('Много структуры');

    // 4. Перекос в иммерсию (меньше рекомендованного - 0.15, т.е. < 0.35)
    // 2 structure, 8 immersion -> 0.2
    const lowStructureLog: Strand[] = [
      'structure', 'structure',
      'immersion', 'immersion', 'immersion', 'immersion', 'immersion', 'immersion', 'immersion', 'immersion'
    ];
    const hintLowStruct = getBalanceHint('N5', lowStructureLog);
    expect(hintLowStruct.actual).toBe(0.2);
    expect(hintLowStruct.message).toContain('Много практики');
  });

  it('recordActivity: добавляет элемент и обрезает лог по BALANCE_ACTIVITY_WINDOW', () => {
    let log: Strand[] = [];
    log = recordActivity('structure', log);
    expect(log).toEqual(['structure']);

    const fullLog = Array(30).fill('immersion');
    const resultLog = recordActivity('structure', fullLog);
    expect(resultLog.length).toBe(30);
    expect(resultLog[29]).toBe('structure');
    expect(resultLog[0]).toBe('immersion');
  });
});

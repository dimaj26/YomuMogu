import { describe, it, expect } from 'vitest';
import {
  getTurnLimit,
  buildFluencyReplaySession,
  filterScopeForFluency,
  computeFluencyStats,
  FluencyTurn
} from '../fluency';

describe('fluency tests', () => {
  it('getTurnLimit: плоский лимит прогона, base 30+10×уровень, раунды k=1.0/0.75/0.5, пол 20 секунд', () => {
    // Уровень 1: base = 30 + 10 = 40
    // Раунд 1: k = 1.0 => 40
    // Раунд 2: k = 0.75 => 40 * 0.75 = 30
    // Раунд 3: k = 0.5 => 40 * 0.5 = 20
    expect(getTurnLimit(1, 1)).toBe(40);
    expect(getTurnLimit(2, 1)).toBe(30);
    expect(getTurnLimit(3, 1)).toBe(20);

    // Уровень 5: base = 30 + 50 = 80
    // Раунд 1: k = 1.0 => 80
    // Раунд 2: k = 0.75 => 80 * 0.75 = 60
    // Раунд 3: k = 0.5 => 80 * 0.5 = 40
    expect(getTurnLimit(1, 5)).toBe(80);
    expect(getTurnLimit(2, 5)).toBe(60);
    expect(getTurnLimit(3, 5)).toBe(40);

    // Уровень 1 раунд 3 не ниже 20 (пол 20 секунд)
    // base = 40. k = 0.5 => 20.
    // Если уровень 1, а раунд 3, то getTurnLimit(3, 1) = 20.
    // Давайте проверим граничное условие, например, если k дает меньше 20.
    // Например, если base меньше 40? Нет, минимальный уровень 1, base = 40.
    // Но если бы уровень был 0? base = 30. Раунд 3: k = 0.5 => 15, но пол 20 должен вернуть 20.
    // Мы можем проверить гипотетический уровень 0 или просто убедиться в формуле.
    // getTurnLimit(3, 0) => max(20, Math.round(30 * 0.5)) = max(20, 15) = 20.
    expect(getTurnLimit(3, 0)).toBe(20);
  });

  it('buildFluencyReplaySession: новый id с суффиксом -fluency-, флаги fluencyMode и fluencyRound, сценарий и слова сохранены', () => {
    const session = {
      id: 'session-123',
      scenario: 'Заказ кофе в кафе',
      targetWords: [
        { word: 'コーヒー', translation: 'кофе' },
        { word: '飲む', translation: 'пить' }
      ],
      otherProperty: 'hello'
    };

    const replay = buildFluencyReplaySession(session, 2);

    expect(replay.id).toMatch(/^session-123-fluency-\d+$/);
    expect(replay.scenario).toBe(session.scenario);
    expect(replay.targetWords).toEqual(session.targetWords);
    expect(replay.fluencyMode).toBe(true);
    expect(replay.fluencyRound).toBe(2);
    expect(replay.otherProperty).toBe('hello');
  });

  it('filterScopeForFluency: остаются только mature-ноды', () => {
    const allowed = [
      { id: 'g_n5_s1_1', construction: 'АはБです' },
      { id: 'g_n5_s1_2', construction: 'АはБですか' },
      { id: 'g_n5_s2_1', construction: 'АของБ' }
    ];
    const progressMap = {
      'g_n5_s1_1': { status: 'mature' },
      'g_n5_s1_2': { status: 'learning' },
      'g_n5_s2_1': { status: 'mature' }
    };

    const filtered = filterScopeForFluency(allowed, progressMap);

    expect(filtered).toEqual([
      { id: 'g_n5_s1_1', construction: 'АはБです' },
      { id: 'g_n5_s2_1', construction: 'АของБ' }
    ]);
  });

  it('filterScopeForFluency: пустой прогресс даёт пустой список без ошибок', () => {
    const allowed = [
      { id: 'g_n5_s1_1', construction: 'АはБです' }
    ];
    const progressMap = {};

    const filtered = filterScopeForFluency(allowed, progressMap);

    expect(filtered).toEqual([]);
  });

  it('computeFluencyStats: счёт в лимите, проценты и среднее время', () => {
    const turns: FluencyTurn[] = [
      { ms: 15000, limitMs: 20000 }, // в лимите
      { ms: 22000, limitMs: 20000 }, // превышен
      { ms: 19999, limitMs: 20000 }, // в лимите
      { ms: 20000, limitMs: 20000 }  // ровно в лимите
    ];

    const stats = computeFluencyStats(turns);

    expect(stats.total).toBe(4);
    expect(stats.within).toBe(3);
    expect(stats.withinPct).toBe(75); // 3 / 4 * 100
    expect(stats.avgSeconds).toBe(19.25); // (15 + 22 + 19.999 + 20) / 4000
  });

  it('computeFluencyStats: пустой массив возвращает нули без деления на ноль', () => {
    const stats = computeFluencyStats([]);

    expect(stats.total).toBe(0);
    expect(stats.within).toBe(0);
    expect(stats.withinPct).toBe(0);
    expect(stats.avgSeconds).toBe(0);
  });
});

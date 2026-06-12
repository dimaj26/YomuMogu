import { describe, it, expect } from 'vitest';
import {
  computeLexCoverage,
  computeGrammarCoverage,
  computeRecentCorrectionRate,
  buildCompetencyProfile,
  getPresetAdvice
} from '../profile';
import type { LocalWord } from '../../../core/types';

describe('Competency Profile Engine', () => {
  describe('lexCoverage', () => {
    it('считает только jlpt:n5 слова с active.status review/mature против канонического знаменателя', () => {
      // canonical size for N5 is 710 in jlpt_levels.json
      const mockWords: Partial<LocalWord>[] = [
        {
          tags: ['jlpt:n5'],
          active: { status: 'review', stability: 1, difficulty: 5, interval: 1, due: 0, reps: 1, lapses: 0 }
        },
        {
          tags: ['jlpt:n5'],
          active: { status: 'mature', stability: 25, difficulty: 5, interval: 25, due: 0, reps: 5, lapses: 0 }
        },
        {
          tags: ['jlpt:n5'],
          active: { status: 'new', stability: 0, difficulty: 5, interval: 0, due: 0, reps: 0, lapses: 0 }
        },
        {
          tags: ['jlpt:n4'], // wrong level
          active: { status: 'review', stability: 1, difficulty: 5, interval: 1, due: 0, reps: 1, lapses: 0 }
        }
      ];

      // Only 2 words are N5 and review/mature. Coverage should be 2 / 710
      const coverage = computeLexCoverage(mockWords as LocalWord[], 'N5');
      expect(coverage).toBeCloseTo(2 / 710, 6);
    });

    it('пустая база даёт 0 без деления на ноль', () => {
      const coverage = computeLexCoverage([], 'N5');
      expect(coverage).toBe(0);
    });
  });

  describe('grammarCoverage', () => {
    it('10 авторских нод N5, экзамен-плейсхолдер исключён', () => {
      // By default, grammar_rules.json has 10 rules + 1 placeholder for N5.
      // We pass progressMap with 3 mature rules.
      const mockProgress = {
        'g_n5_s1_1': { status: 'mature' },
        'g_n5_s1_2': { status: 'mature' },
        'g_n5_s2': { status: 'mature' },
        'g_n5_s3': { status: 'learning' }, // not mature
        'g_n5_exam': { status: 'mature' } // placeholder, should be excluded
      };

      const coverage = computeGrammarCoverage(mockProgress as any, 'N5');
      // 3 mature rules out of 10 authored rules -> 3 / 10 = 0.3
      expect(coverage).toBeCloseTo(0.3, 2);
    });
  });

  describe('recentCorrectionRate', () => {
    it('null при менее чем 3 сессиях или менее 15 ходов', () => {
      // Case A: fewer than 3 sessions
      const sessionsA = [
        { date: 1, userTurns: 10, correctTurns: 8, chatLevel: 3 },
        { date: 2, userTurns: 10, correctTurns: 9, chatLevel: 3 }
      ];
      expect(computeRecentCorrectionRate(sessionsA)).toBeNull();

      // Case B: 3 sessions but total userTurns < 15
      const sessionsB = [
        { date: 1, userTurns: 4, correctTurns: 3, chatLevel: 3 },
        { date: 2, userTurns: 4, correctTurns: 3, chatLevel: 3 },
        { date: 3, userTurns: 6, correctTurns: 5, chatLevel: 3 }
      ]; // total userTurns = 14
      expect(computeRecentCorrectionRate(sessionsB)).toBeNull();
    });

    it('среднее по последним 3 сессиям', () => {
      const sessions = [
        { date: 1, userTurns: 20, correctTurns: 10, chatLevel: 3 }, // oldest (ignored if more than 3)
        { date: 2, userTurns: 10, correctTurns: 8, chatLevel: 3 },
        { date: 3, userTurns: 5, correctTurns: 4, chatLevel: 3 },
        { date: 4, userTurns: 5, correctTurns: 3, chatLevel: 3 }
      ];
      // last 3 are dates 2, 3, 4: totalUserTurns = 20, totalCorrectTurns = 15.
      // 15 / 20 = 0.75
      expect(computeRecentCorrectionRate(sessions)).toBe(0.75);
    });
  });

  describe('advice and reasons', () => {
    it('advice up: грамматика ≥ 0.7 и точность ≥ 0.8 и уровень < 5', () => {
      const profile = {
        level: 'N5' as const,
        lexCoverage: 0.5,
        grammarCoverage: 0.7,
        recentCorrectionRate: 0.8
      };
      const advice = getPresetAdvice(profile, 3);
      expect(advice.suggestion).toBe('up');
      expect(advice.reason).toContain('N5');
      expect(advice.reason).toContain('70%');
      expect(advice.reason).toContain('80%');
      expect(advice.reason).toContain('4');
    });

    it('advice down: точность < 0.4 и уровень > 1', () => {
      const profile = {
        level: 'N5' as const,
        lexCoverage: 0.2,
        grammarCoverage: 0.3,
        recentCorrectionRate: 0.39
      };
      const advice = getPresetAdvice(profile, 3);
      expect(advice.suggestion).toBe('down');
      expect(advice.reason).toContain('39%');
      expect(advice.reason).toContain('2');
    });

    it('advice stay: на границах порогов и при null-точности', () => {
      // Case A: accuracy 0.79 (not enough for up)
      const profileA = {
        level: 'N5' as const,
        lexCoverage: 0.5,
        grammarCoverage: 0.7,
        recentCorrectionRate: 0.79
      };
      expect(getPresetAdvice(profileA, 3).suggestion).toBe('stay');

      // Case B: grammar 0.69 (not enough for up)
      const profileB = {
        level: 'N5' as const,
        lexCoverage: 0.5,
        grammarCoverage: 0.69,
        recentCorrectionRate: 0.85
      };
      expect(getPresetAdvice(profileB, 3).suggestion).toBe('stay');

      // Case C: null accuracy
      const profileC = {
        level: 'N5' as const,
        lexCoverage: 0.5,
        grammarCoverage: 0.8,
        recentCorrectionRate: null
      };
      expect(getPresetAdvice(profileC, 3).suggestion).toBe('stay');

      // Case D: accuracy is 0.39 but level is already 1
      const profileD = {
        level: 'N5' as const,
        lexCoverage: 0.2,
        grammarCoverage: 0.3,
        recentCorrectionRate: 0.3
      };
      expect(getPresetAdvice(profileD, 1).suggestion).toBe('stay');

      // Case E: grammar >= 0.7, accuracy >= 0.8 but level is already 5
      const profileE = {
        level: 'N5' as const,
        lexCoverage: 0.8,
        grammarCoverage: 0.8,
        recentCorrectionRate: 0.9
      };
      expect(getPresetAdvice(profileE, 5).suggestion).toBe('stay');
    });

    it('reason содержит данные профиля на русском', () => {
      const profile = {
        level: 'N5' as const,
        lexCoverage: 0.75,
        grammarCoverage: 0.75,
        recentCorrectionRate: 0.85
      };
      const advice = getPresetAdvice(profile, 3);
      expect(advice.reason).toMatch(/[А-Яа-я]/); // contains Cyrillic letters
    });
  });
});

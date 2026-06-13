import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as intervals from '../intervals';

describe('intervals registry', () => {
  it('реестр экспортирует все константы с зафиксированными значениями', () => {
    expect(intervals.GRAMMAR_LEITNER_INTERVALS_DAYS).toEqual([1, 3, 7, 14, 30]);
    expect(intervals.FURIGANA_FADE_FROM_DAYS).toBe(3);
    expect(intervals.FURIGANA_HIDE_FROM_DAYS).toBe(21);
    expect(intervals.FURIGANA_FADE_OPACITY).toBe(0.6);
    expect(intervals.FLUENCY_FLOOR_SECONDS).toBe(20);
    expect(intervals.FLUENCY_BASE_OFFSET_SECONDS).toBe(30);
    expect(intervals.FLUENCY_BASE_PER_LEVEL_SECONDS).toBe(10);
    expect(intervals.FLUENCY_ROUND_FACTORS).toEqual({ 1: 1.0, 2: 0.75, 3: 0.5 });
    expect(intervals.QUEST_RESET_HOUR).toBe(4);
    expect(intervals.COMPETENCY_MIN_SESSIONS).toBe(3);
    expect(intervals.COMPETENCY_MIN_TURNS).toBe(15);
    expect(intervals.COMPETENCY_SESSION_CAP).toBe(10);
    expect(intervals.ADVICE_UP_GRAMMAR_COVERAGE).toBe(0.7);
    expect(intervals.ADVICE_UP_CORRECTION_RATE).toBe(0.8);
    expect(intervals.ADVICE_DOWN_CORRECTION_RATE).toBe(0.4);
    expect(intervals.LADDER_COMPLETE_LEX_COVERAGE).toBe(0.8);
    expect(intervals.LADDER_COMPLETE_GRAMMAR_COVERAGE).toBe(1.0);
  });

  it('модуль реестра не имеет проектных импортов', () => {
    const filePath = path.resolve(__dirname, '../intervals.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Проверяем отсутствие импортов из проекта (начинающихся с @/ или ../ или ./)
    // Кроме возможных импортов только типов (хотя в intervals.ts их вообще быть не должно)
    const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      expect(importPath.startsWith('@/')).toBe(false);
      expect(importPath.startsWith('.')).toBe(false);
    }
    
    // Также проверим, что в файле нет ключевого слова "import" в качестве оператора импорта
    // (на случай динамических импортов или простых require)
    const hasRequire = content.includes('require(');
    expect(hasRequire).toBe(false);
  });
});

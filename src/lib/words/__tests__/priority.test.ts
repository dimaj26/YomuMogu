import { describe, it, expect } from 'vitest';
import { jlptRank, sortNewWordsByPriority, pickNonInterferingBatch } from '../priority';
import { LocalWord } from '@/core/types';

function createMockWord(word: string, tags?: string[], id = 0): LocalWord {
  return {
    profileId: 'default',
    id: id || Math.floor(Math.random() * 1000000),
    word,
    reading: '',
    translation: 'перевод',
    category: 'deck',
    source: 'anki',
    tags,
    active: {
      status: 'new',
      stability: 1.0,
      difficulty: 5.0,
      interval: 1,
      due: Date.now(),
      reps: 1,
      lapses: 0
    },
    passive: {
      status: 'new',
      stability: 1.0,
      difficulty: 5.0,
      interval: 1,
      due: Date.now(),
      reps: 1,
      lapses: 0
    }
  };
}

describe('Word priority intake', () => {
  it('jlptRank: n5→0, n4→1, без тега→5', () => {
    // С тегом jlpt:n*
    expect(jlptRank(createMockWord('学生', ['jlpt:n5']))).toBe(0);
    expect(jlptRank(createMockWord('漢字', ['jlpt:n4']))).toBe(1);
    expect(jlptRank(createMockWord('言葉', ['jlpt:n3']))).toBe(2);
    expect(jlptRank(createMockWord('社会', ['jlpt:n2']))).toBe(3);
    expect(jlptRank(createMockWord('経済', ['jlpt:n1']))).toBe(4);
    
    // Без тегов, но в базе jlpt_levels.json (学生 N5, あっち N5, etc.)
    expect(jlptRank(createMockWord('学生', []))).toBe(0);
    
    // Без тегов и вне базы
    expect(jlptRank(createMockWord('неизвестное', []))).toBe(5);
  });

  it('sortNewWordsByPriority: стабильная сортировка по уровню, N5 раньше N4', () => {
    const w1 = createMockWord('N1-word', ['jlpt:n1'], 1);
    const w2 = createMockWord('N5-word', ['jlpt:n5'], 2);
    const w3 = createMockWord('N4-word', ['jlpt:n4'], 3);
    const w4 = createMockWord('N5-word2', ['jlpt:n5'], 4);
    
    const sorted = sortNewWordsByPriority([w1, w2, w3, w4]);
    
    expect(sorted.map(w => w.id)).toEqual([2, 4, 3, 1]); // N5, N5, N4, N1
  });

  it('pickNonInterferingBatch: два слова с общим кандзи не попадают в один батч', () => {
    // 日本 и 本日 делят кандзи 本 и 日
    const w1 = createMockWord('日本', ['jlpt:n5'], 1);
    const w2 = createMockWord('本日', ['jlpt:n5'], 2);
    const w3 = createMockWord('学生', ['jlpt:n5'], 3);
    
    const batch = pickNonInterferingBatch([w1, w2, w3], 2);
    expect(batch.map(w => w.id)).toEqual([1, 3]); // w2 (本日) skipped because it shares kanji with w1 (日本)
  });

  it('pickNonInterferingBatch: пропущенное слово остаётся для следующего батча', () => {
    const w1 = createMockWord('日本', ['jlpt:n5'], 1);
    const w2 = createMockWord('本日', ['jlpt:n5'], 2);
    const w3 = createMockWord('学生', ['jlpt:n5'], 3);
    
    const sorted = [w1, w2, w3];
    const batch1 = pickNonInterferingBatch(sorted, 2);
    expect(batch1.map(w => w.id)).toEqual([1, 3]);
    
    // Remaining words for second batch
    const remaining = sorted.filter(w => !batch1.includes(w));
    const batch2 = pickNonInterferingBatch(remaining, 2);
    expect(batch2.map(w => w.id)).toEqual([2]);
  });
});

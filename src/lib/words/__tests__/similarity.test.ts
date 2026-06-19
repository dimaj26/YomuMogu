import { describe, it, expect } from 'vitest';
import { shareKanji, findSimilarPairs, pickDiscriminationDistractors } from '../similarity';
import { LocalWord } from '@/core/types';

function createMockWord(word: string, status: 'new' | 'learning' | 'review' | 'mature' = 'new', translation = 'перевод', id = 0): LocalWord {
  return {
    profileId: 'default',
    id: id || Math.floor(Math.random() * 1000000),
    word,
    reading: word + '_чтение',
    translation,
    category: 'deck',
    source: 'anki',
    active: {
      status,
      stability: status === 'mature' ? 30.0 : 1.0,
      difficulty: 5.0,
      interval: status === 'mature' ? 30 : 1,
      due: Date.now(),
      reps: 1,
      lapses: 0
    },
  };
}

describe('Word similarity/discrimination', () => {
  it('shareKanji: 日本 и 本日 делят кандзи 本 и 日 — true', () => {
    expect(shareKanji('日本', '本日')).toBe(true);
    expect(shareKanji('漢字', '漢検')).toBe(true);
    expect(shareKanji('学生', '先生')).toBe(true);
    expect(shareKanji('待つ', '持つ')).toBe(false); // Разные кандзи 待 и 持, общего нет
    expect(shareKanji('働く', '休み')).toBe(false);
  });

  it('shareKanji: кана-слова дают false', () => {
    expect(shareKanji('あっち', 'こっち')).toBe(false);
    expect(shareKanji('する', 'くる')).toBe(false);
    expect(shareKanji('日本', 'する')).toBe(false);
  });

  it('findSimilarPairs: находит все пары с общим кандзи', () => {
    const w1 = createMockWord('日本', 'new', 'Япония', 1);
    const w2 = createMockWord('本日', 'new', 'Сегодня', 2);
    const w3 = createMockWord('学生', 'new', 'Студент', 3);
    const w4 = createMockWord('先生', 'new', 'Учитель', 4);
    
    const pairs = findSimilarPairs([w1, w2, w3, w4]);
    // Ожидаем две пары: [日本, 本日] и [学生, 先生] (порядок не имеет значения для теста)
    expect(pairs.length).toBe(2);
    
    const matchedIds = pairs.map(p => [p[0].id, p[1].id].sort());
    expect(matchedIds).toContainEqual([1, 2]);
    expect(matchedIds).toContainEqual([3, 4]);
  });

  it('pickDiscriminationDistractors: только партнёры с обоими словами active.status>=review', () => {
    const current = createMockWord('日本', 'review', 'Япония', 1);
    
    // Партнер 1: подходит (статус mature, делит кандзи)
    const p1 = createMockWord('本日', 'mature', 'Сегодня', 2);
    
    // Партнер 2: не подходит (статус new)
    const p2 = createMockWord('本国', 'new', 'Родина', 3);
    
    // Партнер 3: не подходит (не делит кандзи)
    const p3 = createMockWord('学生', 'mature', 'Студент', 4);
    
    const allWords = [current, p1, p2, p3];
    
    const distractors = pickDiscriminationDistractors(current, allWords, 'translation');
    expect(distractors).toEqual(['Сегодня']);
    
    // Если current сам не mature/review, то ничего не выбираем
    const currentNew = createMockWord('日本', 'new', 'Япония', 1);
    const distractors2 = pickDiscriminationDistractors(currentNew, allWords, 'translation');
    expect(distractors2).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldRouteToChat } from '../scheduler';
import { groupWordsIntoThemes } from '@/lib/gemini/client';
import { AnkiWord } from '@/plugins/anki/filter';
import type { LocalWord } from '../types';

describe('Tagger & Routing helpers', () => {
  describe('shouldRouteToChat', () => {
    it('should return false for new words', () => {
      const word: LocalWord = {
        profileId: 'p1',
        id: 1,
        word: '猫',
        reading: 'ねこ',
        translation: 'кошка',
        category: 'Japanese',
        source: 'starter',
        active: { stability: 0, difficulty: 0, interval: 0, due: 0, reps: 0, lapses: 0, status: 'new' }
      };
      expect(shouldRouteToChat(word)).toBe(false);
    });

    it('should return true if active stability < 3', () => {
      const word: LocalWord = {
        profileId: 'p1',
        id: 1,
        word: '猫',
        reading: 'ねこ',
        translation: 'кошка',
        category: 'Japanese',
        source: 'starter',
        active: { stability: 2.5, difficulty: 5, interval: 2, due: 0, reps: 1, lapses: 0, status: 'review' }
      };
      expect(shouldRouteToChat(word)).toBe(true);
    });

    it('should return true if lapses >= 2', () => {
      const word: LocalWord = {
        profileId: 'p1',
        id: 1,
        word: '猫',
        reading: 'ねこ',
        translation: 'кошка',
        category: 'Japanese',
        source: 'starter',
        active: { stability: 5.0, difficulty: 5, interval: 5, due: 0, reps: 3, lapses: 2, status: 'review' }
      };
      expect(shouldRouteToChat(word)).toBe(true);
    });

    it('should return false if stability >= 3 and lapses < 2', () => {
      const word: LocalWord = {
        profileId: 'p1',
        id: 1,
        word: '猫',
        reading: 'ねこ',
        translation: 'кошка',
        category: 'Japanese',
        source: 'starter',
        active: { stability: 4.5, difficulty: 5, interval: 4, due: 0, reps: 2, lapses: 1, status: 'review' }
      };
      expect(shouldRouteToChat(word)).toBe(false);
    });
  });

  describe('groupWordsIntoThemes', () => {
    it('should correctly group words into 3 themes and mix universal words', () => {
      const words: AnkiWord[] = [
        { id: 1, word: '水', translation: 'вода', interval: 1, status: 'new', deckName: 'd1', rawFront: '水', rawBack: 'вода', tags: ['restaurant', 'home'] },
        { id: 2, word: '車', translation: 'машина', interval: 1, status: 'new', deckName: 'd1', rawFront: '車', rawBack: 'машина', tags: ['travel'] },
        { id: 3, word: '買う', translation: 'покупать', interval: 1, status: 'new', deckName: 'd1', rawFront: '買う', rawBack: 'покупать', tags: ['universal', 'shopping'] },
        { id: 4, word: '食べる', translation: 'есть', interval: 1, status: 'new', deckName: 'd1', rawFront: '食べる', rawBack: 'есть', tags: ['universal', 'restaurant'] },
        { id: 5, word: '大きい', translation: 'большой', interval: 1, status: 'new', deckName: 'd1', rawFront: '大きい', rawBack: 'большой', tags: ['universal'] },
        { id: 6, word: '店', translation: 'магазин', interval: 1, status: 'new', deckName: 'd1', rawFront: '店', rawBack: 'магазин', tags: ['shopping'] },
        { id: 7, word: '本', translation: 'книга', interval: 1, status: 'new', deckName: 'd1', rawFront: '本', rawBack: 'книга', tags: ['education', 'hobbies'] },
        { id: 8, word: '学校', translation: 'школа', interval: 1, status: 'new', deckName: 'd1', rawFront: '学校', rawBack: 'школа', tags: ['education'] },
        { id: 9, word: '先生', translation: 'учитель', interval: 1, status: 'new', deckName: 'd1', rawFront: '先生', rawBack: 'учитель', tags: ['education', 'work'] },
        { id: 10, word: '行く', translation: 'идти', interval: 1, status: 'new', deckName: 'd1', rawFront: '行く', rawBack: 'идти', tags: ['universal'] },
        { id: 11, word: '美味しい', translation: 'вкусный', interval: 1, status: 'new', deckName: 'd1', rawFront: '美味しい', rawBack: 'вкусный', tags: ['universal', 'restaurant'] },
        { id: 12, word: '飲む', translation: 'пить', interval: 1, status: 'new', deckName: 'd1', rawFront: '飲む', rawBack: 'пить', tags: ['universal', 'restaurant'] },
        { id: 13, word: '走る', translation: 'бежать', interval: 1, status: 'new', deckName: 'd1', rawFront: '走る', rawBack: 'бежать', tags: ['universal'] },
        { id: 14, word: '部屋', translation: 'комната', interval: 1, status: 'new', deckName: 'd1', rawFront: '部屋', rawBack: 'комната', tags: ['home'] },
        { id: 15, word: '家', translation: 'дом', interval: 1, status: 'new', deckName: 'd1', rawFront: '家', rawBack: 'дом', tags: ['home'] },
        { id: 16, word: '友達', translation: 'друг', interval: 1, status: 'new', deckName: 'd1', rawFront: '友達', rawBack: 'друг', tags: ['social'] }
      ];

      const groups = groupWordsIntoThemes(words);
      expect(groups.length).toBe(3);
      
      groups.forEach(g => {
        expect(g.theme).toBeDefined();
        expect(g.words.length).toBeGreaterThanOrEqual(4);
      });
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  db, 
  isValidIndexedDbKey, 
  getLocalWords, 
  getDueWords, 
  saveLocalWords, 
  addLocalReview, 
  getUnsyncedReviews, 
  saveLocalUiWord, 
  resetLocalUiWords, 
  getLocalUiWords 
} from '../db';
import type { LocalWord, LocalReview, UiWord } from '../db';

describe('IndexedDB Key Validation & Safety Guards', () => {
  beforeEach(async () => {
    // Очищаем таблицы перед каждым тестом
    await db.words.clear();
    await db.reviews.clear();
    await db.ui_words.clear();
  });

  describe('isValidIndexedDbKey', () => {
    it('should validate standard keys correctly', () => {
      expect(isValidIndexedDbKey('default')).toBe(true);
      expect(isValidIndexedDbKey(123)).toBe(true);
      expect(isValidIndexedDbKey(new Date())).toBe(true);
    });

    it('should reject null and undefined keys', () => {
      expect(isValidIndexedDbKey(null)).toBe(false);
      expect(isValidIndexedDbKey(undefined)).toBe(false);
    });

    it('should reject NaN values', () => {
      expect(isValidIndexedDbKey(NaN)).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidIndexedDbKey('')).toBe(false);
    });

    it('should validate compound keys (arrays) recursively', () => {
      expect(isValidIndexedDbKey(['default', 123])).toBe(true);
      expect(isValidIndexedDbKey(['default', 'btn_settings'])).toBe(true);
      
      expect(isValidIndexedDbKey([])).toBe(false);
      expect(isValidIndexedDbKey(['default', undefined])).toBe(false);
      expect(isValidIndexedDbKey(['default', null])).toBe(false);
      expect(isValidIndexedDbKey(['default', NaN])).toBe(false);
      expect(isValidIndexedDbKey([undefined, 123])).toBe(false);
    });
  });

  describe('Database safety guards with invalid keys', () => {
    const invalidProfileId = '';
    const validProfileId = 'test-profile';

    it('should skip getLocalWords if profileId is invalid', async () => {
      const result = await getLocalWords(invalidProfileId, 'DefaultDeck');
      expect(result).toEqual([]);
    });

    it('should skip getDueWords if profileId is invalid', async () => {
      const result = await getDueWords(invalidProfileId, 'DefaultDeck', Date.now());
      expect(result).toEqual([]);
    });

    it('should skip getUnsyncedReviews if profileId is invalid', async () => {
      const result = await getUnsyncedReviews(invalidProfileId);
      expect(result).toEqual([]);
    });

    it('should skip getLocalUiWords if profileId is invalid', async () => {
      const result = await getLocalUiWords(invalidProfileId);
      expect(result).toEqual([]);
    });

    it('should filter out invalid words in saveLocalWords without throwing', async () => {
      const words: LocalWord[] = [
        {
          profileId: validProfileId,
          id: 1,
          word: '猫',
          reading: 'ねこ',
          translation: 'кошка',
          status: 'new',
          deckName: 'TestDeck',
          stability: 0,
          difficulty: 0,
          interval: 0,
          due: Date.now(),
          reps: 0,
          lapses: 0
        },
        {
          profileId: validProfileId,
          id: NaN, // Невалидный ID
          word: '犬',
          reading: 'いぬ',
          translation: 'собака',
          status: 'new',
          deckName: 'TestDeck',
          stability: 0,
          difficulty: 0,
          interval: 0,
          due: Date.now(),
          reps: 0,
          lapses: 0
        },
        {
          profileId: '', // Невалидный профиль
          id: 3,
          word: '水',
          reading: 'みず',
          translation: 'вода',
          status: 'new',
          deckName: 'TestDeck',
          stability: 0,
          difficulty: 0,
          interval: 0,
          due: Date.now(),
          reps: 0,
          lapses: 0
        }
      ];

      await expect(saveLocalWords(words)).resolves.not.toThrow();
      
      // Должно сохраниться только первое слово
      const saved = await db.words.toArray();
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe(1);
    });

    it('should reject invalid review in addLocalReview without throwing', async () => {
      const invalidReview: LocalReview = {
        profileId: validProfileId,
        cardId: NaN, // Невалидный cardId
        ease: 3,
        interval: 1,
        lastInterval: 0,
        duration: 2000,
        timestamp: Date.now(),
        synced: 0
      };

      await expect(addLocalReview(invalidReview)).resolves.not.toThrow();
      
      const savedReviews = await db.reviews.toArray();
      expect(savedReviews).toHaveLength(0);
    });

    it('should reject invalid UI word in saveLocalUiWord without throwing', async () => {
      const invalidUiWord: UiWord = {
        profileId: '', // Невалидный профиль
        id: 'btn_settings',
        word: '設定',
        reading: 'せってい',
        translation: 'Настройки',
        status: 'new',
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: Date.now(),
        reps: 0,
        lapses: 0
      };

      await expect(saveLocalUiWord(invalidUiWord)).resolves.not.toThrow();
      
      const savedUiWords = await db.ui_words.toArray();
      expect(savedUiWords).toHaveLength(0);
    });

    it('should do nothing in resetLocalUiWords if profileId is invalid', async () => {
      await expect(resetLocalUiWords(invalidProfileId)).resolves.not.toThrow();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { stripHtml, getWordStatus, parseAndFilterCards } from '../filter';
import { AnkiCardInfo } from '../client';

describe('Anki Word Filter Module', () => {
  describe('stripHtml', () => {
    it('should strip standard HTML tags', () => {
      expect(stripHtml('<div>日本語</div>')).toBe('日本語');
      expect(stripHtml('<b>漢字</b> и <i>кандзи</i>')).toBe('漢字 и кандзи');
      expect(stripHtml('<a href="#">ссылка</a>')).toBe('ссылка');
    });

    it('should convert HTML character entities', () => {
      expect(stripHtml('A&nbsp;B')).toBe('A B');
      expect(stripHtml('&lt;тест&gt;')).toBe('<тест>');
      expect(stripHtml('слово &amp; перевод')).toBe('слово & перевод');
    });

    it('should trim surrounding whitespace', () => {
      expect(stripHtml('   слово   ')).toBe('слово');
      expect(stripHtml('  <p>  слово  </p>  ')).toBe('слово');
    });

    it('should remove HTML ruby and rt tags with content (furigana)', () => {
      expect(stripHtml('<ruby>笑<rt>わら</rt></ruby>う')).toBe('笑う');
      expect(stripHtml('<ruby>漢字<rt>かんじ</rt></ruby>')).toBe('漢字');
      expect(stripHtml('これは<ruby>漢字<rt>かんじ</rt></ruby>です。')).toBe('これは漢字です。');
    });

    it('should remove bracket readings (furigana)', () => {
      expect(stripHtml('笑う[わらう]')).toBe('笑う');
      expect(stripHtml('食べる（たべる）')).toBe('食べる');
      expect(stripHtml('飲む〔のむ〕')).toBe('飲む');
      expect(stripHtml('漢字[かんじ]')).toBe('漢字');
    });
  });

  describe('getWordStatus', () => {
    it('should classify as new if queue is 0 or interval is 0', () => {
      const mockCard: AnkiCardInfo = {
        cardId: 1,
        deckName: 'Test',
        modelName: 'Basic',
        fields: {},
        interval: 0,
        note: 1,
        queue: 0, // new
        due: 1,
        type: 0,
      };
      expect(getWordStatus(mockCard)).toBe('new');

      const mockCard2 = { ...mockCard, queue: 2, interval: 0 };
      expect(getWordStatus(mockCard2)).toBe('new');
    });

    it('should classify as learning if queue is 1 or 3', () => {
      const mockCard: AnkiCardInfo = {
        cardId: 1,
        deckName: 'Test',
        modelName: 'Basic',
        fields: {},
        interval: 0,
        note: 1,
        queue: 1, // learning queue
        due: 1,
        type: 1,
      };
      expect(getWordStatus(mockCard)).toBe('learning');

      const mockCard2 = { ...mockCard, queue: 3, interval: 5 }; // day learning/relearning
      expect(getWordStatus(mockCard2)).toBe('learning');
    });

    it('should classify as review if queue is 2 and interval < 21', () => {
      const mockCard: AnkiCardInfo = {
        cardId: 1,
        deckName: 'Test',
        modelName: 'Basic',
        fields: {},
        interval: 10, // < 21
        note: 1,
        queue: 2, // review queue
        due: 1,
        type: 2,
      };
      expect(getWordStatus(mockCard)).toBe('review');
      
      const mockCard2 = { ...mockCard, interval: 20 };
      expect(getWordStatus(mockCard2)).toBe('review');
    });

    it('should classify as mature if queue is 2 and interval >= 21', () => {
      const mockCard: AnkiCardInfo = {
        cardId: 1,
        deckName: 'Test',
        modelName: 'Basic',
        fields: {},
        interval: 21, // >= 21
        note: 1,
        queue: 2, // review queue
        due: 1,
        type: 2,
      };
      expect(getWordStatus(mockCard)).toBe('mature');

      const mockCard2 = { ...mockCard, interval: 365 };
      expect(getWordStatus(mockCard2)).toBe('mature');
    });

    it('should use type if queue < 0 (suspended or buried)', () => {
      const mockCard: AnkiCardInfo = {
        cardId: 1,
        deckName: 'Test',
        modelName: 'Basic',
        fields: {},
        interval: 30,
        note: 1,
        queue: -1, // suspended
        due: 1,
        type: 2, // review type
      };
      // type 2 + interval 30 -> mature
      expect(getWordStatus(mockCard)).toBe('mature');

      const mockCard2 = { ...mockCard, type: 1 }; // learning type
      expect(getWordStatus(mockCard2)).toBe('learning');
    });

    it('should classify queue 2 cards based on dueCardIds if provided', () => {
      const mockCard: AnkiCardInfo = {
        cardId: 42,
        deckName: 'Test',
        modelName: 'Basic',
        fields: {},
        interval: 30, // >= 21, would be mature under fallback
        note: 1,
        queue: 2,
        due: 1,
        type: 2,
      };

      // If cardId is in dueCardIds, it is review
      expect(getWordStatus(mockCard, [42])).toBe('review');
      
      // If cardId is NOT in dueCardIds, it is mature
      expect(getWordStatus(mockCard, [100, 200])).toBe('mature');

      const mockCardSmallInterval: AnkiCardInfo = {
        ...mockCard,
        cardId: 43,
        interval: 5, // < 21, would be review under fallback
      };

      // If cardId is NOT in dueCardIds, it becomes mature (learned but not due today)
      expect(getWordStatus(mockCardSmallInterval, [42])).toBe('mature');

      // If cardId IS in dueCardIds, it is review
      expect(getWordStatus(mockCardSmallInterval, [43])).toBe('review');
    });
  });

  describe('parseAndFilterCards', () => {
    it('should parse fields Front and Back correctly', () => {
      const mockCards: AnkiCardInfo[] = [
        {
          cardId: 101,
          deckName: 'Japanese',
          modelName: 'Standard',
          fields: {
            Front: { value: '<div>食べる</div>', order: 0 },
            Back: { value: '<b>есть (кушать)</b>', order: 1 },
          },
          interval: 10,
          note: 1001,
          queue: 2,
          due: 200,
          type: 2,
        },
      ];

      const result = parseAndFilterCards(mockCards, 'Front', 'Back');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 101,
        word: '食べる',
        translation: 'есть (кушать)',
        interval: 10,
        status: 'review', // interval 10 + queue 2 -> review
        deckName: 'Japanese',
        rawFront: '<div>食べる</div>',
        rawBack: '<b>есть (кушать)</b>',
        cardIds: [101],
      });
    });

    it('should handle custom case-insensitive field names', () => {
      const mockCards: AnkiCardInfo[] = [
        {
          cardId: 102,
          deckName: 'Japanese',
          modelName: 'Standard',
          fields: {
            word: { value: '飲む', order: 0 },
            translation: { value: 'пить', order: 1 },
          },
          interval: 120,
          note: 1002,
          queue: 2,
          due: 201,
          type: 2,
        },
      ];

      const result = parseAndFilterCards(mockCards, 'word', 'translation');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('飲む');
      expect(result[0].translation).toBe('пить');
      expect(result[0].status).toBe('mature');
    });

    it('should fallback to first and second fields if specified fields do not exist', () => {
      const mockCards: AnkiCardInfo[] = [
        {
          cardId: 103,
          deckName: 'Japanese',
          modelName: 'Standard',
          fields: {
            Expression: { value: '書く', order: 0 },
            Meaning: { value: 'писать', order: 1 },
          },
          interval: 5,
          note: 1003,
          queue: 2,
          due: 202,
          type: 2,
        },
      ];

      const result = parseAndFilterCards(mockCards, 'Front', 'Back');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('書く'); // fallback to first field
      expect(result[0].translation).toBe('писать'); // fallback to second field
      expect(result[0].status).toBe('review');
    });

    it('should deduplicate cards with the same word and merge their statuses and cardIds', () => {
      const mockCards: AnkiCardInfo[] = [
        {
          cardId: 101,
          deckName: 'DeckA',
          modelName: 'Standard',
          fields: {
            Front: { value: '飲む', order: 0 },
            Back: { value: 'пить', order: 1 },
          },
          interval: 30, // mature
          note: 1001,
          queue: 2,
          due: 200,
          type: 2,
        },
        {
          cardId: 102,
          deckName: 'DeckB',
          modelName: 'Standard',
          fields: {
            Front: { value: '飲む', order: 0 },
            Back: { value: 'выпить', order: 1 },
          },
          interval: 5, // review
          note: 1002,
          queue: 2,
          due: 201,
          type: 2,
        },
      ];

      // With dueCardIds including card 102
      const result = parseAndFilterCards(mockCards, 'Front', 'Back', [102]);
      
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('飲む');
      expect(result[0].status).toBe('review'); // review priority (3) is higher than mature (0)
      expect(result[0].id).toBe(102);
      expect(result[0].cardIds).toEqual([101, 102]);
    });

    it('should dynamically apply per-deck mappings if deckMappings parameter is provided', () => {
      const mockCards: AnkiCardInfo[] = [
        {
          cardId: 101,
          deckName: 'DeckA',
          modelName: 'Standard',
          fields: {
            JapaneseWord: { value: '飲む', order: 0 },
            RussianTranslation: { value: 'пить', order: 1 },
            Front: { value: 'wrong_A', order: 2 },
            Back: { value: 'wrong_A_back', order: 3 },
          },
          interval: 30,
          note: 1001,
          queue: 2,
          due: 200,
          type: 2,
        },
        {
          cardId: 102,
          deckName: 'DeckB',
          modelName: 'Standard',
          fields: {
            Expression: { value: '書く', order: 0 },
            Meaning: { value: 'писать', order: 1 },
            Front: { value: 'wrong_B', order: 2 },
            Back: { value: 'wrong_B_back', order: 3 },
          },
          interval: 5,
          note: 1002,
          queue: 2,
          due: 201,
          type: 2,
        },
      ];

      const deckMappings = {
        DeckA: { frontField: 'JapaneseWord', backField: 'RussianTranslation' },
        DeckB: { frontField: 'Expression', backField: 'Meaning' },
      };

      const result = parseAndFilterCards(mockCards, 'Front', 'Back', [], deckMappings);
      expect(result).toHaveLength(2);
      
      const wordA = result.find(r => r.id === 101);
      expect(wordA).toBeDefined();
      expect(wordA?.word).toBe('飲む');
      expect(wordA?.translation).toBe('пить');

      const wordB = result.find(r => r.id === 102);
      expect(wordB).toBeDefined();
      expect(wordB?.word).toBe('書く');
      expect(wordB?.translation).toBe('писать');
    });
  });
});

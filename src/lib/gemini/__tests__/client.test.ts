import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient, groupWordsIntoThemes } from '../client';
import { AnkiWord } from '@/plugins/anki/filter';

// Мокаем SDK GoogleGenAI
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: function() {
      return {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              sessions: [
                {
                  id: 'session-1',
                  title: 'В ресторане',
                  description: 'Практикуем слова в ресторане.',
                  scenario: 'ИИ: официант, Вы: гость',
                  targetWords: [
                    { word: '猫', translation: 'кошка' },
                    { word: '犬', translation: 'собака' }
                  ]
                }
              ]
            })
          })
        }
      };
    }
  };
});

describe('GeminiClient', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  it('should throw an error if GEMINI_API_KEY is not defined', async () => {
    process.env.GEMINI_API_KEY = '';
    const client = new GeminiClient();
    const mockWords: AnkiWord[] = [
      { id: 1, word: '猫', translation: 'кошка', status: 'new', interval: 0, deckName: 'J', rawFront: '猫', rawBack: 'кошка' }
    ];

    await expect(client.generateSessions(mockWords)).rejects.toThrow(
      'Ключ GEMINI_API_KEY не задан в переменных окружения'
    );
    
    process.env = originalEnv;
  });

  it('should generate sessions correctly when key is present', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const client = new GeminiClient();
    const mockWords: AnkiWord[] = [
      { id: 1, word: '猫', translation: 'кошка', status: 'new', interval: 0, deckName: 'J', rawFront: '猫', rawBack: 'кошка' },
      { id: 2, word: '犬', translation: 'собака', status: 'learning', interval: 10, deckName: 'J', rawFront: '犬', rawBack: 'собака' }
    ];

    const sessions = await client.generateSessions(mockWords);
    
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('В ресторане');
    expect(sessions[0].targetWords).toHaveLength(2);
    expect(sessions[0].targetWords[0].word).toBe('猫');

    process.env = originalEnv;
  });

  it('should return empty list if words are empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const client = new GeminiClient();
    const sessions = await client.generateSessions([]);
    expect(sessions).toEqual([]);
    process.env = originalEnv;
  });

  describe('groupWordsIntoThemes', () => {
    it('приоритизирует трудные слова (isHard) в целевые слова тем', () => {
      const words: AnkiWord[] = [
        { id: 1, word: '寿司', translation: 'суши', status: 'new', interval: 0, deckName: 'J', rawFront: '寿司', rawBack: 'суши', tags: ['restaurant'] },
        { id: 2, word: 'ラーメン', translation: 'рамен', status: 'new', interval: 0, deckName: 'J', rawFront: 'ラーメン', rawBack: 'рамен', tags: ['restaurant'] },
        { id: 3, word: '天ぷら', translation: 'темпура', status: 'new', interval: 0, deckName: 'J', rawFront: '天ぷра', rawBack: 'темпура', tags: ['restaurant'] },
        { id: 4, word: 'うどん', translation: 'удон', status: 'new', interval: 0, deckName: 'J', rawFront: 'うどん', rawBack: 'удон', tags: ['restaurant'] },
        { id: 5, word: 'そば', translation: 'соба', status: 'new', interval: 0, deckName: 'J', rawFront: 'そば', rawBack: 'соба', tags: ['restaurant'] },
        { id: 6, word: '水', translation: 'вода', status: 'mature', interval: 30, deckName: 'J', rawFront: '水', rawBack: 'вода', tags: ['restaurant'], isHard: true }
      ];

      const groups = groupWordsIntoThemes(words);
      const restaurantGroup = groups.find(g => g.theme === 'restaurant');
      expect(restaurantGroup).toBeDefined();
      
      const targetWords = restaurantGroup!.words.map(w => w.word);
      expect(targetWords).toContain('水');
    });

    it('формирует 3 темы по 5–8 слов', () => {
      const words: AnkiWord[] = [
        { id: 1, word: '寿司', translation: 'суши', status: 'new', interval: 0, deckName: 'J', rawFront: '寿司', rawBack: 'суши', tags: ['restaurant'] },
        { id: 2, word: 'ラーメン', translation: 'рамен', status: 'new', interval: 0, deckName: 'J', rawFront: 'ラーメン', rawBack: 'рамен', tags: ['restaurant'] },
        { id: 3, word: '天ぷら', translation: 'темпура', status: 'new', interval: 0, deckName: 'J', rawFront: '天ぷら', rawBack: 'темпура', tags: ['restaurant'] },
        { id: 4, word: 'うどん', translation: 'удон', status: 'new', interval: 0, deckName: 'J', rawFront: 'うどん', rawBack: 'удон', tags: ['restaurant'] },
        { id: 5, word: 'そば', translation: 'соба', status: 'new', interval: 0, deckName: 'J', rawFront: 'そば', rawBack: 'соба', tags: ['restaurant'] },
        { id: 6, word: '水', translation: 'вода', status: 'new', interval: 0, deckName: 'J', rawFront: '水', rawBack: 'вода', tags: ['restaurant'] },
        { id: 7, word: '酒', translation: 'саке', status: 'new', interval: 0, deckName: 'J', rawFront: '酒', rawBack: 'саке', tags: ['restaurant'] },
        { id: 8, word: '肉', translation: 'мясо', status: 'new', interval: 0, deckName: 'J', rawFront: '肉', rawBack: 'мясо', tags: ['restaurant'] },
        { id: 9, word: '魚', translation: 'рыба', status: 'new', interval: 0, deckName: 'J', rawFront: '魚', rawBack: 'рыба', tags: ['restaurant'] },
        { id: 10, word: '米', translation: 'рис', status: 'new', interval: 0, deckName: 'J', rawFront: '米', rawBack: 'рис', tags: ['restaurant'] },
        
        { id: 11, word: '店', translation: 'магазин', status: 'new', interval: 0, deckName: 'J', rawFront: '店', rawBack: 'магазин', tags: ['shopping'] },
        { id: 12, word: '服', translation: 'одежда', status: 'new', interval: 0, deckName: 'J', rawFront: '服', rawBack: 'одежда', tags: ['shopping'] },
        { id: 13, word: '靴', translation: 'обувь', status: 'new', interval: 0, deckName: 'J', rawFront: '靴', rawBack: 'обувь', tags: ['shopping'] },
        { id: 14, word: '本', translation: 'книга', status: 'new', interval: 0, deckName: 'J', rawFront: '本', rawBack: 'книга', tags: ['shopping'] },
        { id: 15, word: '鞄', translation: 'сумка', status: 'new', interval: 0, deckName: 'J', rawFront: '鞄', rawBack: 'сумка', tags: ['shopping'] },
        
        { id: 101, word: '買う', translation: 'покупать', status: 'new', interval: 0, deckName: 'J', rawFront: '買う', rawBack: 'покупать', tags: ['universal'] },
        { id: 102, word: '食べる', translation: 'есть', status: 'new', interval: 0, deckName: 'J', rawFront: '食べる', rawBack: 'есть', tags: ['universal'] },
        { id: 103, word: '飲む', translation: 'пить', status: 'new', interval: 0, deckName: 'J', rawFront: '飲む', rawBack: 'пить', tags: ['universal'] },
        { id: 104, word: '行く', translation: 'идти', status: 'new', interval: 0, deckName: 'J', rawFront: '行く', rawBack: 'идти', tags: ['universal'] },
        { id: 105, word: '来る', translation: 'приходить', status: 'new', interval: 0, deckName: 'J', rawFront: '来る', rawBack: 'приходить', tags: ['universal'] },
        { id: 106, word: '見る', translation: 'видеть', status: 'new', interval: 0, deckName: 'J', rawFront: '見る', rawBack: 'видеть', tags: ['universal'] },
        { id: 107, word: '話す', translation: 'разговаривать', status: 'new', interval: 0, deckName: 'J', rawFront: '話す', rawBack: 'разговаривать', tags: ['universal'] },
        { id: 108, word: '聞く', translation: 'слушать', status: 'new', interval: 0, deckName: 'J', rawFront: '聞く', rawBack: 'слушать', tags: ['universal'] },
        { id: 109, word: '書く', translation: 'писать', status: 'new', interval: 0, deckName: 'J', rawFront: '書く', rawBack: 'писать', tags: ['universal'] },
        { id: 110, word: '読む', translation: 'читать', status: 'new', interval: 0, deckName: 'J', rawFront: '読む', rawBack: 'читать', tags: ['universal'] }
      ];

      const groups = groupWordsIntoThemes(words);
      expect(groups).toHaveLength(3);
      
      groups.forEach(g => {
        expect(g.words.length).toBeGreaterThanOrEqual(5);
        expect(g.words.length).toBeLessThanOrEqual(8);
      });
    });
  });
});

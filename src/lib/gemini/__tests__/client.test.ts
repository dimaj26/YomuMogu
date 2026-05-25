import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from '../client';
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
});

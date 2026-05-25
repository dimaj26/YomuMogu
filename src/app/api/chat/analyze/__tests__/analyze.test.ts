import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as analyzePost } from '../route';
import { NextRequest } from 'next/server';
import { lookupWord } from '@/lib/dict/jitendex';
import { ankiClient } from '@/plugins/anki/client';

// Mock dependencies
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: function() {
      return {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              words: [
                { word: '相手', reading: 'あいて', translation: 'собеседник' },
                { word: '片思い', reading: 'かたおもい', translation: 'безответная любовь' }
              ]
            })
          })
        }
      };
    }
  };
});

vi.mock('@/lib/dict/jitendex', () => {
  return {
    lookupWord: vi.fn().mockResolvedValue({
      word: '相手',
      entry: '相手',
      definition: '<div>Определение из словаря</div>'
    })
  };
});

vi.mock('@/plugins/anki/client', () => {
  return {
    ankiClient: {
      findCardsByQuery: vi.fn(),
      getCardsInfo: vi.fn(),
      findCards: vi.fn(),
      addNote: vi.fn(),
      answerCards: vi.fn()
    }
  };
});

describe('API Route POST /api/chat/analyze', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    process.env.GEMINI_API_KEY = '';
    const request = new NextRequest('http://localhost/api/chat/analyze', {
      method: 'POST',
      body: JSON.stringify({
        history: [{ role: 'user', text: 'こんにちは' }],
        deckName: 'Japanese'
      })
    });

    const response = await analyzePost(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('API-ключ Gemini не настроен');
    process.env = originalEnv;
  });

  it('should return 400 if history is missing or not an array', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/chat/analyze', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'Japanese'
      })
    });

    const response = await analyzePost(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Необходимо передать историю сообщений');
    process.env = originalEnv;
  });

  it('should return 400 if deckName is missing', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/chat/analyze', {
      method: 'POST',
      body: JSON.stringify({
        history: []
      })
    });

    const response = await analyzePost(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Необходимо передать имя колоды');
    process.env = originalEnv;
  });

  it('should successfully analyze chat history, query JitenDex and check Anki', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // Mock Anki calls:
    vi.mocked(ankiClient.findCards).mockResolvedValue([10001]);
    
    vi.mocked(ankiClient.findCardsByQuery).mockImplementation(async (query: string) => {
      if (query.includes('is:due')) {
        return [10001]; // card 10001 is due
      }
      return [];
    });

    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      {
        cardId: 10001,
        deckName: 'Japanese',
        modelName: 'Basic',
        fields: {
          Front: { value: '相手', order: 0 },
          Back: { value: 'собеседник', order: 1 }
        },
        interval: 10,
        note: 20001,
        queue: 2, // review queue
        due: 0,
        type: 2 // review type
      }
    ]);

    vi.mocked(lookupWord).mockImplementation(async (word: string) => {
      if (word === '相手') {
        return { word: '相手', definition: '<div>Definition of あいて</div>' };
      }
      return { word, error: 'Word not found' };
    });

    const request = new NextRequest('http://localhost/api/chat/analyze', {
      method: 'POST',
      body: JSON.stringify({
        history: [
          { role: 'user', text: '日本語を話しましょう' },
          { role: 'model', text: 'そうですね、相手の気持ちを考えて話します。' }
        ],
        deckName: 'Japanese',
        frontField: 'Front',
        backField: 'Back'
      })
    });

    const response = await analyzePost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.words).toHaveLength(2);

    // 1st word: "相手" (in Anki, isDue=true, has JitenDex definition)
    expect(data.words[0].word).toBe('相手');
    expect(data.words[0].inAnki).toBe(true);
    expect(data.words[0].cardId).toBe(10001);
    expect(data.words[0].cardIds).toEqual([10001]);
    expect(data.words[0].isDue).toBe(true);
    expect(data.words[0].definitionHtml).toBe('<div>Definition of あいて</div>');

    // 2nd word: "片思い" (not in Anki, no definition)
    expect(data.words[1].word).toBe('片思い');
    expect(data.words[1].inAnki).toBe(false);
    expect(data.words[1].isDue).toBe(false);
    expect(data.words[1].definitionHtml).toBe('');

    process.env = originalEnv;
  });
});

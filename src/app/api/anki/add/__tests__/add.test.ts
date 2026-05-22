import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as addPost } from '../route';
import { NextRequest } from 'next/server';
import { ankiClient } from '@/lib/anki/client';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: function() {
      return {
        models: {
          generateContent: mockGenerateContent
        }
      };
    }
  };
});

vi.mock('@/lib/anki/client', () => {
  return {
    ankiClient: {
      findCards: vi.fn(),
      getCardsInfo: vi.fn(),
      addNote: vi.fn()
    }
  };
});

describe('API Route POST /api/anki/add', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    delete process.env.GEMINI_API_KEY;
    const request = new NextRequest('http://localhost/api/anki/add', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'Japanese',
        word: '片思い',
        reading: 'かたおもい',
        translation: 'безответная любовь'
      })
    });

    const response = await addPost(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('API-ключ Gemini не настроен');
    process.env = originalEnv;
  });

  it('should return 400 if required fields are missing', async () => {
    const request = new NextRequest('http://localhost/api/anki/add', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'Japanese'
        // missing word, reading, translation
      })
    });

    const response = await addPost(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should fall back to Basic model and successfully add note if deck is empty (using Gemini)', async () => {
    vi.mocked(ankiClient.findCards).mockResolvedValue([]); // empty deck
    vi.mocked(ankiClient.addNote).mockResolvedValue(50001); // created note ID
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        Front: '片思い',
        Back: '<div><strong>【かたおもい】</strong> безответная любовь</div>'
      })
    });

    const request = new NextRequest('http://localhost/api/anki/add', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'Japanese',
        frontField: 'Front',
        backField: 'Back',
        word: '片思い',
        reading: 'かтаомои',
        translation: 'безответная любовь',
        definitionHtml: '<p>Definition from dictionary</p>'
      })
    });

    const response = await addPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.noteId).toBe(50001);

    expect(ankiClient.findCards).toHaveBeenCalledWith('Japanese');
    expect(ankiClient.addNote).toHaveBeenCalledWith(
      'Japanese',
      'Basic',
      {
        Front: '片思い',
        Back: expect.stringContaining('безответная любовь')
      },
      ['yomumogu_sync']
    );
  });

  it('should fallback to default fields layout if Gemini fails', async () => {
    vi.mocked(ankiClient.findCards).mockResolvedValue([]); // empty deck
    vi.mocked(ankiClient.addNote).mockResolvedValue(50001);
    mockGenerateContent.mockRejectedValue(new Error('Gemini API Error')); // Gemini fails

    const request = new NextRequest('http://localhost/api/anki/add', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'Japanese',
        frontField: 'Front',
        backField: 'Back',
        word: '片思い',
        reading: 'かたおもい',
        translation: 'безответная любовь',
        definitionHtml: '<p>Definition from dictionary</p>'
      })
    });

    const response = await addPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.noteId).toBe(50001);

    expect(ankiClient.addNote).toHaveBeenCalledWith(
      'Japanese',
      'Basic',
      {
        Front: '片思い',
        Back: expect.stringContaining('かたおもい')
      },
      ['yomumogu_sync']
    );
  });

  it('should detect existing model from cards info and generate fields dynamically', async () => {
    vi.mocked(ankiClient.findCards).mockResolvedValue([10001]);
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      {
        cardId: 10001,
        deckName: 'Japanese',
        modelName: 'Japanese-Note-Type', // detected model
        fields: {
          JapaneseWord: { value: '相手', order: 0 },
          RussianMeaning: { value: 'собеседник', order: 1 },
          ExampleSentence: { value: '', order: 2 }
        },
        interval: 10,
        note: 20001,
        queue: 2,
        due: 0,
        type: 2
      }
    ]);
    vi.mocked(ankiClient.addNote).mockResolvedValue(50002);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        JapaneseWord: '相手',
        RussianMeaning: 'собеседник',
        ExampleSentence: '相手の気持ち。'
      })
    });

    const request = new NextRequest('http://localhost/api/anki/add', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'Japanese',
        frontField: 'JapaneseWord',
        backField: 'RussianMeaning',
        word: '相手',
        reading: 'あいて',
        translation: 'собеседник',
        definitionHtml: '<p>JitenDex html</p>',
        history: [{ role: 'user', text: '相手' }]
      })
    });

    const response = await addPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.noteId).toBe(50002);

    expect(ankiClient.addNote).toHaveBeenCalledWith(
      'Japanese',
      'Japanese-Note-Type',
      {
        JapaneseWord: '相手',
        RussianMeaning: 'собеседник',
        ExampleSentence: '相手の気持ち。'
      },
      ['yomumogu_sync']
    );
  });
});

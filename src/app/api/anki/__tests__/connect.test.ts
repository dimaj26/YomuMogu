import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as connectGet } from '../connect/route';
import { GET as decksGet } from '../decks/route';
import { GET as wordsGet } from '../words/route';
import { ankiClient } from '@/plugins/anki/client';
import { NextRequest } from 'next/server';

// Мокаем сам клиент ankiClient
vi.mock('@/plugins/anki/client', () => {
  return {
    ankiClient: {
      checkConnection: vi.fn(),
      getDeckNames: vi.fn(),
      findCards: vi.fn(),
      getCardsInfo: vi.fn(),
    },
  };
});

describe('Anki Backend API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/anki/connect', () => {
    it('should return connected: true if connection check succeeds', async () => {
      vi.mocked(ankiClient.checkConnection).mockResolvedValue(true);

      const response = await connectGet();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ connected: true });
    });

    it('should return 503 error if connection check fails', async () => {
      vi.mocked(ankiClient.checkConnection).mockResolvedValue(false);

      const response = await connectGet();
      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.connected).toBe(false);
      expect(data.error).toContain('AnkiConnect не отвечает');
    });
  });

  describe('GET /api/anki/decks', () => {
    it('should return list of decks if successful', async () => {
      const mockDecks = ['Japanese', 'Default'];
      vi.mocked(ankiClient.getDeckNames).mockResolvedValue(mockDecks);

      const response = await decksGet();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.decks).toEqual(mockDecks);
    });

    it('should return 500 error if fetching decks fails', async () => {
      vi.mocked(ankiClient.getDeckNames).mockRejectedValue(new Error('API Error'));

      const response = await decksGet();
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('API Error');
    });
  });

  describe('GET /api/anki/words', () => {
    it('should return 400 if deck query parameter is missing', async () => {
      const request = new NextRequest('http://localhost/api/anki/words');
      const response = await wordsGet(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Параметр deck обязателен');
    });

    it('should return empty list if deck has no cards', async () => {
      vi.mocked(ankiClient.findCards).mockResolvedValue([]);
      
      const request = new NextRequest('http://localhost/api/anki/words?deck=EmptyDeck');
      const response = await wordsGet(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.words).toEqual([]);
      expect(ankiClient.findCards).toHaveBeenCalledWith('EmptyDeck');
    });

    it('should fetch and return filtered cards', async () => {
      vi.mocked(ankiClient.findCards).mockResolvedValue([1, 2]);
      vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
        {
          cardId: 1,
          deckName: 'Japanese',
          modelName: 'Basic',
          fields: {
            Front: { value: '学校', order: 0 },
            Back: { value: 'школа', order: 1 },
          },
          interval: 15,
          note: 101,
          queue: 2,
          due: 50,
          type: 2,
        },
        {
          cardId: 2,
          deckName: 'Japanese',
          modelName: 'Basic',
          fields: {
            Front: { value: '先生', order: 0 },
            Back: { value: 'учитель', order: 1 },
          },
          interval: 95,
          note: 102,
          queue: 2,
          due: 51,
          type: 2,
        },
      ]);

      const request = new NextRequest('http://localhost/api/anki/words?deck=Japanese&frontField=Front&backField=Back');
      const response = await wordsGet(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.words).toHaveLength(2);
      expect(data.words[0].word).toBe('学校');
      expect(data.words[0].status).toBe('review');
      expect(data.words[1].word).toBe('先生');
      expect(data.words[1].status).toBe('mature');
    });
  });
});

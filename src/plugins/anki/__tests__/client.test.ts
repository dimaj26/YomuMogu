import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnkiConnectClient } from '../client';

describe('AnkiConnectClient', () => {
  let client: AnkiConnectClient;

  beforeEach(() => {
    client = new AnkiConnectClient('http://localhost:8765');
    vi.restoreAllMocks();
  });

  it('should successfully check connection', async () => {
    // Мокаем успешный ответ
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: 6, error: null }),
    } as Response);

    const isConnected = await client.checkConnection();
    
    expect(isConnected).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.any(Object));
  });

  it('should return false if AnkiConnect version is too low', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: 5, error: null }),
    } as Response);

    const isConnected = await client.checkConnection();
    expect(isConnected).toBe(false);
  });

  it('should return false if fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch failed'));

    const isConnected = await client.checkConnection();
    expect(isConnected).toBe(false);
  });

  it('should retrieve deck names', async () => {
    const mockDecks = ['Default', 'Japanese', 'English'];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockDecks, error: null }),
    } as Response);

    const decks = await client.getDeckNames();
    expect(decks).toEqual(mockDecks);
  });

  it('should retrieve card IDs in a deck', async () => {
    const mockCardIds = [10001, 10002, 10003];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockCardIds, error: null }),
    } as Response);

    const cardIds = await client.findCards('Japanese');
    expect(cardIds).toEqual(mockCardIds);
  });

  it('should retrieve detailed card information', async () => {
    const mockCardsInfo = [
      {
        cardId: 10001,
        deckName: 'Japanese',
        modelName: 'Basic',
        fields: {
          Front: { value: '漢字', order: 0 },
          Back: { value: 'иероглиф', order: 1 },
        },
        interval: 10,
        note: 20001,
        queue: 2,
        due: 100,
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockCardsInfo, error: null }),
    } as Response);

    const cardsInfo = await client.getCardsInfo([10001]);
    expect(cardsInfo).toEqual(mockCardsInfo);
  });

  it('should throw "Anki not running" error on network connection refusal', async () => {
    const connRefusedError = new Error('fetch failed');
    // @ts-ignore
    connRefusedError.code = 'ECONNREFUSED';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(connRefusedError);

    await expect(client.getDeckNames()).rejects.toThrow(
      'Anki не запущен или плагин AnkiConnect не активен'
    );
  });

  it('should handle general API errors returned by AnkiConnect', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: 'some custom API error' }),
    } as Response);

    await expect(client.getDeckNames()).rejects.toThrow('AnkiConnect error: some custom API error');
  });

  it('should answer cards', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: null }),
    } as Response);

    const result = await client.answerCards([{ cardId: 10001, ease: 3 }]);
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'answerCards',
        version: 6,
        params: { answers: [{ cardId: 10001, ease: 3 }] },
      }),
    }));
  });

  it('should relearn cards', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: null }),
    } as Response);

    const result = await client.relearnCards([10001, 10002]);
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'relearnCards',
        version: 6,
        params: { cards: [10001, 10002] },
      }),
    }));
  });

  it('should set due date', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: null }),
    } as Response);

    const result = await client.setDueDate([10001], '5!');
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'setDueDate',
        version: 6,
        params: { cards: [10001], due: '5!' },
      }),
    }));
  });

  it('should insert reviews', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: null }),
    } as Response);

    const reviewTuple: [number, number, number, number, number, number, number, number, number] = [
      123456789, 10001, -1, 3, 5, 2, 2500, 5000, 1
    ];
    const result = await client.insertReviews([reviewTuple]);
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'insertReviews',
        version: 6,
        params: { reviews: [reviewTuple] },
      }),
    }));
  });

  it('should add a note', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: 12345, error: null }),
    } as Response);

    const noteId = await client.addNote('Japanese', 'Basic', { Front: '漢字', Back: 'иероглиф' }, ['tag1']);
    expect(noteId).toBe(12345);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'addNote',
        version: 6,
        params: {
          note: {
            deckName: 'Japanese',
            modelName: 'Basic',
            fields: { Front: '漢字', Back: 'иероглиф' },
            tags: ['tag1'],
            options: {
              allowDuplicate: false,
              duplicateScope: 'deck',
            },
          },
        },
      }),
    }));
  });

  it('should find cards by query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: [10001, 10002], error: null }),
    } as Response);

    const cardIds = await client.findCardsByQuery('deck:Japanese front:漢字');
    expect(cardIds).toEqual([10001, 10002]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'findCards',
        version: 6,
        params: { query: 'deck:Japanese front:漢字' },
      }),
    }));
  });

  it('should create deck', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: null }),
    } as Response);

    await client.createDeck('YomuMogu');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'createDeck',
        version: 6,
        params: { deck: 'YomuMogu' },
      }),
    }));
  });

  it('should create model', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: null, error: null }),
    } as Response);

    const fields = ['Word', 'Meaning'];
    const templates = [{ Name: 'Card 1', Front: '{{Word}}', Back: '{{Meaning}}' }];
    await client.createModel('YomuModel', fields, templates, 'body {}');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'createModel',
        version: 6,
        params: {
          modelName: 'YomuModel',
          inOrderFields: fields,
          cardTemplates: templates,
          css: 'body {}',
        },
      }),
    }));
  });

  it('should retrieve model names', async () => {
    const mockModels = ['Basic', 'Cloze'];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockModels, error: null }),
    } as Response);

    const models = await client.modelNames();
    expect(models).toEqual(mockModels);
  });

  it('should get reviews of card', async () => {
    const mockReviews = [
      {
        id: 123456789,
        usn: -1,
        ease: 3,
        ivl: 5,
        lastIvl: 2,
        factor: 2500,
        time: 2000,
        type: 1,
      },
    ];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: mockReviews, error: null }),
    } as Response);

    const reviews = await client.getReviewsOfCard(10001);
    expect(reviews).toEqual(mockReviews);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8765', expect.objectContaining({
      body: JSON.stringify({
        action: 'cardReviews',
        version: 6,
        params: { card: 10001 },
      }),
    }));
  });
});

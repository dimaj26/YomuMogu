import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as setupDeckPost } from '../route';
import { ankiClient } from '@/lib/anki/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/anki/client', () => {
  return {
    ankiClient: {
      getDeckNames: vi.fn(),
      createDeck: vi.fn(),
      modelNames: vi.fn(),
      createModel: vi.fn(),
    },
  };
});

describe('POST /api/anki/setup-deck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create deck and model if they do not exist', async () => {
    vi.mocked(ankiClient.getDeckNames).mockResolvedValue(['Default']);
    vi.mocked(ankiClient.modelNames).mockResolvedValue(['Basic']);
    vi.mocked(ankiClient.createDeck).mockResolvedValue(undefined as any);
    vi.mocked(ankiClient.createModel).mockResolvedValue(undefined as any);

    const req = new NextRequest('http://localhost/api/anki/setup-deck', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'YomuMogu',
        modelName: 'YomuMoguModel',
      }),
    });

    const response = await setupDeckPost(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({
      success: true,
      deckName: 'YomuMogu',
      modelName: 'YomuMoguModel',
    });

    expect(ankiClient.createDeck).toHaveBeenCalledWith('YomuMogu');
    expect(ankiClient.createModel).toHaveBeenCalledWith(
      'YomuMoguModel',
      expect.any(Array),
      expect.any(Array),
      expect.any(String)
    );
  });

  it('should not create deck or model if they already exist', async () => {
    vi.mocked(ankiClient.getDeckNames).mockResolvedValue(['YomuMogu', 'Default']);
    vi.mocked(ankiClient.modelNames).mockResolvedValue(['YomuMoguModel', 'Basic']);

    const req = new NextRequest('http://localhost/api/anki/setup-deck', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'YomuMogu',
        modelName: 'YomuMoguModel',
      }),
    });

    const response = await setupDeckPost(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    expect(ankiClient.createDeck).not.toHaveBeenCalled();
    expect(ankiClient.createModel).not.toHaveBeenCalled();
  });

  it('should fall back to defaults if request body is empty or malformed', async () => {
    vi.mocked(ankiClient.getDeckNames).mockResolvedValue(['Default']);
    vi.mocked(ankiClient.modelNames).mockResolvedValue(['Basic']);

    const req = new NextRequest('http://localhost/api/anki/setup-deck', {
      method: 'POST',
    });

    const response = await setupDeckPost(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.deckName).toBe('YomuMogu');
    expect(data.modelName).toBe('YomuMoguModel');

    expect(ankiClient.createDeck).toHaveBeenCalledWith('YomuMogu');
    expect(ankiClient.createModel).toHaveBeenCalledWith(
      'YomuMoguModel',
      expect.any(Array),
      expect.any(Array),
      expect.any(String)
    );
  });

  it('should return 500 status if an error is thrown', async () => {
    vi.mocked(ankiClient.getDeckNames).mockRejectedValue(new Error('AnkiConnect down'));

    const req = new NextRequest('http://localhost/api/anki/setup-deck', {
      method: 'POST',
    });

    const response = await setupDeckPost(req);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe('AnkiConnect down');
  });
});

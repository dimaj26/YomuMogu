import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as syncDbPost } from '../route';
import { ankiClient } from '@/lib/anki/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/anki/client', () => {
  return {
    ankiClient: {
      findCards: vi.fn(),
      getCardsInfo: vi.fn(),
      getReviewsOfCard: vi.fn(),
      getReviewsOfCards: vi.fn(),
      relearnCards: vi.fn(),
      setDueDate: vi.fn(),
      insertReviews: vi.fn(),
    },
  };
});

describe('POST /api/anki/sync-db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if profileId or deckName is missing', async () => {
    const req = new NextRequest('http://localhost/api/anki/sync-db', {
      method: 'POST',
      body: JSON.stringify({
        deckName: 'YomuMogu',
      }),
    });

    const response = await syncDbPost(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Параметры profileId и deckName обязательны');
  });

  it('should successfully sync local reviews and fetch remote updates', async () => {
    // Mocking remote Anki deck state
    // One card matches local state, one card needs review history (mismatched interval), one is new
    vi.mocked(ankiClient.findCards).mockResolvedValue([10001, 10002, 10003]);
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      {
        cardId: 10001,
        deckName: 'YomuMogu',
        modelName: 'YomuMoguModel',
        fields: {
          Front: { value: '猫[ねこ]', order: 0 },
          Back: { value: 'кошка', order: 1 },
        },
        interval: 5,
        note: 20001,
        queue: 2,
        due: 1600000000,
        type: 2,
      },
      {
        cardId: 10002,
        deckName: 'YomuMogu',
        modelName: 'YomuMoguModel',
        fields: {
          Front: { value: '犬[いぬ]', order: 0 },
          Back: { value: 'собака', order: 1 },
        },
        interval: 10, // Mismatched interval (local is 8)
        note: 20002,
        queue: 2,
        due: 1600000000,
        type: 2,
      },
      {
        cardId: 10003,
        deckName: 'YomuMogu',
        modelName: 'YomuMoguModel',
        fields: {
          Front: { value: '鳥[とり]', order: 0 },
          Back: { value: 'птица', order: 1 },
        },
        interval: 0, // New card in Anki
        note: 20003,
        queue: 0,
        due: 1600000000,
        type: 0,
      },
    ]);

    vi.mocked(ankiClient.getReviewsOfCards).mockImplementation(async (cardIds) => {
      // Если это дедупликация (запрос для карт 10001 и 10002)
      if (cardIds.includes(10001)) {
        return {} as any;
      }
      // Если это запрос истории изменившихся карт (для карты 10002)
      return {
        10002: [
          {
            id: 123456780,
            usn: -1,
            ease: 3,
            ivl: 10,
            lastIvl: 5,
            factor: 0,
            time: 4500,
            type: 1,
          },
        ],
      } as any;
    });

    vi.mocked(ankiClient.relearnCards).mockResolvedValue(true);
    vi.mocked(ankiClient.setDueDate).mockResolvedValue(true);
    vi.mocked(ankiClient.insertReviews).mockResolvedValue(true);

    const localReviews = [
      {
        profileId: 'test-profile',
        cardId: 10001,
        ease: 3,
        interval: 5,
        lastInterval: 2,
        duration: 3000,
        timestamp: 123456789,
        synced: 0,
      },
      {
        profileId: 'test-profile',
        cardId: 10002,
        ease: 1, // Again grade -> triggers relearn
        interval: 0,
        lastInterval: 8,
        duration: 2000,
        timestamp: 123456790,
        synced: 0,
      },
    ];

    const localWords = [
      { id: 10001, interval: 5, status: 'review' },
      { id: 10002, interval: 8, status: 'review' }, // Mismatch detected (remote interval is 10)
    ];

    const req = new NextRequest('http://localhost/api/anki/sync-db', {
      method: 'POST',
      body: JSON.stringify({
        profileId: 'test-profile',
        deckName: 'YomuMogu',
        frontField: 'Front',
        backField: 'Back',
        localReviews,
        localWords,
      }),
    });

    const response = await syncDbPost(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.remoteCards).toHaveLength(3);
    
    // Check that reviews were inserted for changes
    expect(ankiClient.relearnCards).toHaveBeenCalledWith([10002]);
    expect(ankiClient.setDueDate).toHaveBeenCalledWith([10001], '5!');
    expect(ankiClient.insertReviews).toHaveBeenCalled();

    // Check that we fetched reviews only for card 10002 (mismatched interval) via getReviewsOfCards
    expect(ankiClient.getReviewsOfCards).toHaveBeenCalledTimes(2);
    expect(ankiClient.getReviewsOfCards).toHaveBeenNthCalledWith(1, [10001, 10002]);
    expect(ankiClient.getReviewsOfCards).toHaveBeenNthCalledWith(2, [10002]);
  });

  it('should filter out duplicate reviews if they are already present in Anki', async () => {
    vi.mocked(ankiClient.findCards).mockResolvedValue([10001]);
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      {
        cardId: 10001,
        deckName: 'YomuMogu',
        modelName: 'YomuMoguModel',
        fields: {
          Front: { value: '猫[ねこ]', order: 0 },
          Back: { value: 'кошка', order: 1 },
        },
        interval: 5,
        note: 20001,
        queue: 2,
        due: 1600000000,
        type: 2,
      },
    ]);

    // Симулируем, что отзыв с таймстемпом 123456789 уже существует в Anki
    vi.mocked(ankiClient.getReviewsOfCards).mockResolvedValue({
      10001: [
        {
          id: 123456789,
          usn: -1,
          ease: 3,
          ivl: 5,
          lastIvl: 2,
          factor: 0,
          time: 2500,
          type: 1,
        },
      ],
    });

    const localReviews = [
      {
        profileId: 'test-profile',
        cardId: 10001,
        ease: 3,
        interval: 5,
        lastInterval: 2,
        duration: 3000,
        timestamp: 123456789, // Дублирующийся таймстемп!
        synced: 0,
      },
    ];

    const req = new NextRequest('http://localhost/api/anki/sync-db', {
      method: 'POST',
      body: JSON.stringify({
        profileId: 'test-profile',
        deckName: 'YomuMogu',
        frontField: 'Front',
        backField: 'Back',
        localReviews,
        localWords: [{ id: 10001, interval: 5, status: 'review' }],
      }),
    });

    const response = await syncDbPost(req);
    expect(response.status).toBe(200);

    // Ни один метод записи не должен быть вызван, так как отзыв отфильтрован как дубликат
    expect(ankiClient.insertReviews).not.toHaveBeenCalled();
    expect(ankiClient.relearnCards).not.toHaveBeenCalled();
    expect(ankiClient.setDueDate).not.toHaveBeenCalled();
  });

  it('should handle AnkiConnect errors gracefully', async () => {
    vi.mocked(ankiClient.findCards).mockRejectedValue(new Error('Anki connection refused'));

    const req = new NextRequest('http://localhost/api/anki/sync-db', {
      method: 'POST',
      body: JSON.stringify({
        profileId: 'test-profile',
        deckName: 'YomuMogu',
      }),
    });

    const response = await syncDbPost(req);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('Не удалось загрузить карты из Anki для синхронизации');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as syncPost } from '../route';
import { NextRequest } from 'next/server';
import { ankiClient } from '@/lib/anki/client';

vi.mock('@/lib/anki/client', () => {
  return {
    ankiClient: {
      answerCards: vi.fn(),
      findCardsByQuery: vi.fn(),
      getCardsInfo: vi.fn(),
      relearnCards: vi.fn(),
      setDueDate: vi.fn(),
      insertReviews: vi.fn()
    }
  };
});

describe('API Route POST /api/anki/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ankiClient.findCardsByQuery).mockResolvedValue([]);
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([]);
    vi.mocked(ankiClient.relearnCards).mockResolvedValue(true);
    vi.mocked(ankiClient.setDueDate).mockResolvedValue(true);
    vi.mocked(ankiClient.insertReviews).mockResolvedValue(true);
  });

  it('should return 400 if cardIds is missing or not an array', async () => {
    const request = new NextRequest('http://localhost/api/anki/sync', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await syncPost(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Необходимо передать массив "cards" или "cardIds"');
  });

  it('should return 200 with success when cardIds is empty', async () => {
    const request = new NextRequest('http://localhost/api/anki/sync', {
      method: 'POST',
      body: JSON.stringify({ cardIds: [] })
    });

    const response = await syncPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(ankiClient.answerCards).not.toHaveBeenCalled();
  });

  it('should call answerCards and return 200 if sync is successful', async () => {
    vi.mocked(ankiClient.answerCards).mockResolvedValue(true);
    vi.mocked(ankiClient.findCardsByQuery).mockResolvedValue([10001, 10002]);
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      { cardId: 10001, queue: 2, interval: 5, type: 2, deckName: 'test', modelName: 'test', note: 1, due: 0, fields: {} },
      { cardId: 10002, queue: 0, interval: 0, type: 0, deckName: 'test', modelName: 'test', note: 1, due: 0, fields: {} }
    ] as any);

    const request = new NextRequest('http://localhost/api/anki/sync', {
      method: 'POST',
      body: JSON.stringify({ cardIds: [10001, 10002] })
    });

    const response = await syncPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    expect(ankiClient.answerCards).toHaveBeenCalledWith([
      { cardId: 10001, ease: 3 },
      { cardId: 10002, ease: 3 }
    ]);
  });

  it('should call answerCards with custom ease grades when using cards array', async () => {
    vi.mocked(ankiClient.answerCards).mockResolvedValue(true);
    vi.mocked(ankiClient.findCardsByQuery).mockResolvedValue([10001, 10002]);
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      { cardId: 10001, queue: 2, interval: 5, type: 2, deckName: 'test', modelName: 'test', note: 1, due: 0, fields: {} },
      { cardId: 10002, queue: 0, interval: 0, type: 0, deckName: 'test', modelName: 'test', note: 1, due: 0, fields: {} }
    ] as any);

    const request = new NextRequest('http://localhost/api/anki/sync', {
      method: 'POST',
      body: JSON.stringify({
        cards: [
          { cardId: 10001, ease: 1 },
          { cardId: 10002, ease: 4 }
        ]
      })
    });

    const response = await syncPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    expect(ankiClient.answerCards).toHaveBeenCalledWith([
      { cardId: 10001, ease: 1 },
      { cardId: 10002, ease: 4 }
    ]);
  });

  it('should filter out mature/non-due cards but keep due and learning/new cards', async () => {
    vi.mocked(ankiClient.answerCards).mockResolvedValue(true);
    vi.mocked(ankiClient.findCardsByQuery).mockResolvedValue([10001]); // 10001 is due, 10002 is not due
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      // 10001: review queue (2), due (in dueCardIds) -> KEEP
      { cardId: 10001, queue: 2, interval: 10, type: 2, deckName: 'test', modelName: 'test', note: 1, due: 0, fields: {} },
      // 10002: review queue (2), NOT due (not in dueCardIds) -> FILTER OUT
      { cardId: 10002, queue: 2, interval: 25, type: 2, deckName: 'test', modelName: 'test', note: 2, due: 0, fields: {} },
      // 10003: learning queue (1) -> KEEP (always keep learning/new)
      { cardId: 10003, queue: 1, interval: 1, type: 1, deckName: 'test', modelName: 'test', note: 3, due: 0, fields: {} }
    ] as any);

    const request = new NextRequest('http://localhost/api/anki/sync', {
      method: 'POST',
      body: JSON.stringify({ cardIds: [10001, 10002, 10003] })
    });

    const response = await syncPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);

    // Expect only 10001 and 10003 to be answered
    expect(ankiClient.answerCards).toHaveBeenCalledWith([
      { cardId: 10001, ease: 3 },
      { cardId: 10003, ease: 3 }
    ]);
  });

  it('should fall back to relearnCards/setDueDate and insertReviews when answerCards fails with "not at top of queue"', async () => {
    // 1. answerCards fails with queue error
    vi.mocked(ankiClient.answerCards).mockRejectedValue(new Error('AnkiConnect error: Invalid input: not at top of queue'));
    vi.mocked(ankiClient.findCardsByQuery).mockResolvedValue([10001]); // 10001 is due

    // 2. Mock getCardsInfo to return details for cards
    vi.mocked(ankiClient.getCardsInfo).mockResolvedValue([
      // 10001 is review type (2), interval = 10 days
      { cardId: 10001, queue: 2, interval: 10, type: 2, deckName: 'test', modelName: 'test', note: 1, due: 0, fields: {} },
      // 10002 is learning type (1), interval = 1 day
      { cardId: 10002, queue: 1, interval: 1, type: 1, deckName: 'test', modelName: 'test', note: 2, due: 0, fields: {} }
    ] as any);

    // 3. Make POST request with cards: 10001 (ease 3 - Good), 10002 (ease 1 - Again)
    const request = new NextRequest('http://localhost/api/anki/sync', {
      method: 'POST',
      body: JSON.stringify({
        cards: [
          { cardId: 10001, ease: 3 },
          { cardId: 10002, ease: 1 }
        ]
      })
    });

    const response = await syncPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.syncedCount).toBe(2);

    // 4. Verify relearnCards was called for 10002 (ease 1)
    expect(ankiClient.relearnCards).toHaveBeenCalledWith([10002]);

    // 5. Verify setDueDate was called for 10001 with '25!' (interval 10 * 2.5 = 25)
    expect(ankiClient.setDueDate).toHaveBeenCalledWith([10001], '25!');

    // 6. Verify insertReviews was called with the correct logs
    expect(ankiClient.insertReviews).toHaveBeenCalledWith(
      expect.arrayContaining([
        // Card 10001 review log
        expect.arrayContaining([
          10001, // cardID
          -1,    // usn
          3,     // buttonPressed
          25,    // newInterval
          10,    // prevInterval
          0,     // newFactor
          5000,  // duration
          1      // reviewType (review)
        ]),
        // Card 10002 relearn log
        expect.arrayContaining([
          10002, // cardID
          -1,    // usn
          1,     // buttonPressed
          -60,   // newInterval
          1,     // prevInterval
          0,     // newFactor
          5000,  // duration
          0      // reviewType (learn)
        ])
      ])
    );
  });
});

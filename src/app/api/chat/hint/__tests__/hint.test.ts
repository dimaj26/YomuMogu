import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateHints = vi.fn();

// Мокаем ChatService
vi.mock('@/lib/gemini/chat', () => ({
  chatService: {
    generateHints: (...args: any[]) => mockGenerateHints(...args),
  }
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function createRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat/hint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('API Route POST /api/chat/hint', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = createRequest({
      scenario: 'test',
      targetWords: [],
      history: []
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('should return 400 if required fields are missing', async () => {
    const req = createRequest({ scenario: 'test' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should successfully return hints', async () => {
    const mockResponse = {
      hints: [
        { level: 'easy', japanese: 'はい', translation: 'Да' },
        { level: 'medium', japanese: '猫が好きです', translation: 'Мне нравятся кошки' },
        { level: 'advanced', japanese: '猫は水を飲むのが好きですね', translation: 'Кошки ведь любят пить воду, правда?' }
      ]
    };
    mockGenerateHints.mockResolvedValue(mockResponse);

    const req = createRequest({
      scenario: 'В кафе',
      targetWords: [{ word: '猫', translation: 'кошка' }],
      history: [{ role: 'model', text: 'こんにちは！' }]
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hints).toHaveLength(3);
    expect(data.hints[0].level).toBe('easy');
    expect(mockGenerateHints).toHaveBeenCalledOnce();
  });
});

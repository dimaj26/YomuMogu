import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as sessionsPost } from '../sessions/route';
import { geminiClient } from '@/lib/gemini/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/gemini/client', () => {
  return {
    geminiClient: {
      generateSessions: vi.fn(),
    },
  };
});

describe('API Route POST /api/gemini/sessions', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    process.env.GEMINI_API_KEY = '';
    const request = new NextRequest('http://localhost/api/gemini/sessions', {
      method: 'POST',
      body: JSON.stringify({ words: [] }),
    });

    const response = await sessionsPost(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('API-ключ Gemini не настроен');

    process.env = originalEnv;
  });

  it('should return 400 if words list is missing in body', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await sessionsPost(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Необходимо передать массив слов');

    process.env = originalEnv;
  });

  it('should return empty list if words array is empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/sessions', {
      method: 'POST',
      body: JSON.stringify({ words: [] }),
    });

    const response = await sessionsPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.sessions).toEqual([]);

    process.env = originalEnv;
  });

  it('should successfully return generated sessions from client', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const mockSessions = [
      {
        id: 'session-abc',
        title: 'В магазине',
        description: 'Покупка продуктов.',
        scenario: 'ИИ: кассир, Вы: клиент',
        targetWords: [{ word: '水', translation: 'вода' }],
      },
    ];

    vi.mocked(geminiClient.generateSessions).mockResolvedValue(mockSessions);

    const request = new NextRequest('http://localhost/api/gemini/sessions', {
      method: 'POST',
      body: JSON.stringify({
        words: [{ id: 1, word: '水', translation: 'вода', status: 'new' }],
      }),
    });

    const response = await sessionsPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.sessions).toEqual(mockSessions);
    expect(geminiClient.generateSessions).toHaveBeenCalled();

    process.env = originalEnv;
  });
});

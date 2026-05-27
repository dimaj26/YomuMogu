import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as classifyPost } from '../classify/route';
import { geminiClient } from '@/lib/gemini/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/gemini/client', () => {
  return {
    geminiClient: {
      classifyWords: vi.fn(),
    },
  };
});

describe('API Route POST /api/gemini/classify', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    process.env.GEMINI_API_KEY = '';
    const request = new NextRequest('http://localhost/api/gemini/classify', {
      method: 'POST',
      body: JSON.stringify({ words: ['猫'] }),
    });

    const response = await classifyPost(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('GEMINI_API_KEY не настроен на сервере');

    process.env = originalEnv;
  });

  it('should return 400 if words is missing or empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/classify', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await classifyPost(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Обязательное поле "words" должно быть непустым массивом строк');

    process.env = originalEnv;
  });

  it('should successfully return generated classifications from client', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const mockResult = [
      { word: '猫', tags: ['home', 'universal'] },
      { word: '食べる', tags: ['universal', 'restaurant'] }
    ];

    vi.mocked(geminiClient.classifyWords).mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/gemini/classify', {
      method: 'POST',
      body: JSON.stringify({ words: ['猫', '食べる'] }),
    });

    const response = await classifyPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ classifications: mockResult });
    expect(geminiClient.classifyWords).toHaveBeenCalledWith(['猫', '食べる']);

    process.env = originalEnv;
  });
});

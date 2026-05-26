import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as etymologyPost } from '../etymology/route';
import { geminiClient } from '@/lib/gemini/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/gemini/client', () => {
  return {
    geminiClient: {
      generateEtymology: vi.fn(),
    },
  };
});

describe('API Route POST /api/gemini/etymology', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    process.env.GEMINI_API_KEY = '';
    const request = new NextRequest('http://localhost/api/gemini/etymology', {
      method: 'POST',
      body: JSON.stringify({ word: '猫' }),
    });

    const response = await etymologyPost(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('GEMINI_API_KEY не настроен на сервере');

    process.env = originalEnv;
  });

  it('should return 400 if word is missing or empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/etymology', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await etymologyPost(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Обязательное поле "word" отсутствует или пустое');

    process.env = originalEnv;
  });

  it('should successfully return generated etymology from client', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const mockResult = {
      components: ['犭 (собака)', '苗 (рассада)'],
      etymology: 'Иероглиф состоит из радикала собаки/животного и фонетика рассады (звучание МЁ: / ねこ).'
    };

    vi.mocked(geminiClient.generateEtymology).mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/gemini/etymology', {
      method: 'POST',
      body: JSON.stringify({ word: '猫' }),
    });

    const response = await etymologyPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual(mockResult);
    expect(geminiClient.generateEtymology).toHaveBeenCalledWith('猫');

    process.env = originalEnv;
  });
});

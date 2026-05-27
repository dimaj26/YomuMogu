import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as grammarVerifyPost } from '../grammar-verify/route';
import { geminiClient } from '@/lib/gemini/client';
import { NextRequest } from 'next/server';

vi.mock('@/lib/gemini/client', () => {
  return {
    geminiClient: {
      verifyGrammar: vi.fn(),
    },
  };
});

describe('API Route POST /api/gemini/grammar-verify', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    process.env.GEMINI_API_KEY = '';
    const request = new NextRequest('http://localhost/api/gemini/grammar-verify', {
      method: 'POST',
      body: JSON.stringify({ ruleId: 'g_n5_s1_1', userInput: '本を読んでください。' }),
    });

    const response = await grammarVerifyPost(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('GEMINI_API_KEY не настроен на сервере');

    process.env = originalEnv;
  });

  it('should return 400 if ruleId is missing or empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/grammar-verify', {
      method: 'POST',
      body: JSON.stringify({ userInput: '本を読んでください。' }),
    });

    const response = await grammarVerifyPost(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Обязательное поле "ruleId" отсутствует или некорректно');

    process.env = originalEnv;
  });

  it('should return 400 if userInput is missing or empty', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/grammar-verify', {
      method: 'POST',
      body: JSON.stringify({ ruleId: 'g_n5_s1_1' }),
    });

    const response = await grammarVerifyPost(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Обязательное поле "userInput" отсутствует или пустое');

    process.env = originalEnv;
  });

  it('should return 400 if ruleId does not exist in curriculum', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const request = new NextRequest('http://localhost/api/gemini/grammar-verify', {
      method: 'POST',
      body: JSON.stringify({ ruleId: 'non-existent-rule', userInput: '本を読んでください。' }),
    });

    const response = await grammarVerifyPost(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('не существует в базе данных');

    process.env = originalEnv;
  });

  it('should successfully return verify grammar result from client', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const mockResult = {
      isCorrect: true,
      correction: '',
      explanation: '',
    };

    vi.mocked(geminiClient.verifyGrammar).mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/gemini/grammar-verify', {
      method: 'POST',
      body: JSON.stringify({ ruleId: 'g_n5_s1_1', userInput: '本を読んでください。' }),
    });

    const response = await grammarVerifyPost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual(mockResult);
    expect(geminiClient.verifyGrammar).toHaveBeenCalled();

    process.env = originalEnv;
  });
});

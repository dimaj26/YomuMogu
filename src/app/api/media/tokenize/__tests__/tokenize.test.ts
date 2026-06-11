import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as tokenizePost, GET as tokenizeGet } from '../route';
import { NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/csrf';

vi.mock('@/lib/csrf', () => ({
  verifyCsrf: vi.fn(),
}));

describe('API Route POST /api/media/tokenize', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyCsrf).mockReturnValue(true);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return 403 if CSRF is invalid', async () => {
    vi.mocked(verifyCsrf).mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本語' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('CSRF');
  });

  it('should return 400 if text is missing or empty', async () => {
    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('text');
  });

  it('should return tokenized lemmas from microservice successfully', async () => {
    const mockLemmas = ['日本', '語'];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lemmas: mockLemmas }),
    });

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本語' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.lemmas).toEqual(mockLemmas);
  });

  it('should return detailed tokens in detailed mode successfully', async () => {
    const mockTokens = [{ surface: '日本', pos: '名詞', lemma: '日本', reading: 'ニホン' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: mockTokens }),
    });

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本', mode: 'detailed' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tokens).toEqual(mockTokens);
  });

  it('возвращает 200 с tokenizationSkipped при недоступном токенизаторе', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本語' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tokenizationSkipped).toBe(true);
    expect(data.tokens).toEqual([]);
    expect(data.lemmas).toEqual([]);
  });

  it('возвращает 200 с tokenizationSkipped если микросервис вернул ошибку', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Error',
    });

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本語' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tokenizationSkipped).toBe(true);
    expect(data.tokens).toEqual([]);
    expect(data.lemmas).toEqual([]);
  });

  it('возвращает 200 с tokenizationSkipped при таймауте', async () => {
    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本語' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tokenizationSkipped).toBe(true);
  });
});

describe('API Route GET /api/media/tokenize', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('GET /api/media/tokenize проксирует /health и сообщает status ok при успехе', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'GET',
    });

    const response = await tokenizeGet(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('ok');
    expect(data.tokenizerDown).toBe(false);
  });

  it('GET /api/media/tokenize проксирует /health и сообщает tokenizerDown при ошибке', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'GET',
    });

    const response = await tokenizeGet(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.tokenizerDown).toBe(true);
  });
});


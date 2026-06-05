import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as tokenizePost } from '../route';
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

  it('should return 502 if microservice returns an error status', async () => {
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
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain('500');
  });

  it('should return 504 if microservice times out / aborts', async () => {
    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({ text: '日本語' }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(504);
    const data = await response.json();
    expect(data.error).toContain('ожидания');
  });
});

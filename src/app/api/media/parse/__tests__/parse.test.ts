import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as parsePost } from '../route';
import { NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/csrf';
import { extractYoutubeVideoId } from '@/lib/media/youtube';
import { parseSrtOrVtt } from '@/lib/media/parser';

vi.mock('@/lib/csrf', () => ({
  verifyCsrf: vi.fn(),
}));

describe('YouTube URL video ID extraction helper', () => {
  it('should extract 11-char video ID from various YouTube URL formats', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=shared')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('http://invalid-url.com')).toBeNull();
  });
});

describe('SRT and VTT subtitle parser helper', () => {
  it('should strip index lines, timestamps, and metadata to return clean lines', () => {
    const srtContent = `1
00:00:01,120 --> 00:00:03,540
こんにちは。

2
00:00:03,540 --> 00:00:06,100
お元気ですか？`;

    const vttContent = `WEBVTT

1
00:00:01.120 --> 00:00:03.540
こんにちは。

2
00:00:03.540 --> 00:00:06.100
お元気ですか？`;

    const expected = 'こんにちは。\nお元気ですか？';
    expect(parseSrtOrVtt(srtContent)).toBe(expected);
    expect(parseSrtOrVtt(vttContent)).toBe(expected);
    expect(parseSrtOrVtt('')).toBe('');
  });
});

describe('API Route POST /api/media/parse', () => {
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

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ srtText: 'subtitle content' }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('CSRF');
  });

  it('should parse srtText and call tokenizer successfully without caching', async () => {
    const mockLemmas = ['こんにちは', '元気'];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lemmas: mockLemmas }),
    });

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({
        srtText: `1\n00:00:01,000 --> 00:00:03,000\nこんにちは。\n\n2\n00:00:03,000 --> 00:00:05,000\n元気？`
      }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.lemmas).toEqual(mockLemmas);
    expect(data.cached).toBe(false);
  });

  it('should scrape YouTube watch page, fetch caption XML, tokenize, and cache results', async () => {
    const mockWatchPageHtml = `
      <html>
        <body>
          <script>
            var ytInitialPlayerResponse = {
              "captions": {
                "playerCaptionsTracklistRenderer": {
                  "captionTracks": [
                    {
                      "baseUrl": "https://www.youtube.com/api/timedtext?v=testVideoId&lang=ja",
                      "languageCode": "ja",
                      "vssId": ".ja"
                    }
                  ]
                }
              }
            };
          </script>
        </body>
      </html>
    `;

    const mockXmlText = `<?xml version="1.0" encoding="utf-8" ?>
      <transcript>
        <text start="0.0" dur="2.0">こんにちは。</text>
        <text start="2.0" dur="2.0">日本に行きます。</text>
      </transcript>
    `;

    const mockLemmas = ['こんにちは', '日本', '行く'];

    // Мокаем fetch для трех последовательных запросов:
    // 1. YouTube watch page
    // 2. YouTube caption XML
    // 3. VPS tokenizer /tokenize
    let fetchCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        return {
          ok: true,
          text: async () => mockWatchPageHtml,
        } as Response;
      } else if (fetchCallCount === 2) {
        return {
          ok: true,
          text: async () => mockXmlText,
        } as Response;
      } else {
        return {
          ok: true,
          json: async () => ({ lemmas: mockLemmas }),
        } as Response;
      }
    });

    const request1 = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=testVideoId' }),
    });

    const response1 = await parsePost(request1);
    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    expect(data1.success).toBe(true);
    expect(data1.lemmas).toEqual(mockLemmas);
    expect(data1.cached).toBe(false);

    // Сбрасываем счетчик вызовов fetch и мокаем для второго запроса (проверить кэширование)
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();

    const request2 = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=testVideoId' }),
    });

    const response2 = await parsePost(request2);
    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    expect(data2.success).toBe(true);
    expect(data2.lemmas).toEqual(mockLemmas);
    expect(data2.cached).toBe(true); // Должно вернуться из in-memory кэша
    expect(globalThis.fetch).not.toHaveBeenCalled(); // fetch не должен вызываться
  });
});

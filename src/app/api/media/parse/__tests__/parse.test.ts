import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as parsePost } from '../route';
import { NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/csrf';
import { extractYoutubeVideoId } from '@/lib/media/youtube';
import { parseSrtOrVtt, parseSubtitlesToSegments } from '@/lib/media/parser';

vi.mock('@/lib/csrf', () => ({
  verifyCsrf: vi.fn(),
}));

vi.mock('@/lib/media/cache', () => ({
  getCachedAvailability: vi.fn(() => undefined),
  setCachedAvailability: vi.fn(),
  getCachedTranscript: vi.fn(() => undefined),
  setCachedTranscript: vi.fn(),
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

  it('should parse SRT and VTT into structured SubtitleSegment arrays with correct timings', () => {
    const srtContent = `1
00:00:01,120 --> 00:00:03,540
こんにちは。

2
00:00:03,540 --> 00:00:06,100
お元気ですか？`;

    const segments = parseSubtitlesToSegments(srtContent);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      start: 1.12,
      duration: 2.42,
      text: 'こんにちは。'
    });
    expect(segments[1]).toEqual({
      start: 3.54,
      duration: 2.56,
      text: 'お元気ですか？'
    });
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

  const mockWatchPageHtml = `
    <html>
      <body>
        <script>
          var ytInitialPlayerResponse = {
            "captions": {
              "playerCaptionsTracklistRenderer": {
                "captionTracks": [
                  {
                    "baseUrl": "https://www.youtube.com/api/timedtext?v=testVideoI1&lang=ja",
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

  function setupFetchMock({
    watchPageOk = true,
    watchPageHtml = mockWatchPageHtml,
    playerOk = true,
    xmlOk = true,
    xmlText = mockXmlText,
    tokenizeOk = true,
    tokenizeLemmas = mockLemmas,
    tokenizeError = null as Error | null
  } = {}) {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('watch?v=')) {
        if (!watchPageOk) {
          return { ok: false, status: 404, statusText: 'Not Found' } as Response;
        }
        return {
          ok: true,
          headers: {
            getSetCookie: () => ['VISITOR_INFO1_LIVE=abc', 'YSC=xyz']
          },
          text: async () => watchPageHtml,
        } as Response;
      }
      if (urlStr.includes('/youtubei/v1/player')) {
        if (!playerOk) {
          return { ok: false, status: 400, statusText: 'Bad Request' } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: 'https://www.youtube.com/api/timedtext?v=testVideoI1&lang=ja',
                    languageCode: 'ja',
                    vssId: '.ja'
                  }
                ]
              }
            }
          })
        } as Response;
      }
      if (urlStr.includes('fmt=json3')) {
        return {
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        } as Response;
      }
      if (urlStr.includes('timedtext')) {
        if (!xmlOk) {
          return { ok: false, status: 500, statusText: 'Error' } as Response;
        }
        return {
          ok: true,
          text: async () => xmlText,
        } as Response;
      }
      if (urlStr.includes('tokenize')) {
        if (tokenizeError) {
          throw tokenizeError;
        }
        if (!tokenizeOk) {
          return { ok: false, status: 500, text: async () => 'Tokenize Error' } as Response;
        }
        return {
          ok: true,
          json: async () => ({ lemmas: tokenizeLemmas }),
        } as Response;
      }
      return { ok: false, status: 500 } as Response;
    });
  }

  it('should scrape YouTube watch page, fetch caption XML, tokenize, and cache results', async () => {
    setupFetchMock();

    const request1 = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=testVideoI1' }),
    });

    const response1 = await parsePost(request1);
    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    expect(data1.success).toBe(true);
    expect(data1.lemmas).toEqual(mockLemmas);
    expect(data1.cached).toBe(false);
    expect(data1.source).toBe('scraped');

    // Проверяем кэширование при повторном запросе
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();

    const request2 = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=testVideoI1' }),
    });

    const response2 = await parsePost(request2);
    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    expect(data2.success).toBe(true);
    expect(data2.lemmas).toEqual(mockLemmas);
    expect(data2.cached).toBe(true);
    expect(data2.source).toBe('cache');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should prioritize scraping over pregenerated transcripts', async () => {
    // 1VVZFkqYwAE есть в pregenerated, но мы эмулируем успешный скрейпинг
    setupFetchMock();

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=1VVZFkqYwAE' }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.source).toBe('scraped');
    // Должны вернуться скрейпленные сегменты, а не предсгенерированные
    expect(data.segments[0].text).toContain('こんにちは。');
  });

  it('should fallback to pregenerated transcripts if scraping fails', async () => {
    // Jnea4HbYIso есть в pregenerated, эмулируем ошибку скрейпинга (например, watch page 404)
    setupFetchMock({ watchPageOk: false });

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=Jnea4HbYIso' }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.source).toBe('pregenerated');
    // Должны вернуться предсгенерированные сегменты
    expect(data.segments.length).toBeGreaterThan(0);
    expect(data.segments[0].text).toContain('年末');
  });

  it('should bypass cache when forceScrape is true', async () => {
    setupFetchMock();

    // Первый запрос, чтобы положить в кэш
    const request1 = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=cacheTestV1' }),
    });
    await parsePost(request1);

    // Второй запрос с forceScrape: true
    vi.clearAllMocks();
    setupFetchMock();

    const request2 = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=cacheTestV1',
        forceScrape: true
      }),
    });

    const response2 = await parsePost(request2);
    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    expect(data2.success).toBe(true);
    expect(data2.cached).toBe(false); // Должен обойти кэш
    expect(data2.source).toBe('scraped');
    expect(globalThis.fetch).toHaveBeenCalled(); // Fetch должен быть вызван снова
  });

  it('should return source and hasWords in response', async () => {
    setupFetchMock();

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=testVideoI2' }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.source).toBe('scraped');
    expect(typeof data.hasWords).toBe('boolean');
  });

  it('should return 200 with segments, empty lemmas, and tokenizerDown: true when tokenizer is down but segments are found', async () => {
    // MeCab токенизатор падает с ошибкой подключения
    setupFetchMock({
      tokenizeError: new Error('Connection refused')
    });

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=IJEn-9nAFQE' }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tokenizerDown).toBe(true);
    expect(data.lemmas).toEqual([]);
    expect(data.segments.length).toBeGreaterThan(0);
  });

  it('should return 502 with distinct error message when YouTube video is unavailable', async () => {
    // Имитируем падение скрапера с ошибкой недоступности
    setupFetchMock({
      watchPageHtml: `<html><body><div id="player-unavailable">This video is unavailable.</div></body></html>`
    });

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=unavailabl1' }),
    });

    const response = await parsePost(request);
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain('Видео недоступно или удалено');
  });
});


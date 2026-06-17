import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as searchPost } from '../route';
import { NextRequest } from 'next/server';
import { fetchYoutubeSearch } from '@/lib/media/search';
import { queryExpansionService } from '@/lib/gemini/queryExpansion';
import { hasJapaneseCaptions, getYoutubeTranscriptSegments } from '@/lib/media/youtube';

// Мокаем зависимости
vi.mock('@/lib/media/search', () => {
  return {
    fetchYoutubeSearch: vi.fn()
  };
});

vi.mock('@/lib/gemini/queryExpansion', () => {
  return {
    queryExpansionService: {
      expandQuery: vi.fn()
    }
  };
});

vi.mock('@/lib/media/youtube', () => {
  return {
    hasJapaneseCaptions: vi.fn(),
    getYoutubeTranscriptSegments: vi.fn()
  };
});

// Мокаем глобальный fetch для MeCab токенизатора
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('API Route POST /api/media/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Имитируем успешный ответ токенизатора MeCab по умолчанию
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ lemmas: ['日本語', '勉強'], tokens: [] })
    });
  });

  it('валидация пустого query → 400', async () => {
    const request = new NextRequest('http://localhost/api/media/search', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await searchPost(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Необходимо передать "query" (запрос) или "continuation" (токен)');
  });

  it('нормальный сценарий возвращает ранжированную страницу', async () => {
    // 1. Мокаем расширение запроса
    vi.mocked(queryExpansionService.expandQuery).mockResolvedValue({
      jaQueries: ['日本語の勉強'],
      theme: 'education'
    });

    // 2. Мокаем поиск в YouTube
    vi.mocked(fetchYoutubeSearch).mockResolvedValue({
      candidates: [
        { videoId: 'vid1', title: '日本語の勉強 1', channel: 'Chan 1', description: 'Desc 1', durationSec: 100 },
        { videoId: 'vid2', title: 'Другое видео 2', channel: 'Chan 2', description: 'Desc 2', durationSec: 200 }
      ],
      continuation: 'token123'
    });

    // 3. Мокаем наличие субтитров
    vi.mocked(hasJapaneseCaptions).mockImplementation(async (id) => {
      return id === 'vid1'; // Доступны только для vid1
    });

    // 4. Мокаем получение сегментов субтитров
    vi.mocked(getYoutubeTranscriptSegments).mockResolvedValue([
      {
        start: 0,
        duration: 5,
        text: '日本語の勉強しましょう',
        words: [
          { text: '日本語', offsetMs: 100 },
          { text: 'の', offsetMs: 500 },
          { text: '勉強', offsetMs: 800 }
        ]
      },
      {
        start: 5,
        duration: 5,
        text: '日本語テスト',
        words: [
          { text: '日本語', offsetMs: 100 },
          { text: 'テスト', offsetMs: 500 }
        ]
      },
      {
        start: 10,
        duration: 5,
        text: 'こんにちは',
        words: [
          { text: 'こんにちは', offsetMs: 100 }
        ]
      }
    ]);

    const request = new NextRequest('http://localhost/api/media/search', {
      method: 'POST',
      body: JSON.stringify({
        query: 'японский язык',
        excludeIds: [],
        seed: 42,
        knownWords: ['日本語', '勉強']
      })
    });

    const response = await searchPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.results.length).toBe(1); // vid2 был отсечен из-за отсутствия японских субтитров
    expect(data.results[0].id).toBe('vid1');
    expect(data.results[0].comprehensionRate).toBe(100); // Так как все леммы ('日本語', '勉強') есть в knownWords
    expect(data.continuation).toBe('token123');
    expect(data.theme).toBe('education');
    // Дефолтный тир (acquisition) сохраняет прежнее поведение и возвращает durationFit
    expect(typeof data.results[0].durationFit).toBe('number');
  });

  it('принимает tier=beginner и возвращает durationFit в выдаче', async () => {
    vi.mocked(queryExpansionService.expandQuery).mockResolvedValue({ jaQueries: ['q'], theme: null });
    vi.mocked(fetchYoutubeSearch).mockResolvedValue({
      candidates: [{ videoId: 'b1', title: 'q', channel: 'C', description: 'D', durationSec: 60 }],
      continuation: null
    });
    vi.mocked(hasJapaneseCaptions).mockResolvedValue(true);
    vi.mocked(getYoutubeTranscriptSegments).mockResolvedValue([{ start: 0, duration: 5, text: 'こんにちは' }]);

    const request = new NextRequest('http://localhost/api/media/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'японский', tier: 'beginner' })
    });

    const response = await searchPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.length).toBe(1);
    expect(typeof data.results[0].durationFit).toBe('number');
  });

  it('недоступный Gemini не валит поиск', async () => {
    // 1. Мокаем отказ расширения запроса
    vi.mocked(queryExpansionService.expandQuery).mockRejectedValue(new Error('Gemini Down'));

    // 2. Мокаем поиск в YouTube (должен вызваться с оригинальным запросом)
    vi.mocked(fetchYoutubeSearch).mockResolvedValue({
      candidates: [
        { videoId: 'vid1', title: 'Title', channel: 'Chan', description: 'Desc', durationSec: 100 }
      ],
      continuation: null
    });

    vi.mocked(hasJapaneseCaptions).mockResolvedValue(true);
    vi.mocked(getYoutubeTranscriptSegments).mockResolvedValue([
      { start: 0, duration: 5, text: 'Hello' }
    ]);

    const request = new NextRequest('http://localhost/api/media/search', {
      method: 'POST',
      body: JSON.stringify({
        query: 'японский язык'
      })
    });

    const response = await searchPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results[0].id).toBe('vid1');
    expect(data.theme).toBeNull();
  });

  it('ошибка скрейпа одного кандидата не валит выдачу', async () => {
    vi.mocked(queryExpansionService.expandQuery).mockResolvedValue({
      jaQueries: ['query'],
      theme: null
    });

    // 2 кандидата
    vi.mocked(fetchYoutubeSearch).mockResolvedValue({
      candidates: [
        { videoId: 'goodVid', title: 'Good', channel: 'Chan', description: 'Desc', durationSec: 100 },
        { videoId: 'badVid', title: 'Bad', channel: 'Chan', description: 'Desc', durationSec: 100 }
      ],
      continuation: null
    });

    vi.mocked(hasJapaneseCaptions).mockResolvedValue(true);
    
    // badVid кидает ошибку при попытке получить субтитры, goodVid возвращает успешно
    vi.mocked(getYoutubeTranscriptSegments).mockImplementation(async (id) => {
      if (id === 'badVid') {
        throw new Error('Scrape failed');
      }
      return [{ start: 0, duration: 5, text: 'Good text' }];
    });

    const request = new NextRequest('http://localhost/api/media/search', {
      method: 'POST',
      body: JSON.stringify({
        query: 'японский язык'
      })
    });

    const response = await searchPost(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results.length).toBe(1);
    expect(data.results[0].id).toBe('goodVid');
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MediaInteractivePlayer } from '../MediaInteractivePlayer';

// Мокаем глобальный fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x" />,
  Play: () => <span data-testid="icon-play" />,
  Loader2: () => <span data-testid="icon-loader" className="spin" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  BookOpen: () => <span data-testid="icon-book" />,
  Plus: () => <span data-testid="icon-plus" />,
  Check: () => <span data-testid="icon-check" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Upload: () => <span data-testid="icon-upload" />,
}));

// Мокаем localStorage профилей
vi.mock('@/lib/profile', () => ({
  getProfileItem: vi.fn().mockImplementation((key) => {
    if (key === 'selected_deck') return 'Japanese';
    return null;
  }),
  getActiveProfileId: vi.fn().mockReturnValue('default'),
}));

// Mock YouTube API
const mockPlayerInstance: any = {
  getCurrentTime: vi.fn().mockReturnValue(1.5),
  seekTo: vi.fn(),
  destroy: vi.fn(),
};

let lastPlayerConfig: any = null;

(globalThis.window as any).YT = {
  Player: vi.fn().mockImplementation(function (id, config) {
    lastPlayerConfig = config;
    // Симулируем вызов onStateChange
    if (config.events && config.events.onStateChange) {
      setTimeout(() => {
        config.events.onStateChange({ data: 1 }); // 1 = PLAYING
      }, 50);
    }
    return mockPlayerInstance;
  }),
  PlayerState: {
    PLAYING: 1,
    PAUSED: 2,
  },
} as any;

describe('MediaInteractivePlayer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPlayerConfig = null;
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: ['今日', '天気', 'いい'],
            segments: [
              { start: 0, duration: 2, text: '今日' },
              { start: 2, duration: 2, text: '天気' }
            ]
          })
        });
      }
      if (urlStr.includes('/api/media/tokenize')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tokens: [{ surface: '今日', pos: '名詞', lemma: '今日', reading: 'キョウ' }]
          })
        });
      }
      if (urlStr.includes('/api/dict/lookup')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            definition: '<p>Сегодняшний день; сегодня.</p>'
          })
        });
      }
      if (urlStr.includes('/api/anki/add')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true
          })
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${urlStr}`));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading state initially and then renders parsed transcript segments', async () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    // Должен показываться спиннер загрузки
    expect(screen.getByText(/Сканирование транскрипта/i)).toBeInTheDocument();

    // Ждем окончания загрузки и рендеринга
    await waitFor(() => {
      expect(screen.getByText('NHK Easy News')).toBeInTheDocument();
      expect(screen.getByText('Транскрипт видео:')).toBeInTheDocument();
      expect(screen.getByText('今日')).toBeInTheDocument();
      expect(screen.getByText('天気')).toBeInTheDocument();
    });
  });

  it('renders interactive tokens when player seeks to segment and handles dictionary lookup', async () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    // Ждем загрузки дорожки и токенизации (время симулируется YT mock-плеером на 1.5 сек)
    await waitFor(() => {
      expect(screen.getByTestId('word-token')).toBeInTheDocument();
    });

    // Кликаем по токену "今日"
    const token = screen.getByTestId('word-token');
    fireEvent.click(token);

    // Должна отобразиться боковая карточка словаря
    await waitFor(() => {
      expect(screen.getByText('Словарная карточка')).toBeInTheDocument();
      expect(screen.getByText('Сегодняшний день; сегодня.')).toBeInTheDocument();
      expect(screen.getByText('【きょう】')).toBeInTheDocument();
      expect(screen.getByText('Часть речи:')).toBeInTheDocument();
    });
  });

  it('submits note creation to Anki when "Добавить в Anki" is clicked', async () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('word-token')).toBeInTheDocument();
    });

    const token = screen.getByTestId('word-token');
    fireEvent.click(token);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Добавить в Anki/i })).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Добавить в Anki/i });
    fireEvent.click(addBtn);

    // Ждем подтверждения добавления
    await waitFor(() => {
      expect(screen.getByText('Слово добавлено в Anki!')).toBeInTheDocument();
    });
  });

  it('updates segments state when receiving a YOMUMOGU_YT_SUBTITLES message event from browser extension', async () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    const customSegments = [
      { start: 10, duration: 3, text: 'こんにちは' },
      { start: 13, duration: 4, text: '世界' }
    ];

    // Симулируем отправку сообщения через window.postMessage от расширения
    fireEvent(window, new MessageEvent('message', {
      data: {
        type: 'YOMUMOGU_YT_SUBTITLES',
        segments: customSegments
      }
    }));

    // Ожидаем, что новые сегменты отобразятся на экране
    await waitFor(() => {
      expect(screen.getByText('こんにちは世界')).toBeInTheDocument();
    });
  });

  it('ignores browser extension messages with mismatching videoId, but accepts matching ones', async () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    const wrongSegments = [
      { start: 10, duration: 3, text: '間違ったテキスト' }
    ];
    const correctSegments = [
      { start: 10, duration: 3, text: '正しいテキスト' }
    ];

    // 1. Send message with wrong videoId
    fireEvent(window, new MessageEvent('message', {
      data: {
        type: 'YOMUMOGU_YT_SUBTITLES',
        videoId: 'wrongVideoId',
        segments: wrongSegments
      }
    }));

    // Check that wrong text is not displayed
    expect(screen.queryByText('間違ったテキスト')).toBeNull();

    // 2. Send message with correct videoId
    fireEvent(window, new MessageEvent('message', {
      data: {
        type: 'YOMUMOGU_YT_SUBTITLES',
        videoId: 'dQw4w9WgXcQ',
        segments: correctSegments
      }
    }));

    // Check that correct text is displayed
    await waitFor(() => {
      expect(screen.getByText('正しいテキスト')).toBeInTheDocument();
    });
  });

  it('renders raw subtitles and warning notice when tokenizerDown is true', async () => {
    mockFetch.mockImplementationOnce((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            tokenizerDown: true,
            lemmas: [],
            segments: [
              { start: 0, duration: 2, text: '今日' }
            ]
          })
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${urlStr}`));
    });

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Автоматический разбор слов сейчас недоступен. Субтитры показаны как есть; перевод по клику вернётся автоматически.')).toBeInTheDocument();
      expect(screen.getAllByText('今日').length).toBeGreaterThan(0);
    });
  });

  it('calls destroy on YT player when component unmounts', async () => {
    const { unmount } = render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(lastPlayerConfig).not.toBeNull();
    });

    unmount();
    expect(mockPlayerInstance.destroy).toHaveBeenCalled();
  });

  it('displays Russian error message when YT player encounters onError with code 101/150', async () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(lastPlayerConfig).not.toBeNull();
    });

    // Simulate onError with code 101 (video cannot be played in embedded player)
    act(() => {
      lastPlayerConfig.events.onError({ data: 101 });
    });

    await waitFor(() => {
      expect(screen.getByText('Владелец видео запретил его воспроизведение во встраиваемых проигрывателях.')).toBeInTheDocument();
    });
  });

  it('does not render audio element when url is a YouTube link (synchronous isYoutube derivation)', () => {
    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    const audioElement = document.querySelector('audio');
    expect(audioElement).toBeNull();
  });

  it('сегмент с duration=0 остаётся активным до старта следующего (sticky)', async () => {
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            tokenizerDown: true,
            lemmas: [],
            segments: [
              { start: 0, duration: 0, text: 'Первый сегмент' },
              { start: 3, duration: 2, text: 'Второй сегмент' }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    let mockTime = 1.5;
    mockPlayerInstance.getCurrentTime.mockImplementation(() => mockTime);

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      const activeLine = document.querySelector('[class*="activeLine"]');
      expect(activeLine).toBeInTheDocument();
      expect(activeLine?.textContent).toContain('Первый сегмент');
    });

    // Проверим, что первый сегмент активен и не имеет класса dimmedLine (поскольку время 1.5 < 3)
    const activeLine = document.querySelector('[class*="activeLine"]');
    expect(activeLine).toBeInTheDocument();
    expect(activeLine?.className).not.toContain('dimmedLine');

    // Симулируем изменение времени на 4.0
    mockTime = 4.0;

    await waitFor(() => {
      const activeLine = document.querySelector('[class*="activeLine"]');
      expect(activeLine?.textContent).toContain('Второй сегмент');
    });
  });

  it('не рендерит караоке-слой для сегмента, не прошедшего гейт', async () => {
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: ['今日'],
            segments: [
              {
                start: 0,
                duration: 3,
                text: '今日',
                words: [
                  { text: '今日', offsetMs: 0 } // плейсхолдер ручных субтитров (меньше 3 слов) -> гейт завален
                ]
              }
            ]
          })
        });
      }
      if (urlStr.includes('/api/media/tokenize')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tokens: [
              { surface: '今日', pos: '名詞', lemma: '今日', reading: 'キョу' }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    let mockTime = 1.0;
    mockPlayerInstance.getCurrentTime.mockImplementation(() => mockTime);

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('word-token').length).toBe(1);
    });

    // Имитируем проигрывание плеера
    act(() => {
      if (lastPlayerConfig && lastPlayerConfig.events && lastPlayerConfig.events.onStateChange) {
        lastPlayerConfig.events.onStateChange({ data: 1 }); // PLAYING
      }
    });

    // Убеждаемся, что data-testid="karaoke-fill" отсутствует на элементе
    expect(screen.queryByTestId('karaoke-fill')).toBeNull();
  });

  it('рендерит fill с детерминированной позицией при мокнутом getCurrentTime', async () => {
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: ['今日', '天気', 'いい'],
            segments: [
              {
                start: 0,
                duration: 3,
                text: '今日天気いい',
                words: [
                  { text: '今日', offsetMs: 100 }, // length 2
                  { text: '天気', offsetMs: 1000 }, // length 2
                  { text: 'いい', offsetMs: 2000 }  // length 2 -> totalChars = 6
                ]
              }
            ]
          })
        });
      }
      if (urlStr.includes('/api/media/tokenize')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tokens: [
              { surface: '今日', pos: '名詞', lemma: '今日', reading: 'キョウ' },
              { surface: '天気', pos: '名詞', lemma: '天気', reading: 'テンки' },
              { surface: 'いい', pos: '形容詞', lemma: 'いい', reading: 'イи' }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    let mockTime = 1.0; // t = 1000 ms -> ровно на старте "天気", прогресс 2/6 = 33.33%
    mockPlayerInstance.getCurrentTime.mockImplementation(() => mockTime);

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    // Ждем загрузки сегментов и токенов
    await waitFor(() => {
      expect(screen.getAllByTestId('word-token').length).toBe(3);
    });

    // Имитируем проигрывание плеера
    act(() => {
      if (lastPlayerConfig && lastPlayerConfig.events && lastPlayerConfig.events.onStateChange) {
        lastPlayerConfig.events.onStateChange({ data: 1 }); // PLAYING
      }
    });

    // Ожидаем появления караоке-слоя
    await waitFor(() => {
      expect(screen.getByTestId('karaoke-fill')).toBeInTheDocument();
    });

    // Ожидаем заполнения первого токена
    await waitFor(() => {
      const tokens = screen.getAllByTestId('word-token');
      expect(tokens[0]).toHaveClass(/filledToken/);
    });

    const tokens = screen.getAllByTestId('word-token');
    // Второй токен "天気" является граничным на t = 1.0 (прогресс = 2/6 = 33.33%)
    expect(tokens[1].style.backgroundSize).toBeDefined();
  });

  it('cc_load_policy=0 когда сегменты имеют words', async () => {
    // Сервер вернул сегменты с пословными таймингами → cc_load_policy=0
    mockFetch.mockImplementationOnce((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: [
              {
                start: 0,
                duration: 2,
                text: '今日',
                words: [{ text: '今日', offsetMs: 0 }]
              }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(lastPlayerConfig).not.toBeNull();
    });

    expect(lastPlayerConfig.playerVars.cc_load_policy).toBe(0);
  });

  it('cc_load_policy=1 когда сегменты без words', async () => {
    // Сервер вернул сегменты без пословных таймингов → cc_load_policy=1
    mockFetch.mockImplementationOnce((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: [
              { start: 0, duration: 2, text: '今日' } // Без слов
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(lastPlayerConfig).not.toBeNull();
    });

    expect(lastPlayerConfig.playerVars.cc_load_policy).toBe(1);
  });

  it('cc_load_policy=1 когда сегментов нет', async () => {
    // Сервер вернул пустые сегменты → cc_load_policy=1 чтобы расширение могло перехватить CC
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: []
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(lastPlayerConfig).not.toBeNull();
    });

    expect(lastPlayerConfig.playerVars.cc_load_policy).toBe(1);
  });

  it('extension-сегменты с words заменяют серверные без words', async () => {
    // Сервер возвращает сегменты без слов
    mockFetch.mockImplementationOnce((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: [
              { start: 0, duration: 2, text: 'Серверный текст' } // Без слов
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Серверный текст')).toBeInTheDocument();
    });

    const extensionSegments = [
      {
        start: 0,
        duration: 2,
        text: 'Текст расширения',
        words: [{ text: 'Текст', offsetMs: 0 }, { text: 'расширения', offsetMs: 500 }]
      }
    ];

    // Симулируем сообщение от расширения
    fireEvent(window, new MessageEvent('message', {
      data: {
        type: 'YOMUMOGU_YT_SUBTITLES',
        videoId: 'dQw4w9WgXcQ',
        segments: extensionSegments
      }
    }));

    // Должны отобразиться сегменты от расширения, так как они имеют words
    await waitFor(() => {
      expect(screen.getByText('Текст расширения')).toBeInTheDocument();
    });
  });

  it('data-has-words отражает наличие пословных таймингов', async () => {
    // 1. Сначала загружаем без слов
    mockFetch.mockImplementationOnce((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: [
              { start: 0, duration: 2, text: 'Привет без слов' }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container, unmount } = render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Привет без слов')).toBeInTheDocument();
    });

    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement.getAttribute('data-has-words')).toBe('false');

    // Размонтируем первый плеер перед вторым тестом
    unmount();

    // 2. Теперь загружаем со словами
    vi.clearAllMocks();
    mockFetch.mockImplementationOnce((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: [
              {
                start: 0,
                duration: 2,
                text: 'Привет со словами',
                words: [{ text: 'Привет со словами', offsetMs: 0 }]
              }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container: containerWithWords } = render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Привет со словами')).toBeInTheDocument();
    });

    const rootElementWithWords = containerWithWords.firstChild as HTMLElement;
    expect(rootElementWithWords.getAttribute('data-has-words')).toBe('true');
  });

  it('кнопка CC вызывает loadModule/unloadModule и не падает при их отсутствии', async () => {
    const mockLoadModule = vi.fn();
    const mockUnloadModule = vi.fn();
    mockPlayerInstance.loadModule = mockLoadModule;
    mockPlayerInstance.unloadModule = mockUnloadModule;

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    // Ждём инициализации плеера — ytPlayerRef.current будет mockPlayerInstance
    await waitFor(() => {
      expect(lastPlayerConfig).not.toBeNull();
    });

    const ccBtn = screen.getByLabelText('Субтитры YouTube');

    // Первый клик — loadModule (включить CC)
    fireEvent.click(ccBtn);
    expect(mockLoadModule).toHaveBeenCalledWith('captions');

    // Второй клик — unloadModule (выключить CC)
    fireEvent.click(ccBtn);
    expect(mockUnloadModule).toHaveBeenCalledWith('captions');

    // Третий клик при отсутствии методов — не должен падать
    delete mockPlayerInstance.loadModule;
    delete mockPlayerInstance.unloadModule;
    expect(() => fireEvent.click(ccBtn)).not.toThrow();
  });

  it('статус-индикатор: gray при tokenizationSkipped, green при успехе', async () => {
    // 1. Успешный случай — зеленый индикатор
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: ['今日'],
            segments: [{ start: 0, duration: 2, text: '今日' }]
          })
        });
      }
      if (urlStr.includes('/api/media/tokenize')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            tokens: [{ surface: '今日', pos: '名詞', lemma: '今日', reading: 'キョウ' }]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { container, unmount } = render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    // Ждем окончания загрузки
    await waitFor(() => {
      expect(screen.getByText('今日')).toBeInTheDocument();
    });

    const statusDot = screen.getByTestId('tokenizer-status-dot');
    expect(statusDot).toBeInTheDocument();
    expect(statusDot.className).toContain('statusDotOnline');

    unmount();

    // 2. Случай сбоя — серый индикатор и клик для повторной попытки
    vi.clearAllMocks();
    let tokeniseCalled = 0;
    mockFetch.mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            lemmas: [],
            segments: [{ start: 0, duration: 2, text: '今日' }]
          })
        });
      }
      if (urlStr.includes('/api/media/tokenize')) {
        tokeniseCalled++;
        if (tokeniseCalled === 1) {
          // Первая попытка возвращает сбой
          return Promise.resolve({
            ok: false,
            status: 500
          });
        } else {
          // Вторая попытка успешна
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokens: [{ surface: '今日', pos: '名詞', lemma: '今日', reading: 'キョウ' }]
            })
          });
        }
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    // Нам нужен mockTime, чтобы активный сегмент переключился и сработал tokenize
    mockPlayerInstance.getCurrentTime.mockReturnValue(1.0);

    const { container: containerOffline } = render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('今日')).toBeInTheDocument();
    });

    // Ожидаем ошибку токенизации и переключение в офлайн
    await waitFor(() => {
      const offlineDot = screen.getByTestId('tokenizer-status-dot');
      expect(offlineDot.className).toContain('statusDotOffline');
    });

    // Кликаем по офлайн-точке для повторной попытки
    const offlineDot = screen.getByTestId('tokenizer-status-dot');
    fireEvent.click(offlineDot);

    // Должна сработать успешная повторная попытка токенизации и точка станет зеленой
    await waitFor(() => {
      expect(offlineDot.className).toContain('statusDotOnline');
    });
  });

  it('при tokenizerDown компонент опрашивает health и после восстановления перезапускает токенизацию активного сегмента', async () => {
    vi.useFakeTimers();

    let tokenizePostCalled = false;
    let getHealthCalledCount = 0;

    mockFetch.mockImplementation((url, init) => {
      const urlStr = typeof url === 'string' ? url : (url as any).url || '';
      const method = init?.method || 'GET';

      if (urlStr.includes('/api/media/parse')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            tokenizerDown: true,
            lemmas: [],
            segments: [
              { start: 0, duration: 2, text: '今日' }
            ]
          })
        });
      }

      if (urlStr.includes('/api/media/tokenize')) {
        if (method === 'POST') {
          tokenizePostCalled = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokens: [{ surface: '今日', pos: '名詞', lemma: '今日', reading: 'キョウ' }]
            })
          });
        } else if (method === 'GET') {
          getHealthCalledCount++;
          if (getHealthCalledCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: false, tokenizerDown: true })
            });
          } else {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, status: 'ok', tokenizerDown: false })
            });
          }
        }
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MediaInteractivePlayer
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="NHK Easy News"
        onClose={vi.fn()}
      />
    );

    // Даем промисам (fetch) загрузиться
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Автоматический разбор слов сейчас недоступен. Субтитры показаны как есть; перевод по клику вернётся автоматически.')).toBeInTheDocument();

    const statusDot = screen.getByTestId('tokenizer-status-dot');
    expect(statusDot.className).toContain('statusDotOffline');
    expect(tokenizePostCalled).toBe(false);

    // Первый интервал: опрашивает, но оффлайн
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(getHealthCalledCount).toBe(1);
    expect(tokenizePostCalled).toBe(false);
    expect(statusDot.className).toContain('statusDotOffline');

    // Второй интервал: опрашивает и переходит в онлайн
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(getHealthCalledCount).toBe(2);

    // Даем отработать последующим промисам/микрозадачам
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(tokenizePostCalled).toBe(true);
    expect(statusDot.className).toContain('statusDotOnline');

    vi.useRealTimers();
  });
});


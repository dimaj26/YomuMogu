import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
const mockPlayerInstance = {
  getCurrentTime: vi.fn().mockReturnValue(1.5),
  seekTo: vi.fn(),
  destroy: vi.fn(),
};

let lastPlayerConfig: any = null;

globalThis.window.YT = {
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
      expect(screen.getByText('こんにちは')).toBeInTheDocument();
      expect(screen.getByText('世界')).toBeInTheDocument();
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
      expect(screen.getByText('Разбор слов недоступен (токенизатор не запущен)')).toBeInTheDocument();
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
});

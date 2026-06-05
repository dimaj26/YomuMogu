import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
};

globalThis.window.YT = {
  Player: vi.fn().mockImplementation(function (id, config) {
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
});

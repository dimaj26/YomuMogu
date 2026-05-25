import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PracticePage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';

// Мокаем lucide-react, так как некоторые иконки могут некорректно рендериться в jsdom
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  Settings: () => <span data-testid="icon-settings" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Play: () => <span data-testid="icon-play" />,
  XCircle: () => <span data-testid="icon-x" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Globe: () => <span data-testid="icon-globe" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  Check: () => <span data-testid="icon-check" />,
}));

// Мокаем next/link и next/navigation
vi.mock('next/link', () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
    }),
  };
});

describe('PracticePage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('отображает заголовок страницы и загрузку данных', async () => {
    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    expect(await screen.findByRole('heading', { name: 'Практика диалога', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Источник обучения:')).toBeInTheDocument();
  });

  it('отображает пустое состояние, если слова не загружены', async () => {
    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText(/Локальная колода еще не инициализирована/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Перейти в настройки' })).toBeInTheDocument();
    });
  });

  it('отображает кнопку генерации сессий, если слова импортированы, но темы не созданы', async () => {
    // Устанавливаем режим 'custom' и записываем слова в localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    localStorage.setItem('yomumogu_profile_default_selected_deck', 'MyDeck');
    localStorage.setItem(
      'yomumogu_profile_default_words',
      JSON.stringify([{ id: 1, word: '猫', translation: 'кошка', status: 'new' }])
    );

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Источник обучения:')).toBeInTheDocument();
      expect(screen.getByText('Своя Anki (MyDeck)')).toBeInTheDocument();
      expect(screen.getByText('Импортировано слов: 1')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Сгенерировать темы тренировок' })[0]).toBeInTheDocument();
    });
  });

  it('генерирует и отображает разговорные сессии при клике на генерацию', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    localStorage.setItem('yomumogu_profile_default_selected_deck', 'MyDeck');
    localStorage.setItem(
      'yomumogu_profile_default_words',
      JSON.stringify([{ id: 1, word: '猫', translation: 'кошка', status: 'new' }])
    );

    const mockSessions = [
      {
        id: 'session-1',
        title: 'Тема кафе',
        description: 'Диалог в кафе.',
        scenario: 'Вы в кафе',
        targetWords: [{ word: '猫', translation: 'кошка' }]
      }
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      console.log('--- TEST FETCH MOCK CALLED FOR URL:', url);
      if (url.toString().includes('/api/gemini/sessions')) {
        return Promise.resolve({
          ok: true,
          json: async () => {
            console.log('--- TEST FETCH MOCK RETURNING SESSIONS');
            return { sessions: mockSessions };
          },
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    const genBtns = await screen.findAllByRole('button', { name: 'Сгенерировать темы тренировок' });
    console.log('--- TEST CLICKING BUTTON, count:', genBtns.length);
    fireEvent.click(genBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Тема кафе')).toBeInTheDocument();
      expect(screen.getByText('Диалог в кафе.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Начать практику' })).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('отображает кнопку "Продолжить" вместо "Начать практику", если сессия уже начата', async () => {
    const mockSessions = [
      {
        id: 'session-in-progress',
        title: 'Тема кафе',
        description: 'Диалог в кафе.',
        scenario: 'Вы в кафе',
        targetWords: [{ word: '猫', translation: 'кошка' }]
      }
    ];

    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    localStorage.setItem('yomumogu_profile_default_sessions', JSON.stringify(mockSessions));
    localStorage.setItem(
      'yomumogu_profile_default_words',
      JSON.stringify([{ id: 1, word: '猫', translation: 'кошка', status: 'new' }])
    );
    localStorage.setItem(
      'yomumogu_profile_default_chat_state_session-in-progress',
      JSON.stringify({
        messages: [{ id: 'msg-1', role: 'user', text: 'Привет' }],
        collectedWords: [],
        isComplete: false
      })
    );

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема кафе')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Сброс' })).toBeInTheDocument();
    });
  });
});

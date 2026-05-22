import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from '../page';

// Мокаем lucide-react, так как некоторые иконки могут некорректно рендериться в jsdom
vi.mock('lucide-react', () => ({
  RefreshCw: () => <span data-testid="icon-refresh" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  BookOpen: () => <span data-testid="icon-book" />,
  Settings: () => <span data-testid="icon-settings" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  User: () => <span data-testid="icon-user" />,
  Trophy: () => <span data-testid="icon-trophy" />,
  Zap: () => <span data-testid="icon-zap" />,
  BarChart2: () => <span data-testid="icon-barchart2" />,
  Trash2: () => <span data-testid="icon-trash2" />,
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

// Mock JpUIProvider and useJpUI to prevent context error
vi.mock('@/components/JpUIProvider', () => ({
  JpUIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useJpUI: () => ({
    uiWords: {},
    upgradedThisSession: null,
    revertedIds: new Set(),
    isLoaded: true,
    upgradeWord: vi.fn(),
    revertWord: vi.fn(),
    confirmWord: vi.fn(),
    resetUiProgress: vi.fn(),
  }),
}));

describe('SettingsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders title and loading state initially', async () => {
    // Мокаем fetch для бесконечного ожидания
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<SettingsPage />);

    expect(screen.getByRole('heading', { name: 'Настройки', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Проверка...')).toBeInTheDocument();
  });

  it('switches tabs correctly', async () => {
    render(<SettingsPage />);

    // По умолчанию вкладка Импорт & Anki
    expect(screen.getByText('Источник слов и режим обучения')).toBeInTheDocument();
    expect(screen.queryByText('Выбор профиля')).not.toBeInTheDocument();

    // Кликаем по вкладке Профиль
    const profileTabBtn = screen.getByRole('button', { name: /Профиль/ });
    fireEvent.click(profileTabBtn);

    // Должны появиться элементы профиля
    expect(screen.getByText('Выбор профиля')).toBeInTheDocument();
    expect(screen.queryByText('Источник слов и режим обучения')).not.toBeInTheDocument();

    // Кликаем по вкладке Облако
    const cloudTabBtn = screen.getByRole('button', { name: /Облако/ });
    fireEvent.click(cloudTabBtn);

    // Должна появиться заглушка облака
    expect(screen.getByText('Синхронизация с облаком')).toBeInTheDocument();
    expect(screen.queryByText('Выбор профиля')).not.toBeInTheDocument();
  });

  it('displays connection error if Anki is not running', async () => {
    // Мокаем ошибку соединения
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ connected: false, error: 'Anki не запущен' }),
    } as Response);

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Нет связи')).toBeInTheDocument();
      expect(screen.getByText('Anki не запущен')).toBeInTheDocument();
    });
  });

  it('loads decks and allows choosing a deck when connected successfully', async () => {
    // Устанавливаем режим 'custom' в localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    
    // Мокаем успешный connect, затем загрузку колод
    const mockDecks = ['DeckA', 'DeckB'];
    
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/anki/connect')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ connected: true }),
        } as Response);
      }
      if (url.toString().includes('/api/anki/decks')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ decks: mockDecks }),
        } as Response);
      }
      if (url.toString().includes('/api/anki/setup-deck')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<SettingsPage />);

    // Ждем подключения
    await waitFor(() => {
      expect(screen.getByText('Подключено')).toBeInTheDocument();
    });

    // Ждем загрузки списка колод
    await waitFor(() => {
      const select = screen.getByLabelText('Выберите колоду Anki') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('__all__'); // По умолчанию все колоды совместно
      expect(screen.getByText('DeckB')).toBeInTheDocument();
    });
  });

  it('loads and displays words list when "Импортировать слова" is clicked', async () => {
    // Устанавливаем режим 'custom' в localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');

    const mockDecks = ['JapaneseDeck'];
    const mockWords = [
      { id: 1, word: '猫', translation: 'кошка', interval: 10, status: 'learning', deckName: 'JapaneseDeck', rawFront: '猫', rawBack: 'кошка' },
      { id: 2, word: '犬', translation: 'собака', interval: 100, status: 'mature', deckName: 'JapaneseDeck', rawFront: '犬', rawBack: 'собака' },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/anki/connect')) {
        return Promise.resolve({ ok: true, json: async () => ({ connected: true }) } as Response);
      }
      if (url.toString().includes('/api/anki/decks')) {
        return Promise.resolve({ ok: true, json: async () => ({ decks: mockDecks }) } as Response);
      }
      if (url.toString().includes('/api/anki/words')) {
        return Promise.resolve({ ok: true, json: async () => ({ words: mockWords }) } as Response);
      }
      if (url.toString().includes('/api/anki/setup-deck')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) } as Response);
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(<SettingsPage />);

    // Ждем появления кнопки импорта
    const importBtn = await screen.findByRole('button', { name: 'Импортировать слова' });
    
    // Кликаем по кнопке импорта
    fireEvent.click(importBtn);

    // Ждем окончания загрузки и появления слов на экране
    await waitFor(() => {
      expect(screen.getByText('Успешно загружено карточек: 2')).toBeInTheDocument();
      
      // Проверка счетчиков статистики
      expect(screen.getByText('Изучаемые')).toBeInTheDocument();
      expect(screen.getByText('Изученные')).toBeInTheDocument();
      
      // Проверка наличия слов в таблице
      expect(screen.getByText('猫')).toBeInTheDocument();
      expect(screen.getByText('кошка')).toBeInTheDocument();
      expect(screen.getByText('犬')).toBeInTheDocument();
      expect(screen.getByText('собака')).toBeInTheDocument();
    });
  });

  it('generates and displays conversational sessions when "Сгенерировать темы тренировок" is clicked', async () => {
    // Устанавливаем режим 'custom' в localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');

    const mockDecks = ['JapaneseDeck'];
    const mockWords = [
      { id: 1, word: '猫', translation: 'кошка', interval: 10, status: 'learning', deckName: 'JapaneseDeck', rawFront: '猫', rawBack: 'кошка' },
    ];
    const mockSessions = [
      {
        id: 'session-1',
        title: 'Тема ресторанов',
        description: 'Сценарий про ресторан.',
        scenario: 'ИИ: официант, Вы: гость',
        targetWords: [{ word: '猫', translation: 'кошка' }]
      }
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/anki/connect')) {
        return Promise.resolve({ ok: true, json: async () => ({ connected: true }) } as Response);
      }
      if (url.toString().includes('/api/anki/decks')) {
        return Promise.resolve({ ok: true, json: async () => ({ decks: mockDecks }) } as Response);
      }
      if (url.toString().includes('/api/anki/words')) {
        return Promise.resolve({ ok: true, json: async () => ({ words: mockWords }) } as Response);
      }
      if (url.toString().includes('/api/gemini/sessions')) {
        return Promise.resolve({ ok: true, json: async () => ({ sessions: mockSessions }) } as Response);
      }
      if (url.toString().includes('/api/anki/setup-deck')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<SettingsPage />);

    // Импортируем слова
    const importBtn = await screen.findByRole('button', { name: 'Импортировать слова' });
    fireEvent.click(importBtn);

    // Ждем появления кнопки генерации сессий
    const genBtn = await screen.findByRole('button', { name: 'Сгенерировать темы тренировок' });
    
    // Кликаем сгенерировать
    fireEvent.click(genBtn);

    // Ждем рендеринга темы
    await waitFor(() => {
      expect(screen.getByText('Разговорные сессии с Gemini ИИ')).toBeInTheDocument();
      expect(screen.getByText('Тема ресторанов')).toBeInTheDocument();
      expect(screen.getByText('Сценарий про ресторан.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Начать практику' })).toBeInTheDocument();
    });
  });

  it('renders "Продолжить практику" instead of "Начать практику" if session is in progress', async () => {
    const mockSessions = [
      {
        id: 'session-in-progress',
        title: 'Тема разговора',
        description: 'Описание темы',
        scenario: 'Сценарий',
        targetWords: [{ word: '猫', translation: 'кошка' }]
      }
    ];
    
    // Пишем в localStorage перед рендером
    localStorage.setItem('yomumogu_profile_default_sessions', JSON.stringify(mockSessions));
    localStorage.setItem('yomumogu_profile_default_words', JSON.stringify([{ id: 1, word: '猫', translation: 'кошка' }]));
    localStorage.setItem(
      'yomumogu_profile_default_chat_state_session-in-progress',
      JSON.stringify({
        messages: [{ id: 'msg-1', role: 'user', text: 'Привет' }],
        collectedWords: [],
        isComplete: false
      })
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/anki/connect')) {
        return Promise.resolve({ ok: true, json: async () => ({ connected: true }) } as Response);
      }
      if (url.toString().includes('/api/anki/decks')) {
        return Promise.resolve({ ok: true, json: async () => ({ decks: ['Japanese'] }) } as Response);
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<SettingsPage />);

    // Ждем загрузки и рендеринга кнопки продолжения
    await waitFor(() => {
      expect(screen.getByText('Тема разговора')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Продолжить' })).toHaveClass('btn-blue');
      expect(screen.getByRole('button', { name: 'Сброс' })).toBeInTheDocument();
    });
  });

  it('allows choosing daily new words quota preset and entering custom limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<SettingsPage />);

    // Переходим на вкладку Профиль
    const profileTabBtn = screen.getByRole('button', { name: /Профиль/ });
    fireEvent.click(profileTabBtn);

    // Ждем отрисовки кнопок лимита
    const easyBtn = await screen.findByRole('button', { name: 'Мало (5)' });
    const standardBtn = screen.getByRole('button', { name: 'Стандарт (10)' });
    const hardBtn = screen.getByRole('button', { name: 'Много (20)' });
    const customBtn = screen.getByRole('button', { name: 'Вручную' });

    expect(easyBtn).toBeInTheDocument();
    expect(standardBtn).toBeInTheDocument();
    expect(hardBtn).toBeInTheDocument();
    expect(customBtn).toBeInTheDocument();

    // Кликаем по пресету "Мало (5)"
    fireEvent.click(easyBtn);
    await waitFor(() => {
      expect(localStorage.getItem('yomumogu_profile_default_quota_preset')).toBe('easy');
    });

    // Кликаем по пресету "Вручную"
    fireEvent.click(customBtn);
    await waitFor(() => {
      expect(localStorage.getItem('yomumogu_profile_default_quota_preset')).toBe('custom');
    });

    // Должно появиться поле ввода
    const input = screen.getByDisplayValue('10');
    expect(input).toBeInTheDocument();

    // Вводим кастомный лимит
    fireEvent.change(input, { target: { value: '12' } });
    await waitFor(() => {
      expect(localStorage.getItem('yomumogu_profile_default_daily_new_words_limit')).toBe('12');
    });
  });

  it('saves and loads per-deck mappings when deck changes and inputs are modified', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    const mockDecks = ['DeckX', 'DeckY'];
    
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/anki/connect')) {
        return Promise.resolve({ ok: true, json: async () => ({ connected: true }) } as Response);
      }
      if (url.toString().includes('/api/anki/decks')) {
        return Promise.resolve({ ok: true, json: async () => ({ decks: mockDecks }) } as Response);
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(<SettingsPage />);

    // Ждем загрузки списка колод
    let select!: HTMLSelectElement;
    await waitFor(() => {
      select = screen.getByLabelText('Выберите колоду Anki') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
    });

    // Выбираем DeckX
    fireEvent.change(select, { target: { value: 'DeckX' } });

    // Проверяем поля ввода (должны сброситься на дефолтные)
    const frontInput = screen.getByLabelText('Поле слова (Японский)') as HTMLInputElement;
    const backInput = screen.getByLabelText('Поле перевода (Русский)') as HTMLInputElement;
    expect(frontInput.value).toBe('Front');
    expect(backInput.value).toBe('Back');

    // Редактируем поля для DeckX
    fireEvent.change(frontInput, { target: { value: 'Kanji' } });
    fireEvent.change(backInput, { target: { value: 'Russian' } });

    // Убеждаемся, что в localStorage записались mappings
    await waitFor(() => {
      const mappingsStr = localStorage.getItem('yomumogu_profile_default_deck_mappings');
      expect(mappingsStr).toBeTruthy();
      const mappings = JSON.parse(mappingsStr!);
      expect(mappings['DeckX']).toEqual({
        frontField: 'Kanji',
        backField: 'Russian',
        audioField: '',
        imageField: '',
      });
    });

    // Переключаемся на DeckY
    fireEvent.change(select, { target: { value: 'DeckY' } });
    await waitFor(() => {
      expect(frontInput.value).toBe('Front');
      expect(backInput.value).toBe('Back');
    });

    // Возвращаемся на DeckX
    fireEvent.change(select, { target: { value: 'DeckX' } });
    await waitFor(() => {
      expect(frontInput.value).toBe('Kanji');
      expect(backInput.value).toBe('Russian');
    });
  });
});

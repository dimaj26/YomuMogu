import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';

// In-memory замена таблиц words/reviews: F5 сохраняет диагностику через
// importStarterDeck (bulkPut ~500 слов) в fake-indexeddb — под параллельной
// нагрузкой vitest это разбухает за таймаут (015, та же природа, что чинили в
// home-grid/014). Мок покрывает ровно тот Dexie-чейн, что реально используется
// этими путями: where(field).equals(value) -> {toArray, count, filter(pred) ->
// {toArray, count}} плюс put/bulkPut/clear.
// vi.hoisted нужен, т.к. vi.mock хойстится над обычными объявлениями.
const { mockDb } = vi.hoisted(() => {
  function createTable() {
    let store: any[] = [];

    function makeChain(rows: any[]) {
      return {
        toArray: async () => rows,
        count: async () => rows.length,
        filter: (pred: (row: any) => boolean) => {
          const f = rows.filter(pred);
          return { toArray: async () => f, count: async () => f.length };
        },
      };
    }

    return {
      bulkPut: async (rows: any[]) => { store.push(...rows); },
      put: async (row: any) => { store.push(row); },
      clear: async () => { store = []; },
      where: (field: string) => ({
        equals: (value: unknown) => makeChain(store.filter(r => r[field] === value)),
      }),
    };
  }

  return { mockDb: { words: createTable(), reviews: createTable() } };
});

vi.mock('@/core/db', () => ({ db: mockDb }));

const db = mockDb;


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

const pushMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: pushMock,
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
  beforeEach(async () => {
    vi.restoreAllMocks();
    pushMock.mockClear();
    localStorage.clear();
    await db.words.clear();
    await db.reviews.clear();
  });

  it('F5: после сохранения диагностики ведёт в обучение (/practice), а не остаётся в настройках', async () => {
    // Свежий локальный профиль (по умолчанию), Anki не нужен
    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

    // Открываем диагностику знаний (на странице две кнопки-входа — берём первую)
    const openBtns = await screen.findAllByRole('button', { name: /Пройти диагностику/ });
    fireEvent.click(openBtns[0]);

    // Дожидаемся загрузки стартовой колоды → кнопка сохранения активна
    const saveBtn = await screen.findByRole('button', { name: 'Сохранить и начать' });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());

    // Сохраняем без отметки слов (все остаются новыми)
    fireEvent.click(saveBtn);

    // После сохранения пользователь должен попасть в обучение
    // (importStarterDeck пишет 500 слов в fake-indexeddb — даём запас по времени)
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/practice'), { timeout: 5000 });
  });

  it('renders title and loading state initially', async () => {
    // Anki-режим выбран явно (статус проверки соединения показывается только в Anki-режиме)
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    // Мокаем fetch для бесконечного ожидания
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

    expect(screen.getByRole('heading', { name: 'Настройки', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Проверка...')).toBeInTheDocument();
  });

  it('switches tabs correctly', async () => {
    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

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
    // Anki-режим выбран явно (ленивый пинг срабатывает только в Anki-режиме)
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    // Мокаем ошибку соединения
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ connected: false, error: 'Anki не запущен' }),
    } as Response);

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Нет связи')).toBeInTheDocument();
      expect(screen.getByText('Anki не запущен')).toBeInTheDocument();
    });
  });

  it('свежий профиль: источник по умолчанию — Локальный список, ошибки Anki при загрузке нет', async () => {
    // Никакого deck_mode в localStorage (свежий профиль). Если бы Anki пинговался — была бы ошибка.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ connected: false, error: 'Anki не запущен' }),
    } as Response);

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

    // Локальный режим активен по умолчанию
    await screen.findByText(/Локальный автономный режим/);
    // Свежий пользователь НЕ должен видеть ошибку Anki, и AnkiConnect не пингуется
    expect(screen.queryByText('Anki не запущен')).not.toBeInTheDocument();
    const ankiPinged = fetchSpy.mock.calls.some(c => String(c[0]).includes('/api/anki/connect'));
    expect(ankiPinged).toBe(false);
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

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

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

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

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

  it('allows choosing daily new words quota preset and entering custom limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

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

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

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

  it('loads and displays local deck words and statistics in local mode', async () => {
    // Setup local deck mode in localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'local');
    localStorage.setItem('yomumogu_profile_default_quota_preset', 'standard');

    // Populate IndexedDB with a local deck word (Version 3 schema properties)
    await db.words.put({
      profileId: 'default',
      id: 777,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: '__local_starter__',
      source: 'starter',
      active: {
        status: 'mature',
        stability: 200,
        difficulty: 5.0,
        interval: 200,
        due: Date.now() + 100000,
        reps: 1,
        lapses: 0,
      },
      contextExamples: []
    });

    render(<JapanificationProvider><SettingsPage /></JapanificationProvider>);

    // Verify statistics and words table display correct data
    await waitFor(() => {
      // stats.mature should be 1
      expect(screen.getByText('Изучено')).toBeInTheDocument();
      // JSDOM might show table words: 猫 and кошка
      expect(screen.getByText('猫')).toBeInTheDocument();
      expect(screen.getByText('кошка')).toBeInTheDocument();
    });
  });
});

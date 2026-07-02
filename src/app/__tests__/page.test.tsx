import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage, { MASCOT_PHRASES } from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';
import { LOCAL_DECK_NAME } from '@/core/localDeckService';

// In-memory замена таблиц words/ui_words: HomePage + провайдеры (JpUIProvider)
// читают их через fake-indexeddb на монтирование (isLocalDeckInitialized,
// getPriorityWordsCount, тепловая карта, ui_words-прогресс) — под параллельной
// нагрузкой vitest это разбухает за таймаут (016, порт мока из home-grid/014).
// Мок покрывает ровно тот Dexie-чейн, который реально используется этими
// путями: where(field).equals(value) -> {toArray, count, delete, filter(pred)
// -> {toArray, count}}. vi.hoisted нужен, т.к. vi.mock хойстится над обычными
// объявлениями.
const { mockWordsTable, mockUiWordsTable } = vi.hoisted(() => {
  function createMockTable() {
    let store: any[] = [];

    function makeChain(rows: any[]) {
      return {
        toArray: async () => rows,
        count: async () => rows.length,
        delete: async () => {
          store = store.filter(r => !rows.includes(r));
        },
        filter: (pred: (row: any) => boolean) => {
          const filtered = rows.filter(pred);
          return { toArray: async () => filtered, count: async () => filtered.length };
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

  return { mockWordsTable: createMockTable(), mockUiWordsTable: createMockTable() };
});

vi.mock('@/core/db', () => ({
  db: { words: mockWordsTable, ui_words: mockUiWordsTable },
}));

const db = { words: mockWordsTable };

// Хелпер: слово локальной стартовой колоды с заданными статусами/сроками
const localWord = (id: number, status: 'new' | 'learning' | 'review' | 'mature', dueOffsetMs: number) => ({
  profileId: 'default',
  id,
  word: `語${id}`,
  reading: 'よみ',
  translation: 'перевод',
  category: LOCAL_DECK_NAME,
  source: 'starter' as const,
  active: { stability: 1, difficulty: 5, interval: 1, due: Date.now() + dueOffsetMs, reps: status === 'new' ? 0 : 1, lapses: 0, status },
  contextExamples: []
});

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  Settings: () => <span data-testid="icon-settings" />,
  User: () => <span data-testid="icon-user" />,
  HelpCircle: () => <span data-testid="icon-help" />,
  X: () => <span data-testid="icon-x" />,
  Check: () => <span data-testid="icon-check" />,
  Award: () => <span data-testid="icon-award" />,
  BarChart2: () => <span data-testid="icon-barchart2" />,
  Globe: () => <span data-testid="icon-globe" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
}));

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock JpUI component to avoid context error
vi.mock('@/components/JpUI', () => ({
  JpUI: ({ ru }: { ru: string }) => <span>{ru}</span>,
}));

describe('HomePage Component', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
    await db.words.clear();
  });

  it('первый запуск (local, колода не инициализирована): CTA — пройти диагностику + маркетинговый H1', async () => {
    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    // Свежий локальный профиль → состояние «первый запуск»
    await waitFor(() => {
      expect(screen.getByText('Пройти диагностику (5 мин)')).toBeInTheDocument();
    });

    // Маркетинговый заголовок показывается только в первом запуске
    expect(screen.getByText('Превратите ваши слова в живую речь!')).toBeInTheDocument();
  });

  it('вернувшийся (есть due-повторения): CTA «Продолжить обучение» + счётчик к повторению', async () => {
    await db.words.bulkPut([
      localWord(1, 'review', -1000), // просрочено → due
      localWord(2, 'review', -2000),
    ]);

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Продолжить обучение')).toBeInTheDocument();
    });
    expect(screen.getByText(/2 .*к повторению/)).toBeInTheDocument();
    // Маркетинговый H1 для вернувшегося убран
    expect(screen.queryByText('Превратите ваши слова в живую речь!')).not.toBeInTheDocument();
  });

  it('новичок (есть новые, нет due): CTA «Начать разминку»', async () => {
    await db.words.bulkPut([
      localWord(1, 'new', 0),
      localWord(2, 'new', 0),
      localWord(3, 'new', 0),
    ]);

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Начать разминку')).toBeInTheDocument();
    });
  });

  it('всё сделано (нет due и нет новых в квоте): нейтральное состояние без давления', async () => {
    await db.words.bulkPut([
      localWord(1, 'mature', 5 * 24 * 60 * 60 * 1000), // не due
    ]);

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      // Нейтральное «всё сделано» появляется и в баббле маскота, и в теле страницы —
      // достаточно, чтобы хотя бы одно вхождение присутствовало (без давления).
      expect(screen.getAllByText(/На сегодня всё/).length).toBeGreaterThan(0);
    });
  });

  it('renders landing page with Resume Practice button when there is an active session', async () => {
    // Set active session in localStorage
    const activeSession = {
      id: 'test-session',
      title: 'В ресторане',
      targetWords: [{ word: '猫', translation: 'кошка' }]
    };
    const chatState = {
      messages: [{ id: '1', role: 'model', text: 'こんにちは' }],
      collectedWords: ['猫'],
      isComplete: false
    };

    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(activeSession));
    localStorage.setItem('yomumogu_profile_default_chat_state_test-session', JSON.stringify(chatState));

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Продолжить: В ресторане')).toBeInTheDocument();
    });

    expect(screen.getByText('Собрано целевых слов: 1 из 1')).toBeInTheDocument();
    expect(screen.getByText('У тебя остался незавершенный диалог! Давай продолжим практику "В ресторане"?')).toBeInTheDocument();
  });

  it('opens and closes profile modal', async () => {
    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Пройти диагностику (5 мин)')).toBeInTheDocument();
    });

    // Click Profile button
    const profileBtns = screen.getAllByRole('button', { name: /Профиль/ });
    fireEvent.click(profileBtns[0]); // Header profile button

    expect(screen.getByText('Профиль и прогресс')).toBeInTheDocument();
    expect(screen.getByText('Уровень: 0')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: '' }); // Lucide X button inside modal
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Профиль и прогресс')).not.toBeInTheDocument();
  });

  it('opens and closes help modal, switches tabs', async () => {
    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Пройти диагностику (5 мин)')).toBeInTheDocument();
    });

    // Click Help button
    const helpBtn = screen.getByRole('button', { name: /Справка/ });
    fireEvent.click(helpBtn);

    expect(screen.getByText('Справка YomuMogu')).toBeInTheDocument();
    expect(screen.getByText('Превращение пассивного словаря в активный')).toBeInTheDocument();

    // Switch to Rules tab
    const rulesTabBtn = screen.getByRole('button', { name: /Правила/ });
    fireEvent.click(rulesTabBtn);
    expect(screen.getByText('Использование Cyrillic Placeholders')).toBeInTheDocument();

    // Switch to Japanification tab
    const japTabBtn = screen.getByRole('button', { name: /Погружение/ });
    fireEvent.click(japTabBtn);
    expect(screen.getByText('Система языкового погружения (Immersion)')).toBeInTheDocument();
  });

  it('clicking mascot triggers wiggle animation and shows a motivational phrase', async () => {
    const MASCOT_PHRASES = [
      { ja: "頑張って！", reading: "がんばって", ru: "Постарайся! / Удачи!" },
      { ja: "お茶をどうぞ！", reading: "おちゃをどうぞ", ru: "Пожалуйста, выпей чаю!" },
      { ja: "日本語は面白いですね！", reading: "にほんごはおもしろいですね", ru: "Японский язык интересный, не правда ли?" },
      { ja: "一歩一歩進みましょう！", reading: "いっぽいっぽすすみましょう", ru: "Давай продвигаться шаг за шагом!" },
      { ja: "今日も素晴らしい日です！", reading: "きょうмоすばらしいひです", ru: "Сегодня тоже отличный день!" }
    ];

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Пройти диагностику (5 мин)')).toBeInTheDocument();
    });

    vi.useFakeTimers();
    try {
      const mascot = screen.getByText('🍵');
      expect(mascot).toBeInTheDocument();

      // Click the mascot
      fireEvent.click(mascot);

      // Mascot container should have the animated class
      expect(mascot.className).toContain('mascotAnimated');

      // The speech bubble should now contain one of the motivational phrases
      const bubble = document.querySelector('[class*="speechBubble"]');
      expect(bubble).toBeInTheDocument();
      const containsPhrase = MASCOT_PHRASES.some(phrase => bubble?.textContent?.includes(phrase.ru));
      expect(containsPhrase).toBe(true);

      // After 4 seconds, the speech bubble should revert back to the greeting
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Bubble goes back to the state-aware first-run greeting (feature 008):
      // fresh local profile → dashState 'first-run' → points to the diagnostic.
      expect(
        screen.getByText('Привет! Начни с диагностики — я подберу слова под тебя.')
      ).toBeInTheDocument();
    } finally {
      // Always restore real timers even if an assertion above throws, so the
      // next test's beforeEach (await db.words.clear()) doesn't hang on fake timers.
      vi.useRealTimers();
    }
  });

  it('checks MASCOT_PHRASES for Cyrillic characters in Japanese text fields', () => {
    // Регулярное выражение для поиска кириллицы (диапазон \u0400-\u04FF)
    const cyrillicRegex = /[\u0400-\u04FF]/;
    expect(MASCOT_PHRASES).toBeDefined();
    MASCOT_PHRASES.forEach((phrase) => {
      const containsCyrillicInJa = cyrillicRegex.test(phrase.ja);
      const containsCyrillicInReading = cyrillicRegex.test(phrase.reading);
      expect(containsCyrillicInJa).toBe(false);
      expect(containsCyrillicInReading).toBe(false);
    });
  });

  it('renders memory decay heatmap with Kumiko grid elements', async () => {
    // Вставляем тестовые слова в fakeIndexedDB перед рендерингом страницы
    await db.words.bulkPut([
      {
        profileId: 'default',
        id: 1,
        word: '一',
        reading: 'いち',
        translation: 'один',
        category: 'Japanese',
        source: 'anki',
        active: { stability: 1.0, difficulty: 5.0, interval: 1, due: Date.now(), reps: 1, lapses: 0, status: 'learning' },
        contextExamples: []
      },
      {
        profileId: 'default',
        id: 2,
        word: '二',
        reading: 'に',
        translation: 'два',
        category: 'Japanese',
        source: 'anki',
        active: { stability: 25.0, difficulty: 3.0, interval: 25, due: Date.now() + 1000000, reps: 3, lapses: 0, status: 'mature' },
        contextExamples: []
      }
    ]);

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    // Проверяем наличие SVG-тепловой карты
    await waitFor(() => {
      const svgGrid = document.querySelector('svg[data-testid="kumiko-grid"]');
      expect(svgGrid).toBeInTheDocument();
    });

    // Очищаем БД после теста
    await db.words.clear();
  });
});


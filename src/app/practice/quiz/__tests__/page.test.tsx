import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuizPage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';
import { db } from '@/core/db';
import { createDefaultFsrsState } from '@/core/scheduler';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Loader2: () => <span data-testid="icon-loader" />,
  Lightbulb: () => <span data-testid="icon-lightbulb" />,
  BookOpen: () => <span data-testid="icon-book" />,
  Award: () => <span data-testid="icon-award" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
}));

// Mock router and searchParams
const mockPush = vi.fn();
const mockSearchParamsGet = vi.fn().mockReturnValue(null);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

describe('QuizPage Component', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
    mockSearchParamsGet.mockReset().mockReturnValue(null);
    await db.words.clear();
    await db.reviews.clear();
  });

  it('renders loading state initially', async () => {
    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );
    expect(screen.getByText(/Загрузка квиза.../)).toBeInTheDocument();
  });

  it('renders empty state if no due words in standard mode', async () => {
    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Все слова повторены!')).toBeInTheDocument();
    });
  });

  it('loads due words in standard mode and allows checking correct answer', async () => {
    // Seed due word with non-new status (новые слова исключены из квиза)
    const dueWord = {
      profileId: 'default',
      id: 1,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: 'Japanese',
      source: 'anki' as const,
      active: { status: 'learning' as const, stability: 2, difficulty: 5, interval: 1, due: Date.now() - 5000, reps: 1, lapses: 0 },
      contextExamples: [
        { sentence: '私は猫が好きです。', translation: 'Я люблю кошек.', timestamp: Date.now() }
      ]
    };
    await db.words.put(dueWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Wait for the word to load
    await waitFor(() => {
      expect(screen.getByText('Я люблю кошек.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Введите ответ (можно ромадзи)...')).toBeInTheDocument();
    });

    // Enter correct answer
    const input = screen.getByPlaceholderText('Введите ответ (можно ромадзи)...');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    fireEvent.change(input, { target: { value: 'ねこ' } });

    // Click check
    const checkButton = screen.getByRole('button', { name: 'Проверить' });
    fireEvent.click(checkButton);

    // Verify correct feedback
    await waitFor(() => {
      expect(screen.getByText('Верно! Отличная работа.')).toBeInTheDocument();
    });

    // Click next
    const nextButton = screen.getByRole('button', { name: 'Завершить' });
    fireEvent.click(nextButton);

    // Verify finished screen
    await waitFor(() => {
      expect(screen.getByText('Повторение завершено!')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  it('loads specific words in ad-hoc mode even if not due', async () => {
    // Mock words param
    mockSearchParamsGet.mockReturnValue('犬');

    // Seed non-due word
    const nonDueWord = {
      profileId: 'default',
      id: 2,
      word: '犬',
      reading: 'いぬ',
      translation: 'собака',
      category: 'Japanese',
      source: 'anki' as const,
      passive: createDefaultFsrsState(Date.now() + 100000), // in the future
      active: createDefaultFsrsState(Date.now() + 100000), // in the future
      contextExamples: []
    };
    await db.words.put(nonDueWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Wait for word to load (falls back to RU->JA translation since contextExamples is empty)
    await waitFor(() => {
      expect(screen.getByText('Переведите слово на японский:')).toBeInTheDocument();
      expect(screen.getByText('собака')).toBeInTheDocument();
    });

    // Enter incorrect answer
    const input = screen.getByPlaceholderText('Введите ответ (можно ромадзи)...');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    fireEvent.change(input, { target: { value: 'ねко' } });

    // Click check
    const checkButton = screen.getByRole('button', { name: 'Проверить' });
    fireEvent.click(checkButton);

    // Verify incorrect feedback
    await waitFor(() => {
      expect(document.body.textContent).toContain('Неверно');
      expect(document.body.textContent).toContain('いぬ');
    });
  });

  it('shows first character hint on request', async () => {
    // Seed due word with non-new status
    const dueWord = {
      profileId: 'default',
      id: 3,
      word: '林檎',
      reading: 'りんご',
      translation: 'яблоко',
      category: 'Japanese',
      source: 'anki' as const,
      active: { status: 'review' as const, stability: 5, difficulty: 5, interval: 3, due: Date.now() - 5000, reps: 2, lapses: 0 },
    };
    await db.words.put(dueWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('яблоко')).toBeInTheDocument();
    });

    // Click hint button
    const hintButton = screen.getByRole('button', { name: 'Первый символ' });
    fireEvent.click(hintButton);

    // Check if hint is displayed
    await waitFor(() => {
      expect(screen.getByText(/Подсказка \(Первый символ\):/)).toBeInTheDocument();
      expect(screen.getByText('林')).toBeInTheDocument();
    });
  });

  it('calls dictionary API and shows definition on request', async () => {
    // Mock global fetch for dict API lookup
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        word: '猫',
        definition: 'Кот, домашнее животное.'
      })
    } as Response);

    const dueWord = {
      profileId: 'default',
      id: 4,
      word: '猫',
      reading: 'ねко',
      translation: 'кошка',
      category: 'Japanese',
      source: 'anki' as const,
      active: { status: 'learning' as const, stability: 2, difficulty: 5, interval: 1, due: Date.now() - 5000, reps: 1, lapses: 0 },
    };
    await db.words.put(dueWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('кошка')).toBeInTheDocument();
    });

    // Click dictionary definition button
    const dictButton = screen.getByRole('button', { name: 'Словарное определение' });
    fireEvent.click(dictButton);

    // Wait for definition to load
    await waitFor(() => {
      expect(screen.getByText(/Подсказка \(Определение словаря\):/)).toBeInTheDocument();
      expect(screen.getByText('Кот, домашнее животное.')).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/dict/lookup?word=%E7%8C%AB');
  });

  it('ignores new status words in standard quiz mode', async () => {
    // Seed 3 new-status words with due = now (should be ignored)
    for (let i = 10; i < 13; i++) {
      await db.words.put({
        profileId: 'default',
        id: i,
        word: `新${i}`,
        reading: `しん${i}`,
        translation: `新しい${i}`,
        category: 'Japanese',
        source: 'starter' as const,
        active: createDefaultFsrsState(Date.now() - 5000),
        contextExamples: []
      });
    }

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Should show empty state since all words have status 'new'
    await waitFor(() => {
      expect(screen.getByText('Все слова повторены!')).toBeInTheDocument();
    });
  });

  it('loads new words in mode=new and increments daily new words count on check', async () => {
    // Set query param mode=new
    mockSearchParamsGet.mockImplementation((param) => {
      if (param === 'mode') return 'new';
      return null;
    });

    // Seed new status word
    const newWord = {
      profileId: 'default',
      id: 50,
      word: '犬',
      reading: 'いぬ',
      translation: 'собака',
      category: 'Japanese',
      source: 'starter' as const,
      active: createDefaultFsrsState(Date.now() - 5000),
      contextExamples: []
    };
    await db.words.put(newWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Wait for the word to load (in mode=new, it should load 'newWord' since it is status 'new')
    await waitFor(() => {
      expect(screen.getByText('собака')).toBeInTheDocument();
    });

    // Verify daily counter is 0 initially
    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const key = `yomumogu_profile_default_daily_new_words_${dateStr}`;
    expect(localStorage.getItem(key)).toBeNull();

    // Enter answer and check
    const input = screen.getByPlaceholderText('Введите ответ (можно ромадзи)...');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    fireEvent.change(input, { target: { value: 'いぬ' } });

    const checkButton = screen.getByRole('button', { name: 'Проверить' });
    fireEvent.click(checkButton);

    // Verify correct feedback
    await waitFor(() => {
      expect(screen.getByText('Верно! Отличная работа.')).toBeInTheDocument();
    });

    // Click next / finish
    const nextButton = screen.getByRole('button', { name: 'Завершить' });
    fireEvent.click(nextButton);

    // Verify finished screen
    await waitFor(() => {
      expect(screen.getByText('Повторение завершено!')).toBeInTheDocument();
    });

    expect(localStorage.getItem(key)).toBe('1');
  });

  it('allows ignoring a typo and manually selecting Hard rating', async () => {
    // Seed due word with non-new status
    const dueWord = {
      profileId: 'default',
      id: 15,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: 'Japanese',
      source: 'anki' as const,
      active: { status: 'review' as const, stability: 3, difficulty: 5, interval: 2, due: Date.now() - 5000, reps: 2, lapses: 0 },
    };
    await db.words.put(dueWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Wait for the word to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Введите ответ (можно ромадзи)...')).toBeInTheDocument();
    });

    // Enter incorrect answer
    const input = screen.getByPlaceholderText('Введите ответ (можно ромадзи)...');
    fireEvent.change(input, { target: { value: 'ねко_ошибка' } });

    // Click check
    const checkButton = screen.getByRole('button', { name: 'Проверить' });
    fireEvent.click(checkButton);

    // Verify incorrect banner and Ignore Typo button presence
    await waitFor(() => {
      expect(document.body.textContent).toContain('Неверно');
      expect(screen.getByRole('button', { name: /Опечатка/ })).toBeInTheDocument();
    });

    // Click Ignore Typo
    const ignoreButton = screen.getByRole('button', { name: /Опечатка/ });
    fireEvent.click(ignoreButton);

    // Verify correctness toggled to green/correct and FSRS override buttons are rendered
    await waitFor(() => {
      expect(document.body.textContent).toContain('Верно!');
      expect(screen.getByRole('button', { name: /Трудно/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Хорошо/ })).toBeInTheDocument();
    });

    // Click Hard (Трудно)
    const hardButton = screen.getByRole('button', { name: /Трудно/ });
    fireEvent.click(hardButton);

    // Verify transitions to finish screen and review logged with ease: 2
    await waitFor(() => {
      expect(screen.getByText('Повторение завершено!')).toBeInTheDocument();
    });

    const reviews = await db.reviews.toArray();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].ease).toBe(2); // Hard
  });

  it('supports keyboard shortcuts for manual FSRS ratings', async () => {
    // Seed due word
    const dueWord = {
      profileId: 'default',
      id: 16,
      word: '猫',
      reading: 'ねко',
      translation: 'кошка',
      category: 'Japanese',
      source: 'anki' as const,
      active: { status: 'learning' as const, stability: 2, difficulty: 5, interval: 1, due: Date.now() - 5000, reps: 1, lapses: 0 },
    };
    await db.words.put(dueWord);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Wait for the word
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Введите ответ (можно ромадзи)...')).toBeInTheDocument();
    });

    // Enter correct answer and check
    const input = screen.getByPlaceholderText('Введите ответ (можно ромадзи)...');
    fireEvent.change(input, { target: { value: 'ねко' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));

    await waitFor(() => {
      expect(screen.getByText('Верно! Отличная работа.')).toBeInTheDocument();
    });

    // Trigger keyboard key '2' for Hard
    fireEvent.keyDown(window, { key: '2' });

    // Verify finished screen and logged with ease: 2
    await waitFor(() => {
      expect(screen.getByText('Повторение завершено!')).toBeInTheDocument();
    });

    const reviews = await db.reviews.toArray();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].ease).toBe(2); // Hard
  });
});

describe('QuizPage review ordering — highest-need first (006 / C-03)', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
    mockSearchParamsGet.mockReset().mockReturnValue(null); // режим review (по умолчанию)
    await db.words.clear();
    await db.reviews.clear();
  });

  const due = (id: number, translation: string, lapses: number, stability: number, dueOffsetMs: number) => ({
    profileId: 'default', id, word: `w${id}`, reading: `r${id}`, translation,
    category: 'Japanese', source: 'anki' as const,
    active: { status: 'review' as const, stability, difficulty: 5, interval: 5, due: Date.now() - dueOffsetMs, reps: 4, lapses },
    contextExamples: [],
  });

  it('первой показывает карточку с наибольшим числом ошибок (lapses)', async () => {
    await db.words.bulkPut([
      due(1, 'перевод-А-много-ошибок', 5, 5, 5000),
      due(2, 'перевод-Б-слабая', 0, 1, 5000),
      due(3, 'перевод-В-сильная', 0, 9, 5000),
    ] as any);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    // Самая «нуждающаяся» карточка (5 lapses) — первой
    expect(await screen.findByText(/перевод-А-много-ошибок/)).toBeInTheDocument();
    expect(screen.queryByText(/перевод-Б-слабая/)).not.toBeInTheDocument();
    expect(screen.queryByText(/перевод-В-сильная/)).not.toBeInTheDocument();
  });

  it('при равных ошибках первой идёт карточка со слабее памятью (ниже stability)', async () => {
    await db.words.bulkPut([
      due(11, 'перевод-сильная', 0, 9, 5000),
      due(12, 'перевод-слабая', 0, 1, 5000),
    ] as any);

    render(
      <JapanificationProvider>
        <QuizPage />
      </JapanificationProvider>
    );

    expect(await screen.findByText(/перевод-слабая/)).toBeInTheDocument();
    expect(screen.queryByText(/перевод-сильная/)).not.toBeInTheDocument();
  });
});

describe('QuizPage review session-size cap (010 / C-03 cap)', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
    mockSearchParamsGet.mockReset().mockReturnValue(null);
    await db.words.clear();
    await db.reviews.clear();
  });

  const due = (id: number, translation: string, lapses: number, stability: number) => ({
    profileId: 'default', id, word: `w${id}`, reading: `r${id}`, translation,
    category: 'Japanese', source: 'anki' as const,
    active: { status: 'review' as const, stability, difficulty: 5, interval: 5, due: Date.now() - 5000, reps: 4, lapses },
    contextExamples: [],
  });

  it('limit=2 ограничивает сессию до 2 самых «нуждающихся» карточек', async () => {
    await db.words.bulkPut([
      due(1, 'А-много-ошибок', 5, 5),
      due(2, 'Б-слабая', 0, 1),
      due(3, 'В-сильная', 0, 9),
    ] as any);
    // mode=review (null), limit=2
    mockSearchParamsGet.mockImplementation((k: string) => (k === 'limit' ? '2' : null));

    render(<JapanificationProvider><QuizPage /></JapanificationProvider>);

    // Прогресс-индикатор показывает всего 2 карточки
    expect(await screen.findByText(/1\s*\/\s*2/)).toBeInTheDocument();
    // Первой — самая нуждающаяся (5 ошибок), сильная карточка отрезана капом
    expect(screen.getByText(/А-много-ошибок/)).toBeInTheDocument();
    expect(screen.queryByText(/В-сильная/)).not.toBeInTheDocument();
  });

  it('без limit загружается весь due-набор (поведение «Все»)', async () => {
    await db.words.bulkPut([
      due(11, 'один', 0, 5),
      due(12, 'два', 0, 5),
      due(13, 'три', 0, 5),
    ] as any);
    // mode=review, без limit (всё возвращает null)
    render(<JapanificationProvider><QuizPage /></JapanificationProvider>);

    expect(await screen.findByText(/1\s*\/\s*3/)).toBeInTheDocument();
  });

  it('due меньше лимита: показываются все доступные (без падения)', async () => {
    await db.words.bulkPut([due(21, 'единственное', 2, 3)] as any);
    mockSearchParamsGet.mockImplementation((k: string) => (k === 'limit' ? '20' : null));

    render(<JapanificationProvider><QuizPage /></JapanificationProvider>);

    expect(await screen.findByText(/1\s*\/\s*1/)).toBeInTheDocument();
  });
});

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
}));

// Mock router and searchParams
const mockPush = vi.fn();
let mockSearchParamsGet = vi.fn().mockReturnValue(null);

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
      passive: { status: 'learning' as const, stability: 2, difficulty: 5, interval: 1, due: Date.now() - 5000, reps: 1, lapses: 0 },
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
      expect(screen.getByPlaceholderText('Введите ответ на японском...')).toBeInTheDocument();
    });

    // Enter correct answer
    const input = screen.getByPlaceholderText('Введите ответ на японском...');
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
    const input = screen.getByPlaceholderText('Введите ответ на японском...');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    fireEvent.change(input, { target: { value: 'ねко' } });

    // Click check
    const checkButton = screen.getByRole('button', { name: 'Проверить' });
    fireEvent.click(checkButton);

    // Verify incorrect feedback
    await waitFor(() => {
      expect(screen.getByText(/Неверно/)).toBeInTheDocument();
      expect(screen.getByText(/いぬ/)).toBeInTheDocument();
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
      passive: { status: 'review' as const, stability: 5, difficulty: 5, interval: 3, due: Date.now() - 5000, reps: 2, lapses: 0 },
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
    expect(screen.getByText(/Подсказка \(Первый символ\):/)).toBeInTheDocument();
    expect(screen.getByText('林')).toBeInTheDocument();
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
      passive: { status: 'learning' as const, stability: 2, difficulty: 5, interval: 1, due: Date.now() - 5000, reps: 1, lapses: 0 },
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
        passive: createDefaultFsrsState(Date.now() - 5000),
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
});

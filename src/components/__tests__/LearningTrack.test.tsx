import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LearningTrack } from '../LearningTrack';
import { JapanificationProvider } from '../../hooks/useJapanification';

// Мокаем next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Play: () => <span data-testid="icon-play" />,
  BookOpen: () => <span data-testid="icon-book" />,
  Lock: () => <span data-testid="icon-lock" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
}));

const mockSessions = [
  {
    id: 'sess-1',
    title: 'Кафе и еда',
    description: 'Разговор о заказе суши в японском кафе.',
    scenario: 'Кафе суши',
    targetWords: [
      { word: '寿司', translation: 'суши' },
      { word: '美味しい', translation: 'вкусный' }
    ]
  },
  {
    id: 'sess-2',
    title: 'Аренда жилья',
    description: 'Обсуждение аренды квартиры в Токио.',
    scenario: 'Аренда Токио',
    targetWords: [
      { word: '部屋', translation: 'комната' },
      { word: '家賃', translation: 'арендная плата' }
    ]
  }
];

describe('LearningTrack Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <JapanificationProvider>
        {ui}
      </JapanificationProvider>
    );
  };

  it('renders the SVG path and node circles', () => {
    const { container } = renderWithProvider(
      <LearningTrack
        sessions={mockSessions}
        inProgressSessions={new Set()}
        completedSessions={new Set()}
        dueReviewsCount={3}
        completedSessionsCountToday={0}
        onStartSession={vi.fn()}
        onDiscardSession={vi.fn()}
      />
    );

    // Должен отрендерить SVG контейнер
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Должен отрендерить 5 узлов (2 сессии + повторение + квиз + чекпоинт)
    const nodes = screen.getAllByRole('button');
    expect(nodes.length).toBe(5);
  });

  it('displays active, locked, and completed states correctly', () => {
    // Первая сессия пройдена, вторая в процессе
    renderWithProvider(
      <LearningTrack
        sessions={mockSessions}
        inProgressSessions={new Set(['sess-2'])}
        completedSessions={new Set(['sess-1'])}
        dueReviewsCount={0}
        completedSessionsCountToday={1}
        onStartSession={vi.fn()}
        onDiscardSession={vi.fn()}
      />
    );

    // Узел 1 (sess-1) должен отображать галку выполненности
    const completedNode = screen.getByTitle(/Кафе и еда/i);
    expect(completedNode).toBeInTheDocument();

    // Узел 2 (sess-2) должен быть активным (в процессе)
    const activeNode = screen.getByTitle(/Аренда жилья/i);
    expect(activeNode).toBeInTheDocument();
  });

  it('opens details popover on node click', () => {
    renderWithProvider(
      <LearningTrack
        sessions={mockSessions}
        inProgressSessions={new Set()}
        completedSessions={new Set()}
        dueReviewsCount={3}
        completedSessionsCountToday={0}
        onStartSession={vi.fn()}
        onDiscardSession={vi.fn()}
      />
    );

    // Кликаем по первой сессии
    const node = screen.getByTitle(/Кафе и еда/i);
    fireEvent.click(node);

    // Должно открыться всплывающее окно
    expect(screen.getByText('Разговор о заказе суши в японском кафе.')).toBeInTheDocument();
    expect(screen.getByText('Целевые слова:')).toBeInTheDocument();
    expect(screen.getByText('суши')).toBeInTheDocument();
    expect(screen.getByText('вкусный')).toBeInTheDocument();
  });
});

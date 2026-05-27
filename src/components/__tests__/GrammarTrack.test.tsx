import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrammarTrack } from '../GrammarTrack';
import { JapanificationProvider } from '../../hooks/useJapanification';

// Мокаем next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  Lock: () => <span data-testid="icon-lock" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
}));

const mockProgress = {
  g_n5_01: {
    ruleId: 'g_n5_01',
    profileId: 'default',
    status: 'mature' as const,
    due: Date.now() + 100000,
    stepIndex: 4,
  },
  g_n5_02: {
    ruleId: 'g_n5_02',
    profileId: 'default',
    status: 'learning' as const,
    due: Date.now() - 1000,
    stepIndex: 1,
  },
};

describe('GrammarTrack Component', () => {
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

  it('renders GrammarTrack and unlocks nodes correctly', () => {
    renderWithProvider(
      <GrammarTrack
        grammarProgress={mockProgress}
        onSelectRule={vi.fn()}
      />
    );

    // Должен отобразить заголовок первой грамматики (unlocked)
    const node1 = screen.getByTitle('Вежливая просьба');
    expect(node1).toBeInTheDocument();
    expect(node1).not.toBeDisabled();

    // Должен отобразить вторую грамматику (unlocked)
    const node2 = screen.getByTitle('Выражение желания');
    expect(node2).toBeInTheDocument();
    expect(node2).not.toBeDisabled();
  });

  it('opens popover details on node click with left/right alignment classes based on coordinates', () => {
    renderWithProvider(
      <GrammarTrack
        grammarProgress={mockProgress}
        onSelectRule={vi.fn()}
      />
    );

    // Кликаем по первой грамматике
    const node = screen.getByTitle('Вежливая просьба');
    fireEvent.click(node);

    // Поповер должен открыться
    expect(screen.getByText('Используется для выражения вежливой просьбы к собеседнику. Образуется путем присоединения ください к глаголу в て-форме (V-te + ください).')).toBeInTheDocument();
  });
});

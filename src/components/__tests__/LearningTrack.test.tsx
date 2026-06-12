import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LearningTrack } from '../LearningTrack';
import type { MacroLadderProfile } from '../LearningTrack';
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
  Lock: () => <span data-testid="icon-lock" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
}));

const renderWithProvider = (ui: React.ReactElement) =>
  render(<JapanificationProvider>{ui}</JapanificationProvider>);

describe('LearningTrack Component (Macro Ladder N5→N1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('рендерит 5 макро-уровней, N5 активен с процентом, N4–N1 заблокированы', () => {
    const profile: MacroLadderProfile = {
      activeLevelId: 'N5',
      coverages: {
        N5: { lexCoverage: 0.3, grammarCoverage: 0.5 } // 50*0.3 + 50*0.5 = 40%
      }
    };

    renderWithProvider(<LearningTrack profile={profile} />);

    // Проверяем наличие всех 5 кнопок-узлов
    const nodes = screen.getAllByRole('button');
    expect(nodes.length).toBe(5);

    // N5 должен быть активным (показывает процент)
    const n5Node = screen.getByTestId('level-node-N5');
    expect(n5Node).toBeInTheDocument();
    expect(n5Node).not.toBeDisabled();
    expect(n5Node.textContent).toContain('40%'); // round(50*0.3 + 50*0.5) = 40

    // N4–N1 должны быть заблокированы
    const n4Node = screen.getByTestId('level-node-N4');
    expect(n4Node).toBeDisabled();

    const n1Node = screen.getByTestId('level-node-N1');
    expect(n1Node).toBeDisabled();
  });

  it('уровень completed при lex ≥ 0.8 и grammar = 1.0', () => {
    const profile: MacroLadderProfile = {
      activeLevelId: 'N5',
      coverages: {
        N5: { lexCoverage: 0.85, grammarCoverage: 1.0 },   // completed
        N4: { lexCoverage: 0.3, grammarCoverage: 0.2 }      // active
      }
    };

    renderWithProvider(<LearningTrack profile={profile} />);

    const n5Node = screen.getByTestId('level-node-N5');
    const n4Node = screen.getByTestId('level-node-N4');

    // N5 не должен быть заблокирован и должен показывать галочку
    expect(n5Node).not.toBeDisabled();
    expect(screen.getAllByTestId('icon-check').length).toBeGreaterThanOrEqual(1);

    // N4 должен быть активным (не заблокирован)
    expect(n4Node).not.toBeDisabled();
  });

  it('при нулевых покрытиях N5 активен с 0%, не крашится', () => {
    const profile: MacroLadderProfile = {
      activeLevelId: 'N5',
      coverages: {}
    };

    renderWithProvider(<LearningTrack profile={profile} />);

    const n5Node = screen.getByTestId('level-node-N5');
    expect(n5Node).not.toBeDisabled();
    expect(n5Node.textContent).toContain('0%');
  });

  it('попап показывает полосы покрытия при клике на активный узел', () => {
    const profile: MacroLadderProfile = {
      activeLevelId: 'N5',
      coverages: {
        N5: { lexCoverage: 0.5, grammarCoverage: 0.7 }
      }
    };

    renderWithProvider(<LearningTrack profile={profile} />);

    const n5Node = screen.getByTestId('level-node-N5');
    fireEvent.click(n5Node);

    // Попап должен показывать заголовок
    expect(screen.getByText('Уровень N5')).toBeInTheDocument();
    expect(screen.getByText('Лексика')).toBeInTheDocument();
    expect(screen.getByText('Грамматика')).toBeInTheDocument();
  });
});

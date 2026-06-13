import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BalanceWidget } from '../BalanceWidget';
import type { Strand } from '../../lib/balance/balance';

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  Info: () => <span data-testid="icon-info">ⓘ</span>,
}));

describe('BalanceWidget Component', () => {
  it('две полосы (рекомендация/факт) и нейтральное сообщение при пустом логе', () => {
    render(<BalanceWidget level="N5" log={[]} />);

    // Должна быть видна рекомендация (для N5 это 50%)
    expect(screen.getByText('Рекомендованная структура (теория / правила):')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    const recommendedFill = screen.getByTestId('recommended-bar-fill');
    expect(recommendedFill).toHaveStyle({ width: '50%' });

    // Фактическая строка должна быть в состоянии "—"
    expect(screen.getByText('Фактическая структура (твои действия):')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Недостаточно данных (нужно ≥6 действий)')).toBeInTheDocument();

    // Нейтральное сообщение на русском
    expect(screen.getByText('Занимайся как удобно — со временем покажем баланс')).toBeInTheDocument();
  });

  it('показывает процент фактического баланса и сообщение при достаточном логе', () => {
    // 6 действий: 3 structure, 3 immersion -> 50%
    const log: Strand[] = ['structure', 'structure', 'structure', 'immersion', 'immersion', 'immersion'];
    render(<BalanceWidget level="N5" log={log} />);

    // Рекомендация 50%, факт 50%
    const recommendedPctElements = screen.getAllByText('50%');
    expect(recommendedPctElements.length).toBeGreaterThanOrEqual(2);

    const actualFill = screen.getByTestId('actual-bar-fill');
    expect(actualFill).toHaveStyle({ width: '50%' });

    // Сообщение о хорошем балансе
    expect(screen.getByText('Хороший баланс структуры и реального материала')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
}));

import { ServiceUnavailable } from '../ServiceUnavailable';

describe('ServiceUnavailable', () => {
  it('рендерит человеческое сообщение', () => {
    render(<ServiceUnavailable message="ИИ-сервис временно недоступен." />);
    expect(screen.getByText('ИИ-сервис временно недоступен.')).toBeInTheDocument();
  });

  it('кнопка «Повторить» отсутствует, если не retryable', () => {
    render(<ServiceUnavailable message="m" retryable={false} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Повторить/ })).not.toBeInTheDocument();
  });

  it('кнопка «Повторить» отсутствует без onRetry даже при retryable', () => {
    render(<ServiceUnavailable message="m" retryable />);
    expect(screen.queryByRole('button', { name: /Повторить/ })).not.toBeInTheDocument();
  });

  it('кнопка «Повторить» показывается и вызывает onRetry при retryable', () => {
    const onRetry = vi.fn();
    render(<ServiceUnavailable message="m" retryable onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: /Повторить/ });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('показывает подсказку «что пока работает», если передана', () => {
    render(<ServiceUnavailable message="m" whatWorks="Слова и повторение работают офлайн." />);
    expect(screen.getByText('Слова и повторение работают офлайн.')).toBeInTheDocument();
  });
});

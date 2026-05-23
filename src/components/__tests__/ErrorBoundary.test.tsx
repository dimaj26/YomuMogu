import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const ProblematicChild = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Child crashed');
  }
  return <div>Everything is fine</div>;
};

describe('ErrorBoundary Component', () => {
  it('renders children normally when there is no error', () => {
    render(
      <ErrorBoundary>
        <ProblematicChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('renders custom fallback element when child throws', () => {
    // Suppress console error output for expected test errors
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom Crash UI</div>}>
        <ProblematicChild shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Crash UI')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders standard ErrorFallback and supports resetting', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <ProblematicChild shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.getByText('Child crashed')).toBeInTheDocument();

    // Rerender with fine child, click retry button to reset error state
    rerender(
      <ErrorBoundary>
        <ProblematicChild shouldThrow={false} />
      </ErrorBoundary>
    );

    const button = screen.getByRole('button', { name: 'Попробовать снова' });
    fireEvent.click(button);

    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
    spy.mockRestore();
  });
});

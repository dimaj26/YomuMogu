import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorFallback } from '../ErrorFallback';

describe('ErrorFallback Component', () => {
  it('renders title and error details correctly', () => {
    const mockError = new Error('Test Failure Message');
    const mockReset = vi.fn();

    render(<ErrorFallback error={mockError} reset={mockReset} />);

    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.getByText('Test Failure Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument();
  });

  it('calls reset when the button is clicked', () => {
    const mockError = new Error('Another Message');
    const mockReset = vi.fn();

    render(<ErrorFallback error={mockError} reset={mockReset} />);

    const button = screen.getByRole('button', { name: 'Попробовать снова' });
    fireEvent.click(button);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});

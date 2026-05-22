import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from '../page';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Send: () => <span data-testid="icon-send" />,
  Lightbulb: () => <span data-testid="icon-lightbulb" />,
  X: () => <span data-testid="icon-x" />,
  Check: () => <span data-testid="icon-check" />,
  Loader2: () => <span data-testid="icon-loader" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Plus: () => <span data-testid="icon-plus" />,
}));

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ChatPage Component', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
  });

  const setupActiveSession = () => {
    const session = {
      id: 'test-session',
      title: 'Тема тренировки',
      description: 'Описание сценария',
      scenario: 'Сценарий разговора',
      targetWords: [
        { word: '猫', translation: 'кошка' },
        { word: '犬', translation: 'собака' },
      ],
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));
    return session;
  };

  it('renders chat interface with active session', async () => {
    setupActiveSession();

    // Mock fetch for initial conversation message
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'こんにちは！猫が好きですか？',
        translation: 'Привет! Вы любите кошек?',
        wordsDetected: [],
      }),
    } as Response);

    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
      expect(screen.getByText('Описание сценария')).toBeInTheDocument();
      expect(screen.getByText('кошка')).toBeInTheDocument();
      expect(screen.getByText('собака')).toBeInTheDocument();
      expect(screen.getByText('Завершить')).toBeInTheDocument();
    });
  });

  it('navigates back to home page on back button click without destroying session', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'こんにちは！' }),
    } as Response);

    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Click back button
    const backBtn = screen.getByTitle('Назад');
    fireEvent.click(backBtn);

    // Verify router redirect
    expect(mockPush).toHaveBeenCalledWith('/');

    // Verify that session is still present in localStorage
    expect(localStorage.getItem('yomumogu_profile_default_active_session')).not.toBeNull();
  });

  it('opens and cancels the exit confirmation modal', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'こんにちは！' }),
    } as Response);

    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Click Complete Dialogue button
    const completeBtn = screen.getByRole('button', { name: 'Завершить' });
    fireEvent.click(completeBtn);

    // Verify modal is open
    expect(screen.getByText('Завершить диалог?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Вы хотите завершить диалог прямо сейчас? Не собранные целевые слова будут перенесены в бонусный тест.'
      )
    ).toBeInTheDocument();

    // Click Continue (Cancel exit)
    const continueBtn = screen.getByRole('button', { name: 'Продолжить' });
    fireEvent.click(continueBtn);

    // Verify modal is closed
    expect(screen.queryByText('Завершить диалог?')).not.toBeInTheDocument();
  });

  it('confirms early exit and triggers bonus test flow', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'こんにちは！' }),
    } as Response);

    render(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Click Complete Dialogue button
    const completeBtn = screen.getByRole('button', { name: 'Завершить' });
    fireEvent.click(completeBtn);

    // Click Confirm exit
    const confirmBtn = screen.getAllByRole('button', { name: 'Завершить' })[1]; // The one in the modal
    fireEvent.click(confirmBtn);

    // Verify we enter the Bonus Test screen
    await waitFor(() => {
      expect(screen.getByText('Бонусный тест')).toBeInTheDocument();
      expect(screen.getByText('Переведите слова, которые не встретились в диалоге')).toBeInTheDocument();
    });
  });
});

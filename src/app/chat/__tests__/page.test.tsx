import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';

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

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

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

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

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

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

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
        'Вы хотите завершить диалог прямо сейчас? Не собранные целевые слова будут перенесены в быстрый квиз.'
      )
    ).toBeInTheDocument();

    // Click Continue (Cancel exit)
    const continueBtn = screen.getByRole('button', { name: 'Продолжить' });
    fireEvent.click(continueBtn);

    // Verify modal is closed
    expect(screen.queryByText('Завершить диалог?')).not.toBeInTheDocument();
  });

  it('confirms early exit and triggers results screen flow', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'こんにちは！' }),
    } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Click Complete Dialogue button
    const completeBtn = screen.getByRole('button', { name: 'Завершить' });
    fireEvent.click(completeBtn);

    // Click Confirm exit
    const confirmBtn = screen.getAllByRole('button', { name: 'Завершить' })[1]; // The one in the modal
    fireEvent.click(confirmBtn);

    // Verify we enter the results screen
    await waitFor(() => {
      expect(screen.getByText('Итоги практики')).toBeInTheDocument();
    });
  });

  it('updates mascot state and shows visual feedback on chat interaction', async () => {
    setupActiveSession();

    // 1. Initial conversation message
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！猫が好きですか？',
          translation: 'Привет! Вы любите кошек?',
          wordsDetected: [],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      // 2. Mock response with detected words -> happy state
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: '素晴らしい！',
          translation: 'Замечательно!',
          wordsDetected: ['猫'],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      // 3. Mock response with grammar error -> worried state
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: '猫は好きですか？',
          translation: 'Вы любите кошек?',
          wordsDetected: [],
          grammarFeedback: { isCorrect: false, correction: '猫が好きですか', explanation: 'Use が instead of は' },
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Wait for chat to render
    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    const mascot = screen.getByTestId('chat-mascot');
    expect(mascot).toBeInTheDocument();
    expect(mascot.getAttribute('data-state')).toBe('idle');

    // Send first user message (detects word '猫')
    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '猫が好きです。' } });
    
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    // Wait for the AI message to appear and check that mascot became happy
    await waitFor(() => {
      expect(screen.getByText('素晴らしい！')).toBeInTheDocument();
    });
    expect(mascot.getAttribute('data-state')).toBe('happy');

    // Send second user message (triggers grammar error)
    fireEvent.change(textarea, { target: { value: '猫は好きです。' } });
    fireEvent.click(sendBtn);

    // Wait for the next AI message and check that mascot became worried
    await waitFor(() => {
      expect(screen.getByText('猫は好きですか？')).toBeInTheDocument();
    });
    expect(mascot.getAttribute('data-state')).toBe('worried');
  });

  it('renders grammar focus badge in the chat interface', async () => {
    const session = {
      id: 'grammar-test-session',
      title: 'Грамматика: 〜てください',
      description: 'Свободный диалог с фокусом',
      scenario: 'Сценарий разговора',
      targetWords: [],
      grammarFocus: {
        id: 'g_n5_01',
        construction: '〜てください',
        topic: 'Вежливая просьба',
        explanation: 'Объяснение',
      },
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'こんにちは！',
        translation: 'Привет!',
        wordsDetected: [],
        grammarRuleDetected: false,
        grammarFeedback: { isCorrect: true },
      }),
    } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('〜てください (Вежливая просьба)')).toBeInTheDocument();
    });
  });

  it('renders grammar confidence buttons in results screen and saves progress correctly', async () => {
    const session = {
      id: 'grammar-test-session-2',
      title: 'Грамматика: 〜てください',
      description: 'Свободный диалог с фокусом',
      scenario: 'Сценарий разговора',
      targetWords: [],
      grammarFocus: {
        id: 'g_n5_01',
        construction: '〜てください',
        topic: 'Вежливая просьба',
        explanation: 'Объяснение',
      },
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarRuleDetected: true,
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          words: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('〜てください (Вежливая просьба)')).toBeInTheDocument();
    });

    // Complete dialogue
    const completeBtn = screen.getAllByRole('button', { name: 'Завершить' })[0];
    fireEvent.click(completeBtn);

    // Confirm exit
    const confirmBtn = screen.getAllByRole('button', { name: 'Завершить' })[1];
    fireEvent.click(confirmBtn);

    // Wait for the results screen to render
    await waitFor(() => {
      expect(screen.getByText('Закрепление грамматики')).toBeInTheDocument();
    });

    // Verify grading buttons exist
    expect(screen.getByText('Забыл')).toBeInTheDocument();
    expect(screen.getByText('Плохо помню')).toBeInTheDocument();
    expect(screen.getByText('Хорошо помню')).toBeInTheDocument();

    // Click "Плохо помню"
    const hardBtn = screen.getByText('Плохо помню');
    fireEvent.click(hardBtn);

    // Click Save (Сохранить прогресс)
    const saveBtn = screen.getByText('Сохранить прогресс');
    fireEvent.click(saveBtn);

    // Verify saving triggers loading state
    await waitFor(() => {
      expect(saveBtn).toBeDisabled();
    });
  });
});


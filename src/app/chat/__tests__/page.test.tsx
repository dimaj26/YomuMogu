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
        id: 'g_n5_s6',
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
        id: 'g_n5_s6',
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

describe('Self-Repair and Scaffolding Hint UI Tests', () => {
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
      ],
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));
    return session;
  };

  it('при isCorrect=false правка скрыта, виден shortNote и кнопка Показать правку', async () => {
    setupActiveSession();

    // 1. Initial welcome
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      // 2. Submit wrong message -> return isCorrect: false
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: {
            isCorrect: false,
            shortNote: 'частица: に → で',
            explanation: 'Надо использовать で вместо に.',
            correction: '<ruby>公園<rt>こうえん</rt></ruby>で遊びます。',
          },
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Wait for chat to render
    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '公園に遊びます。' } });
    
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    // Wait for feedback card
    await waitFor(() => {
      expect(screen.getByText('частица: に → で')).toBeInTheDocument();
      expect(screen.getByText('Надо использовать で вместо に.')).toBeInTheDocument();
      expect(screen.getByText('Попробуй исправить предложение сам и отправь снова — или открой правку.')).toBeInTheDocument();
    });

    // Correction text is hidden
    expect(screen.queryByText('公園で遊びます。')).not.toBeInTheDocument();

    // Show correction button is present
    expect(screen.getByRole('button', { name: 'Показать правку' })).toBeInTheDocument();
  });

  it('клик по Показать правку раскрывает correction с ruby-разметкой', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: {
            isCorrect: false,
            shortNote: 'частица: に → で',
            explanation: 'Надо использовать で вместо に.',
            correction: '公園で遊びます',
          },
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '公園に遊びます。' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Показать правку' })).toBeInTheDocument();
    });

    // Click "Показать правку"
    const showBtn = screen.getByRole('button', { name: 'Показать правку' });
    fireEvent.click(showBtn);

    // Now correction is visible
    expect(screen.getByText('公園で遊びます')).toBeInTheDocument();
    // Button is hidden
    expect(screen.queryByRole('button', { name: 'Показать правку' })).not.toBeInTheDocument();
  });

  it('при isCorrect=true карточка не содержит кнопку и подсказку self-repair', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: '正解！',
          translation: 'Правильно!',
          wordsDetected: [],
          grammarFeedback: {
            isCorrect: true,
            correction: '',
            explanation: '',
          },
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '正しい文です。' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Грамматика верна!/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Показать правку' })).not.toBeInTheDocument();
    expect(screen.queryByText('Попробуй исправить предложение сам и отправь снова — или открой правку.')).not.toBeInTheDocument();
  });

  it('фидбек без shortNote (легаси) рендерится без пустой строки заметки', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: {
            isCorrect: false,
            // shortNote is missing / undefined
            explanation: 'Надо использовать で.',
            correction: '公園で',
          },
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '公園に' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('Надо использовать で.')).toBeInTheDocument();
    });

    // Check that no shortNote is rendered as empty box or empty text
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('хинт-панель показывает чипы слов и patternHint и НЕ содержит кнопку вставки готовой фразы', async () => {
    setupActiveSession();

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reply: 'こんにちは！',
          translation: 'Привет!',
          wordsDetected: [],
          grammarFeedback: { isCorrect: true },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hints: [
            {
              level: 'easy',
              keywords: [
                { word: '水', translation: 'вода' },
                { word: '飲む', translation: 'пить' },
              ],
              patternHint: '[предмет] を 飲みます',
            },
          ],
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Click hint button
    const hintBtn = screen.getByTitle('Подсказка');
    fireEvent.click(hintBtn);

    await waitFor(() => {
      expect(screen.getByText(/вода/)).toBeInTheDocument();
      expect(screen.getByText(/飲む/)).toBeInTheDocument();
      expect(screen.getByText('[предмет] を 飲みます')).toBeInTheDocument();
    });

    // Ensure there is no click-to-insert handler
    const textElem = screen.getByText('[предмет] を 飲みます');
    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    expect(textarea.innerHTML).toBe('');
    fireEvent.click(textElem);
    expect(textarea.innerHTML).toBe('');
  });
});


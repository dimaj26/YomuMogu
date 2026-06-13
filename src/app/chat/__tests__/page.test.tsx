import React from 'react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from '../page';
import { db } from '@/core/db';
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
    vi.useRealTimers();
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

    // Wait for startConversation to finish
    await screen.findByText(/こんにちは/);
    await new Promise(resolve => setTimeout(resolve, 50));

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

    // Mock fetch with implementation checking if it's the start message
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const isStart = init?.body && typeof init.body === 'string' && init.body.includes('__START__');
      if (isStart) {
        return {
          ok: true,
          json: async () => ({
            reply: 'こんにちは！',
            translation: 'Привет!',
            wordsDetected: [],
            grammarFeedback: { isCorrect: true },
          }),
        } as Response;
      }
      return {
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
      } as Response;
    });

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Wait for chat to render
    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Wait for startConversation to finish
    await screen.findByText(/こんにちは/);
    await new Promise(resolve => setTimeout(resolve, 50));

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

    // Wait for startConversation to finish
    await screen.findByText(/こんにちは/);
    await new Promise(resolve => setTimeout(resolve, 50));

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

  it('reply и correction проходят через applyGradualFurigana перед рендером', async () => {
    setupActiveSession();

    // 1. Положим слово "猫" с интервалом 30 в IndexedDB
    await db.words.clear();
    await db.words.put({
      profileId: 'default',
      id: 9988,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: 'Japanese',
      source: 'anki',
      passive: { status: 'mature', stability: 30, difficulty: 5, interval: 30, due: Date.now() - 1000, reps: 5, lapses: 0 },
      active: { status: 'mature', stability: 30, difficulty: 5, interval: 30, due: Date.now() - 1000, reps: 5, lapses: 0 },
    });

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
          reply: 'これは<ruby>猫<rt>ねこ</rt></ruby>です。',
          translation: 'Это кошка.',
          wordsDetected: ['猫'],
          grammarFeedback: {
            isCorrect: false,
            shortNote: 'ошибка',
            explanation: 'ошибка',
            correction: '私は<ruby>猫<rt>ねこ</rt></ruby>が好きです。',
          },
        }),
      } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Ожидаем загрузку сессии
    await waitFor(() => {
      expect(screen.getByText('Тема тренировки')).toBeInTheDocument();
    });

    // Wait for startConversation to finish and load intervals
    await screen.findByText(/こんにちは/);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Отправляем сообщение, чтобы получить ответ от Сэнсея с "猫"
    const textareaInput = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textareaInput, { target: { value: '猫が好き。' } });
    fireEvent.click(screen.getByRole('button', { name: /Отправить/i }));

    // Ожидаем появление ответа Сэнсея и кнопки "Показать правку"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Показать правку' })).toBeInTheDocument();
    });

    // Проверяем, что в реплике Сэнсея rt получил класс rtHidden (так как interval = 30 >= 21)
    const replyRuby = document.querySelector('span ruby rt');
    expect(replyRuby).toBeInTheDocument();
    expect(replyRuby).toHaveClass('rtHidden');

    // Кликаем по "Показать правку"
    fireEvent.click(screen.getByRole('button', { name: 'Показать правку' }));

    // Проверяем, что в исправлении rt также получил класс rtHidden
    const correctionRuby = document.querySelector('span[class*="grammarCorrection"] ruby rt');
    expect(correctionRuby).toBeInTheDocument();
    expect(correctionRuby).toHaveClass('rtHidden');
  });
});

describe('Fluency Mode Tests', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
    vi.useRealTimers();
  });

  it('кнопка повтора: видна при >=3 ходах, после раунда 1-2 ведёт в следующий раунд, после раунда 3 скрыта', async () => {
    // Настраиваем сессию
    const session = {
      id: 'test-session-fluency',
      title: 'Тема тренировки',
      description: 'Описание сценария',
      scenario: 'Сценарий разговора',
      targetWords: [{ word: '猫', translation: 'кошка' }],
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));

    // Мокаем fetch для диалога и анализа
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat/analyze')) {
        return {
          ok: true,
          json: async () => ({ words: [] }),
        } as Response;
      }
      if (urlStr.includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({
            reply: 'こんにちは！',
            translation: 'Привет!',
            wordsDetected: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await screen.findByText('Тема тренировки');

    // Делаем 3 хода пользователя
    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });

    for (let i = 0; i < 3; i++) {
      fireEvent.change(textarea, { target: { value: `Ответ ${i}` } });
      fireEvent.click(sendBtn);
      await waitFor(() => expect(screen.queryByText(`Ответ ${i}`)).toBeInTheDocument());
    }

    // Завершаем диалог
    const completeBtn = screen.getAllByRole('button', { name: 'Завершить' })[0];
    fireEvent.click(completeBtn);
    const confirmBtn = screen.getAllByRole('button', { name: 'Завершить' })[1];
    fireEvent.click(confirmBtn);

    // Дожидаемся результатов и исчезновения загрузчика
    await screen.findByText('Итоги практики');
    await waitFor(() => expect(screen.queryByText('Анализируем диалог...')).not.toBeInTheDocument());

    // Кнопка повтора должна быть видна
    const replayBtn = await screen.findByRole('button', { name: '🔁 Беглость: пройти сценарий быстрее' });
    expect(replayBtn).toBeInTheDocument();

    // Кликаем по кнопке повтора -> переводит в раунд 1
    fireEvent.click(replayBtn);

    // Проверяем, что в localStorage записана сессия с fluencyRound: 1
    const savedSession = JSON.parse(localStorage.getItem('yomumogu_profile_default_active_session') || '{}');
    expect(savedSession.fluencyMode).toBe(true);
    expect(savedSession.fluencyRound).toBe(1);

    // Теперь проверим round 2 и 3
    // Для этого напрямую положим сессию с fluencyRound: 1
    localStorage.clear();
    const fluencySession1 = {
      ...session,
      id: 'test-session-fluency-1',
      fluencyMode: true,
      fluencyRound: 1 as const,
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(fluencySession1));

    // Рендерим заново для раунда 1
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat/analyze')) {
        return {
          ok: true,
          json: async () => ({ words: [] }),
        } as Response;
      }
      if (urlStr.includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({
            reply: 'こんにちは！',
            translation: 'Привет!',
            wordsDetected: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    cleanup();
    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);
    await screen.findByText('Тема тренировки');

    // Снова 3 хода
    const textarea2 = screen.getByPlaceholderText('Напишите на японском...');
    const sendBtn2 = screen.getByRole('button', { name: /Отправить/i });
    for (let i = 0; i < 3; i++) {
      fireEvent.change(textarea2, { target: { value: `Ответ ${i}` } });
      fireEvent.click(sendBtn2);
      await waitFor(() => expect(screen.queryByText(`Ответ ${i}`)).toBeInTheDocument());
    }

    // Завершаем
    const completeBtn2 = screen.getAllByRole('button', { name: 'Завершить' })[0];
    fireEvent.click(completeBtn2);
    const confirmBtn2 = screen.getAllByRole('button', { name: 'Завершить' })[1];
    fireEvent.click(confirmBtn2);

    await screen.findByText('Итоги практики');
    await waitFor(() => expect(screen.queryByText('Анализируем диалог...')).not.toBeInTheDocument());

    // Кнопка должна предлагать Раунд 2
    const replayBtnRound2 = await screen.findByRole('button', { name: '🔁 Раунд 2: ещё быстрее' });
    expect(replayBtnRound2).toBeInTheDocument();

    // Кликаем по кнопке повтора -> переводит в раунд 2
    fireEvent.click(replayBtnRound2);
    const savedSession2 = JSON.parse(localStorage.getItem('yomumogu_profile_default_active_session') || '{}');
    expect(savedSession2.fluencyRound).toBe(2);

    // Теперь напрямую положим сессию с fluencyRound: 3
    localStorage.clear();
    const fluencySession3 = {
      ...session,
      id: 'test-session-fluency-3',
      fluencyMode: true,
      fluencyRound: 3 as const,
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(fluencySession3));

    // Рендерим заново для раунда 3
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat/analyze')) {
        return {
          ok: true,
          json: async () => ({ words: [] }),
        } as Response;
      }
      if (urlStr.includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({
            reply: 'こんにちは！',
            translation: 'Привет!',
            wordsDetected: [],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    cleanup();
    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);
    await screen.findByText('Тема тренировки');

    // 3 хода
    const textarea3 = screen.getByPlaceholderText('Напишите на японском...');
    const sendBtn3 = screen.getByRole('button', { name: /Отправить/i });
    for (let i = 0; i < 3; i++) {
      fireEvent.change(textarea3, { target: { value: `Ответ ${i}` } });
      fireEvent.click(sendBtn3);
      await waitFor(() => expect(screen.queryByText(`Ответ ${i}`)).toBeInTheDocument());
    }

    // Завершаем
    const completeBtn3 = screen.getAllByRole('button', { name: 'Завершить' })[0];
    fireEvent.click(completeBtn3);
    const confirmBtn3 = screen.getAllByRole('button', { name: 'Завершить' })[1];
    fireEvent.click(confirmBtn3);

    await screen.findByText('Итоги практики');
    await waitFor(() => expect(screen.queryByText('Анализируем диалог...')).not.toBeInTheDocument());

    // После раунда 3 кнопка скрыта
    const replayBtnRound4 = screen.queryByRole('button', { name: /Беглость|Раунд/ });
    expect(replayBtnRound4).not.toBeInTheDocument();
  });

  it('в fluency-режиме grammarScope не содержит focus и не-mature ноды', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';

    try {
      // Устанавливаем сессию с fluencyMode: true
      const session = {
        id: 'test-session-fluency-scope',
        title: 'Тема тренировки',
        description: 'Описание сценария',
        scenario: 'Сценарий разговора',
        targetWords: [],
        fluencyMode: true,
        fluencyRound: 1 as const,
      };
      localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));

      // Настраиваем IndexedDB с грамматикой (одна зрелая g_n5_s1_1, одна незрелая g_n5_s1_2)
      await db.grammar_progress.clear();
      await db.grammar_progress.put({
        profileId: 'default',
        ruleId: 'g_n5_s1_1',
        status: 'mature',
        due: Date.now() - 10000,
        stepIndex: 0,
      });
      await db.grammar_progress.put({
        profileId: 'default',
        ruleId: 'g_n5_s1_2',
        status: 'learning',
        due: Date.now() - 10000,
        stepIndex: 0,
      });

      let lastRequestJson: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/chat')) {
          lastRequestJson = JSON.parse(init?.body as string);
          return {
            ok: true,
            json: async () => ({
              reply: 'こんにちは！',
              translation: 'Привет!',
              wordsDetected: [],
              grammarFeedback: { isCorrect: true },
            }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

      // Ожидаем завершения startConversation
      await waitFor(() => {
        expect(lastRequestJson).not.toBeNull();
      });

      // Проверяем тело запроса
      expect(lastRequestJson.grammarFocus).toBeUndefined(); // focus OMITTED
      expect(lastRequestJson.grammarScope).toBeDefined();
      // Должна быть отфильтрована только mature
      const allowed = lastRequestJson.grammarScope.allowedConstructions;
      expect(allowed.some((a: any) => a.id === 'g_n5_s1_1')).toBe(true);
      expect(allowed.some((a: any) => a.id === 'g_n5_s1_2')).toBe(false); // g_n5_s1_2 (learning) удалена из скоупа
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  it('истечение таймера не блокирует ввод и отправку', async () => {
    vi.useRealTimers();

    const session = {
      id: 'test-session-fluency-timer',
      title: 'Тема тренировки',
      description: 'Описание сценария',
      scenario: 'Сценарий разговора',
      targetWords: [],
      fluencyMode: true,
      fluencyRound: 1 as const,
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));

    let fetchCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat')) {
        const isSend = init?.body && typeof init.body === 'string' && init.body.includes('Привет!');
        if (isSend) {
          fetchCalled = true;
        }
        return {
          ok: true,
          json: async () => ({
            reply: 'こんにちは！',
            translation: 'Привет!',
            wordsDetected: [],
            grammarFeedback: { isCorrect: true },
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Ждем старта
    await screen.findByText('Тема тренировки');
    await screen.findByText('こんにちは！');

    // Переключаемся на фейковые таймеры
    vi.useFakeTimers();

    // Прокручиваем время вперед, превышая лимит хода
    vi.advanceTimersByTime(45000);

    // Таймер истек, но инпут должен быть доступен
    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    expect(textarea).not.toBeDisabled();

    // Возвращаем реальные таймеры для отправки
    vi.useRealTimers();

    fireEvent.change(textarea, { target: { value: 'Привет!' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    await waitFor(() => expect(fetchCalled).toBe(true));
  });

  it('Summary после fluency-сессии показывает карточку статистики с процентом в лимите', async () => {
    const session = {
      id: 'test-session-fluency-stats',
      title: 'Тема тренировки',
      description: 'Описание сценария',
      scenario: 'Сценарий разговора',
      targetWords: [],
      fluencyMode: true,
      fluencyRound: 1 as const,
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));

    // Установим предзагруженное состояние с fluencyTurns
    const savedState = {
      messages: [
        { id: '1', role: 'model' as const, text: 'Привет!' },
        { id: '2', role: 'user' as const, text: 'Привет!', grammarFeedback: { isCorrect: true } },
        { id: '3', role: 'model' as const, text: 'Как дела?' },
        { id: '4', role: 'user' as const, text: 'Хорошо', grammarFeedback: { isCorrect: true } },
      ],
      collectedWords: [],
      isComplete: false,
      unusedTargetWords: [],
      showSummaryScreen: true,
      analyzedWords: [],
      selectedSyncCards: [],
      selectedAddWords: [],
      fluencyTurns: [
        { ms: 10000, limitMs: 20000 }, // в лимите
        { ms: 25000, limitMs: 20000 }, // превышен
      ],
    };
    localStorage.setItem(`yomumogu_profile_default_chat_state_test-session-fluency-stats`, JSON.stringify(savedState));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        words: [],
      }),
    } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Summary screen должен показаться
    await screen.findByText(/Результаты раунда\s*1/);
    expect(screen.getByText(/В лимите:\s*1\s*из\s*2\s*ходов\s*\(50%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Среднее время ответа:\s*17\.5\s*сек/)).toBeInTheDocument();
  });
});

describe('Soft Closing and Passive Timing Tests', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    mockPush.mockReset();
  });

  const setupActiveSession = (extra = {}) => {
    const session = {
      id: 'test-session-soft-closing',
      title: 'Тема тренировки',
      description: 'Описание сценария',
      scenario: 'Сценарий разговора',
      targetWords: [
        { word: '猫', translation: 'кошка' },
      ],
      ...extra
    };
    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(session));
    return session;
  };

  it('сбор последнего target-слова отправляет ровно один запрос с closingTurn', async () => {
    setupActiveSession();
    let apiCalls: any[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        apiCalls.push(body);
        if (body.message === '__START__') {
          return {
            ok: true,
            json: async () => ({
              reply: 'こんにちは！',
              translation: 'Привет!',
              wordsDetected: [],
              grammarFeedback: { isCorrect: true },
            }),
          } as Response;
        } else if (body.closingTurn) {
          return {
            ok: true,
            json: async () => ({
              reply: 'お疲れ様でした！またね！',
              translation: 'Спасибо за работу! Пока!',
              wordsDetected: [],
              grammarFeedback: { isCorrect: true },
            }),
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => ({
              reply: '猫だね！',
              translation: 'Кошка!',
              wordsDetected: ['猫'],
              grammarFeedback: { isCorrect: true },
            }),
          } as Response;
        }
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Ждем старта
    await screen.findByText('こんにちは！');

    // Отправляем "猫"
    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '猫' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    // Должен показаться ответ про кошку
    await screen.findByText('猫だね！');

    // И должен автоматически улететь запрос с closingTurn
    await waitFor(() => {
      expect(apiCalls.some(call => call.closingTurn === true)).toBe(true);
    });

    // closingTurn должен уйти ровно один раз
    const closingCalls = apiCalls.filter(call => call.closingTurn === true);
    expect(closingCalls.length).toBe(1);
  });

  it('после закругления виден баннер и кнопка К итогам, ввод активен', async () => {
    setupActiveSession();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.message === '__START__') {
          return {
            ok: true,
            json: async () => ({ reply: 'こんにちは！', wordsDetected: [], grammarFeedback: { isCorrect: true } }),
          } as Response;
        } else if (body.closingTurn) {
          return {
            ok: true,
            json: async () => ({ reply: 'またね！', wordsDetected: [], grammarFeedback: { isCorrect: true } }),
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => ({ reply: '猫だね！', wordsDetected: ['猫'], grammarFeedback: { isCorrect: true } }),
          } as Response;
        }
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await screen.findByText('こんにちは！');
    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '猫' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    await screen.findByText('またね！');

    // Проверяем баннер и кнопку
    expect(screen.getByText('Все слова собраны! 🎉')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'К итогам' })).toBeInTheDocument();

    // Ввод НЕ заблокирован
    expect(textarea).not.toBeDisabled();
  });

  it('восстановление сессии с closingDone не шлёт повторный closingTurn', async () => {
    setupActiveSession();
    let apiCalls: any[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        apiCalls.push(body);
        return {
          ok: true,
          json: async () => ({ reply: 'Привет', wordsDetected: [], grammarFeedback: { isCorrect: true } }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    // Кладём состояние сессии с closingDone: true и всеми собранными словами
    const savedState = {
      messages: [
        { id: '1', role: 'model' as const, text: 'Привет' },
        { id: '2', role: 'user' as const, text: '猫', wordsDetected: ['猫'] }
      ],
      collectedWords: ['猫'],
      isComplete: false,
      unusedTargetWords: [],
      closingDone: true,
    };
    localStorage.setItem(`yomumogu_profile_default_chat_state_test-session-soft-closing`, JSON.stringify(savedState));

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await screen.findByText('Привет');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Запрос closingTurn НЕ должен быть отправлен, так как closingDone: true
    expect(apiCalls.some(call => call.closingTurn === true)).toBe(false);
  });

  it('fluency: при сборе всех слов таймер очищается и полоса скрыта', async () => {
    setupActiveSession({ fluencyMode: true, fluencyRound: 1 });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/chat')) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.message === '__START__') {
          return {
            ok: true,
            json: async () => ({ reply: 'Привет', wordsDetected: [], grammarFeedback: { isCorrect: true } }),
          } as Response;
        } else if (body.closingTurn) {
          return {
            ok: true,
            json: async () => ({ reply: 'Пока', wordsDetected: [], grammarFeedback: { isCorrect: true } }),
          } as Response;
        } else {
          return {
            ok: true,
            json: async () => ({ reply: 'Кошка', wordsDetected: ['猫'], grammarFeedback: { isCorrect: true } }),
          } as Response;
        }
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    // Ждем стартового сообщения
    await screen.findByText('Привет');

    // Проверяем, что таймер-бар изначально есть на экране
    expect(document.querySelector('[class*="timerBar"]')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Напишите на японском...');
    fireEvent.change(textarea, { target: { value: '猫' } });
    const sendBtn = screen.getByRole('button', { name: /Отправить/i });
    fireEvent.click(sendBtn);

    // Дожидаемся завершения закругления
    await screen.findByText('Пока');

    // Проверяем, что таймер-бар скрыт
    const timerBar = document.querySelector('[class*="timerBar"]');
    expect(timerBar).toBeNull();
  });

  it('Summary показывает среднее время реплики, в диалоге индикации времени нет', async () => {
    setupActiveSession();
    
    const savedState = {
      messages: [
        { id: '1', role: 'model' as const, text: 'Привет' },
        { id: '2', role: 'user' as const, text: 'Ответ 1' },
      ],
      collectedWords: ['猫'],
      isComplete: false,
      unusedTargetWords: [],
      showSummaryScreen: true,
      analyzedWords: [],
      selectedSyncCards: [],
      selectedAddWords: [],
      passiveTurns: [
        { ms: 12000 },
        { ms: 8000 }
      ]
    };
    localStorage.setItem(`yomumogu_profile_default_chat_state_test-session-soft-closing`, JSON.stringify(savedState));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ words: [] }),
    } as Response);

    render(<JapanificationProvider><ChatPage /></JapanificationProvider>);

    await screen.findByText('Итоги практики');

    // Проверяем отображение среднего времени (12 + 8) / 2 = 10 сек
    expect(screen.getByText(/Среднее время реплики:\s*10\.0\s*сек/)).toBeInTheDocument();
  });
});



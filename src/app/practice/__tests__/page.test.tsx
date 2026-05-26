import React from 'react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';

// Инициализируем полифилл IndexedDB до загрузки Dexie
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PracticePage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';
import { db } from '@/core/db';
import { getDailyNewWordsCount } from '@/core/localDeckService';


// Мокаем lucide-react, так как некоторые иконки могут некорректно рендериться в jsdom
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  Settings: () => <span data-testid="icon-settings" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Play: () => <span data-testid="icon-play" />,
  XCircle: () => <span data-testid="icon-x" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Globe: () => <span data-testid="icon-globe" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x-close" />,
  Volume2: () => <span data-testid="icon-volume" />,
  Target: () => <span data-testid="icon-target" />,
}));

// Мокаем next/link и next/navigation
vi.mock('next/link', () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
    }),
  };
});

describe('PracticePage Component', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.words.clear();
    await db.reviews.clear();
  });

  it('отображает заголовок страницы и загрузку данных', async () => {
    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    expect(await screen.findByRole('heading', { name: 'Практика диалога', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Источник обучения:')).toBeInTheDocument();
  });

  it('отображает пустое состояние, если слова не загружены', async () => {
    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText(/Локальный список еще не инициализирован/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Перейти в настройки' })).toBeInTheDocument();
    });
  });

  it('отображает кнопку генерации сессий, если слова импортированы, но темы не созданы', async () => {
    // Устанавливаем режим 'custom' и записываем слова в localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    localStorage.setItem('yomumogu_profile_default_selected_deck', 'MyDeck');
    localStorage.setItem(
      'yomumogu_profile_default_words',
      JSON.stringify([{ id: 1, word: '猫', translation: 'кошка', status: 'new' }])
    );

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Источник обучения:')).toBeInTheDocument();
      expect(screen.getByText('Своя Anki (MyDeck)')).toBeInTheDocument();
      expect(screen.getByText('Импортировано слов: 1')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Сгенерировать темы тренировок' })[0]).toBeInTheDocument();
    });
  });

  it('генерирует и отображает разговорные сессии при клике на генерацию', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    localStorage.setItem('yomumogu_profile_default_selected_deck', 'MyDeck');
    localStorage.setItem(
      'yomumogu_profile_default_words',
      JSON.stringify([{ id: 1, word: '猫', translation: 'кошка', status: 'new' }])
    );

    const mockSessions = [
      {
        id: 'session-1',
        title: 'Тема кафе',
        description: 'Диалог в кафе.',
        scenario: 'Вы в кафе',
        targetWords: [{ word: '猫', translation: 'кошка' }]
      }
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      console.log('--- TEST FETCH MOCK CALLED FOR URL:', url);
      if (url.toString().includes('/api/gemini/sessions')) {
        return Promise.resolve({
          ok: true,
          json: async () => {
            console.log('--- TEST FETCH MOCK RETURNING SESSIONS');
            return { sessions: mockSessions };
          },
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    const genBtns = await screen.findAllByRole('button', { name: 'Сгенерировать темы тренировок' });
    console.log('--- TEST CLICKING BUTTON, count:', genBtns.length);
    fireEvent.click(genBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Тема кафе')).toBeInTheDocument();
      expect(screen.getByText('Диалог в кафе.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Начать практику' })).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('отображает кнопку "Продолжить" вместо "Начать практику", если сессия уже начата', async () => {
    const mockSessions = [
      {
        id: 'session-in-progress',
        title: 'Тема кафе',
        description: 'Диалог в кафе.',
        scenario: 'Вы в кафе',
        targetWords: [{ word: '猫', translation: 'кошка' }]
      }
    ];

    localStorage.setItem('yomumogu_profile_default_deck_mode', 'custom');
    localStorage.setItem('yomumogu_profile_default_sessions', JSON.stringify(mockSessions));
    localStorage.setItem(
      'yomumogu_profile_default_words',
      JSON.stringify([{ id: 1, word: '猫', translation: 'кошка', status: 'new' }])
    );
    localStorage.setItem(
      'yomumogu_profile_default_chat_state_session-in-progress',
      JSON.stringify({
        messages: [{ id: 'msg-1', role: 'user', text: 'Привет' }],
        collectedWords: [],
        isComplete: false
      })
    );

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Тема кафе')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Сброс' })).toBeInTheDocument();
    });
  });

  it('loads and displays local deck due words count for quiz in local mode', async () => {
    // Setup local deck mode in localStorage
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'local');
    localStorage.setItem('yomumogu_profile_default_selected_deck', '__local_starter__');

    // Populate IndexedDB with a local deck word (Version 3 schema properties)
    // One word that is due (due <= now)
    const now = Date.now();
    await db.words.put({
      profileId: 'default',
      id: 777,
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      category: '__local_starter__',
      source: 'starter',
      passive: {
        status: 'mature',
        stability: 200,
        difficulty: 5.0,
        interval: 200,
        due: now - 10000, // due
        reps: 1,
        lapses: 0,
      },
      active: {
        status: 'mature',
        stability: 200,
        difficulty: 5.0,
        interval: 200,
        due: now - 10000, // due
        reps: 1,
        lapses: 0,
      },
      contextExamples: []
    });

    // One word that is not due (due > now)
    await db.words.put({
      profileId: 'default',
      id: 888,
      word: '犬',
      reading: 'いぬ',
      translation: 'собака',
      category: '__local_starter__',
      source: 'starter',
      passive: {
        status: 'mature',
        stability: 200,
        difficulty: 5.0,
        interval: 200,
        due: now + 500000, // not due
        reps: 1,
        lapses: 0,
      },
      active: {
        status: 'mature',
        stability: 200,
        difficulty: 5.0,
        interval: 200,
        due: now + 500000, // not due
        reps: 1,
        lapses: 0,
      },
      contextExamples: []
    });

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    // Verify statistics and words table display correct data
    await waitFor(() => {
      expect(screen.getByText(/Активное повторение слов/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Начать повторение\s*\[1\]/ })).toBeInTheDocument();
      expect(screen.getByText(/Источник обучения:/)).toBeInTheDocument();
    });
  });

  it('does not count new status words even if due <= now', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'local');
    localStorage.setItem('yomumogu_profile_default_selected_deck', '__local_starter__');

    const now = Date.now();
    // 2 learning слова с due <= now (настоящие due)
    await db.words.put({
      profileId: 'default',
      id: 100,
      word: '食べる',
      reading: 'たべる',
      translation: 'есть',
      category: '__local_starter__',
      source: 'starter',
      passive: { status: 'learning', stability: 5, difficulty: 5, interval: 5, due: now - 10000, reps: 2, lapses: 0 },
      active: { status: 'learning', stability: 5, difficulty: 5, interval: 5, due: now - 10000, reps: 2, lapses: 0 },
      contextExamples: []
    });
    await db.words.put({
      profileId: 'default',
      id: 101,
      word: '飲む',
      reading: 'のむ',
      translation: 'пить',
      category: '__local_starter__',
      source: 'starter',
      passive: { status: 'review', stability: 10, difficulty: 5, interval: 10, due: now - 5000, reps: 3, lapses: 0 },
      active: { status: 'review', stability: 10, difficulty: 5, interval: 10, due: now - 5000, reps: 3, lapses: 0 },
      contextExamples: []
    });
    // 5 new слов с due = now (НЕ должны считаться)
    for (let i = 200; i < 205; i++) {
      await db.words.put({
        profileId: 'default',
        id: i,
        word: `新${i}`,
        reading: `しん${i}`,
        translation: `новое${i}`,
        category: '__local_starter__',
        source: 'starter',
        passive: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        active: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        contextExamples: []
      });
    }

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    await waitFor(() => {
      // Должен показать только 2 due слова, а не 7
      expect(screen.getByRole('button', { name: /Начать повторение\s*\[2\]/ })).toBeInTheDocument();
    });
  });

  it('displays daily limit offset controls and updates limit dynamically', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'local');
    localStorage.setItem('yomumogu_profile_default_selected_deck', '__local_starter__');

    // Добавим 5 новых слов в IndexedDB
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.words.put({
        profileId: 'default',
        id: 9000 + i,
        word: `Слово${i}`,
        reading: `読み${i}`,
        translation: `Перевод${i}`,
        category: '__local_starter__',
        source: 'starter',
        passive: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        active: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        contextExamples: []
      });
    }

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    // Ожидаем появление новых блоков
    await waitFor(() => {
      expect(screen.getByText('Новые слова на сегодня')).toBeInTheDocument();
      expect(screen.getByText('Изучено сегодня:')).toBeInTheDocument();
      expect(screen.getByText('0 из 10')).toBeInTheDocument();
      expect(screen.getByText('Всего неизученных слов: 5')).toBeInTheDocument();
    });

    // Находим кнопку добавления лимита и кликаем
    const addBtn = screen.getByRole('button', { name: /Добавить \+10/ });
    fireEvent.click(addBtn);

    // Должно обновиться значение лимита до 20
    await waitFor(() => {
      expect(screen.getByText('0 из 20')).toBeInTheDocument();
    });
  });

  it('runs warm-up with correct limit and shows the закрепление button on finished state', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'local');
    localStorage.setItem('yomumogu_profile_default_selected_deck', '__local_starter__');

    // Добавим 2 новых слова
    const now = Date.now();
    for (let i = 0; i < 2; i++) {
      await db.words.put({
        profileId: 'default',
        id: 9100 + i,
        word: `Вормуп${i}`,
        reading: `ёми${i}`,
        translation: `транс${i}`,
        category: '__local_starter__',
        source: 'starter',
        passive: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        active: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
        contextExamples: []
      });
    }

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    const warmupBtn = await screen.findByRole('button', { name: /Начать разминку/ });
    fireEvent.click(warmupBtn);

    // Первое слово - Знакомство
    expect(await screen.findByText('Знакомство')).toBeInTheDocument();
    expect(screen.getByText('Вормуп0')).toBeInTheDocument();
    
    // Клик по "Далее" -> Проверка чтения
    fireEvent.click(screen.getByRole('button', { name: 'Далее →' }));
    expect(await screen.findByText('Проверка чтения')).toBeInTheDocument();

    // Отвечаем (выбираем правильное чтение "ёми0")
    fireEvent.click(screen.getByRole('button', { name: 'ёми0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Далее →' }));

    // Проверка перевода
    expect(await screen.findByText('Проверка перевода')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'транс0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Следующее слово →' }));

    // Второе слово - Знакомство
    expect(await screen.findByText('Знакомство')).toBeInTheDocument();
    expect(screen.getByText('Вормуп1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Далее →' }));

    // Проверка чтения
    expect(await screen.findByText('Проверка чтения')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ёми1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Далее →' }));

    // Проверка перевода
    expect(await screen.findByText('Проверка перевода')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'транс1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Завершить разминку ✓' }));

    // Должен появиться экран завершения с кнопкой закрепления
    expect(await screen.findByText('Разминка завершена!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрепить новые слова (Квиз)' })).toBeInTheDocument();
  });

  it('does NOT increment the daily new words count when generating scenarios in local mode', async () => {
    localStorage.setItem('yomumogu_profile_default_deck_mode', 'local');
    localStorage.setItem('yomumogu_profile_default_daily_new_words_limit', '10');
    
    // Очистим счетчик в localStorage
    const dString = new Date().toISOString().split('T')[0];
    localStorage.removeItem(`yomumogu_profile_default_daily_new_words_${dString}`);

    // Добавим одно новое слово в БД
    const now = Date.now();
    await db.words.put({
      profileId: 'default',
      id: 8888,
      word: 'テスト',
      reading: 'てすと',
      translation: 'тест',
      category: '__local_starter__',
      source: 'starter',
      passive: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
      active: { status: 'new', stability: 0, difficulty: 0, interval: 0, due: now, reps: 0, lapses: 0 },
      contextExamples: []
    });

    const mockSessions = [
      {
        id: 'session-local',
        title: 'Тема Локал',
        description: 'Описание Локал.',
        scenario: 'Сценарий Локал',
        targetWords: [{ word: 'テスト', translation: 'тест' }]
      }
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url.toString().includes('/api/gemini/sessions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sessions: mockSessions }),
        } as Response);
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    render(<JapanificationProvider><PracticePage /></JapanificationProvider>);

    // Ждем кнопку генерации и кликаем
    const genBtns = await screen.findAllByRole('button', { name: 'Сгенерировать темы тренировок' });
    fireEvent.click(genBtns[0]);

    // Ждем появления сгенерированной сессии
    await screen.findByText('Тема Локал');

    // Проверяем, что счетчик изученных за сегодня слов остался равен 0
    expect(getDailyNewWordsCount('default')).toBe(0);

    fetchSpy.mockRestore();
  });
});

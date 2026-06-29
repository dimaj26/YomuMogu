import React from 'react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';

// Инициализируем полифилл IndexedDB до загрузки Dexie
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';
import { JpUIProvider } from '@/components/JpUIProvider';
import { db } from '@/core/db';

const renderHome = () =>
  render(
    <JapanificationProvider>
      <JpUIProvider>
        <HomePage />
      </JpUIProvider>
    </JapanificationProvider>
  );

// Роутер next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// next/link как обычная ссылка
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const UNINIT = /Колода ещё не инициализирована/;

// Засев N слов локальной стартовой колоды. statusFor(i) задаёт FSRS-статус слова i.
async function seedWords(n: number, statusFor: (i: number) => string = () => 'new') {
  const now = Date.now();
  const rows = Array.from({ length: n }, (_, i) => {
    const status = statusFor(i);
    const mature = status === 'mature';
    return {
      profileId: 'default', id: 7000 + i, word: `語${i}`, reading: 'ご', translation: 'слово',
      category: '__local_starter__', source: 'starter' as const,
      active: {
        stability: mature ? 120 : 0, difficulty: 5, interval: mature ? 120 : 0,
        due: mature ? now + 90 * 86400000 : now, reps: mature ? 8 : 0, lapses: 0, status,
      },
      contextExamples: [],
    };
  });
  await db.words.bulkPut(rows as any);
}

describe('Home Kumiko grid description reflects deck state (F-04)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.words.clear();
  });

  it('до инициализации описание не утверждает «500 слов», а зовёт на диагностику', async () => {
    renderHome();
    expect(await screen.findByText(UNINIT)).toBeInTheDocument();
    expect(screen.queryByText(/состояние\s+\d+\s+слов вашей стартовой колоды/)).not.toBeInTheDocument();
  });

  it('после инициализации описание отражает реальный размер колоды (не хардкод 500)', async () => {
    await seedWords(1);
    renderHome();
    // Динамический счётчик: 1 слово, не «500»
    expect(await screen.findByText(/состояние\s+1\s+слов вашей стартовой колоды/)).toBeInTheDocument();
    expect(screen.queryByText(UNINIT)).not.toBeInTheDocument();
  });
});

describe('Home Kumiko grid scales to the real deck (005 / C-02)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.words.clear();
  });

  it('колода ровно 500 слов — описание показывает 500 (регрессия)', async () => {
    await seedWords(500);
    renderHome();
    expect(await screen.findByText(/состояние\s+500\s+слов вашей стартовой колоды/, undefined, { timeout: 25000 })).toBeInTheDocument();
  }, 30000);

  it('колода <500 слов — описание показывает реальный счёт', async () => {
    await seedWords(25);
    renderHome();
    expect(await screen.findByText(/состояние\s+25\s+слов вашей стартовой колоды/, undefined, { timeout: 12000 })).toBeInTheDocument();
  }, 15000);

  it('колода >500 слов — счёт реальный и поздние слова НЕ теряются на карте', async () => {
    // 550 слов: первые 500 — new, последние 50 — mature.
    // Старый код (slice первых 500) их бы выкинул и «Усвоенных» ячеек не было бы.
    await seedWords(550, (i) => (i >= 500 ? 'mature' : 'new'));
    renderHome();

    expect(await screen.findByText(/состояние\s+550\s+слов вашей стартовой колоды/, undefined, { timeout: 25000 })).toBeInTheDocument();
    // Поздние mature-слова отражены хотя бы в одной ячейке -> карта покрывает всю колоду.
    await waitFor(() => {
      const titles = Array.from(document.querySelectorAll('title')).map(t => t.textContent || '');
      expect(titles.some(tt => /Усвоенные/.test(tt))).toBe(true);
    }, { timeout: 20000 });
  }, 30000);
});

describe('Home mascot greeting is state-aware (008 / C-10)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.words.clear();
  });

  it('первый запуск: маскот зовёт на диагностику, без несуществующего «раздела практики»', async () => {
    renderHome(); // свежий профиль -> dashState first-run, level 0

    // Уникальная фраза first-run-бабла маскота
    expect(await screen.findByText(/я подберу слова под тебя/)).toBeInTheDocument();
    // Старая дезориентирующая отсылка к несуществующему разделу исчезла
    expect(screen.queryByText(/раздел практики/)).not.toBeInTheDocument();
  });
});

describe('Home first-run "how it works" overview (011 / C-14)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.words.clear();
  });

  it('первый запуск: показан 3-шаговый обзор «Как это работает»', async () => {
    renderHome(); // свежий профиль -> first-run

    expect(await screen.findByText(/Как это работает/)).toBeInTheDocument();
    expect(screen.getByText(/подберём ваши слова/)).toBeInTheDocument();
    expect(screen.getByText(/интервальные повторения/)).toBeInTheDocument();
    expect(screen.getByText(/живом диалоге/)).toBeInTheDocument();
  });

  it('после инициализации колоды обзор «Как это работает» отсутствует', async () => {
    await seedWords(1); // колода инициализирована -> не first-run
    renderHome();

    // дожидаемся загрузки (адаптивный заголовок не first-run)
    await screen.findByText(/состояние\s+1\s+слов вашей стартовой колоды/);
    expect(screen.queryByText(/Как это работает/)).not.toBeInTheDocument();
  });
});

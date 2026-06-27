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
const SEEDED = /состояние 500 слов вашей стартовой колоды/;

describe('Home Kumiko grid description reflects deck state (F-04)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await db.words.clear();
  });

  it('до инициализации описание не утверждает «500 слов», а зовёт на диагностику', async () => {
    renderHome();

    expect(await screen.findByText(UNINIT)).toBeInTheDocument();
    expect(screen.queryByText(SEEDED)).not.toBeInTheDocument();
  });

  it('после инициализации описание отражает посеянную колоду', async () => {
    // Сеем слово стартовой колоды -> isLocalDeckInitialized = true
    await db.words.put({
      profileId: 'default', id: 9101, word: '水', reading: 'みず', translation: 'вода',
      category: '__local_starter__', source: 'starter',
      active: { stability: 0, difficulty: 5, interval: 0, due: Date.now(), reps: 0, lapses: 0, status: 'new' },
      contextExamples: []
    });

    renderHome();

    expect(await screen.findByText(SEEDED)).toBeInTheDocument();
    expect(screen.queryByText(UNINIT)).not.toBeInTheDocument();
  });
});

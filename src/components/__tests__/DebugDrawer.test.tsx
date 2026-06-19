import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
import { DebugDrawer } from '../DebugDrawer';
import { JapanificationProvider } from '../../hooks/useJapanification';
import { JpUIProvider } from '../JpUIProvider';
import { db } from '../../core/db';
import { LOCAL_DECK_NAME } from '../../core/localDeckService';

// Полифилл для IndexedDB в тестах
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

describe('DebugDrawer Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <JapanificationProvider>
        <JpUIProvider>
          {ui}
        </JpUIProvider>
      </JapanificationProvider>
    );
  };

  it('renders the floating trigger button', () => {
    renderWithProviders(<DebugDrawer />);
    
    const trigger = screen.getByRole('button', { name: /Debug/i });
    expect(trigger).toBeInTheDocument();
  });

  it('opens the sidebar drawer on trigger click', () => {
    renderWithProviders(<DebugDrawer />);
    
    const trigger = screen.getByRole('button', { name: /Debug/i });
    fireEvent.click(trigger);
    
    expect(screen.getByText('YomuMogu Debug HUD')).toBeInTheDocument();
  });

  it('allows tab switching', () => {
    renderWithProviders(<DebugDrawer />);
    
    const trigger = screen.getByRole('button', { name: /Debug/i });
    fireEvent.click(trigger);
    
    // Вкладка Промпты
    const promptTab = screen.getByRole('button', { name: /Промпты Gemini/i });
    fireEvent.click(promptTab);
    expect(screen.getByText(/Запросы еще не отправлялись/i)).toBeInTheDocument();
    
    // Вкладка Состояние
    const stateTab = screen.getByRole('button', { name: /Состояние/i });
    fireEvent.click(stateTab);
    expect(screen.getByText('Выбор профиля')).toBeInTheDocument();
  });

  it('excludes words with status "new" from the due words list', async () => {
    // Добавим в IndexedDB слово со статусом "new", у которого due в прошлом
    const now = Date.now();
    await db.words.put({
      profileId: 'default',
      id: 999,
      word: 'テスト',
      reading: 'てすと',
      translation: 'тест',
      category: LOCAL_DECK_NAME,
      source: 'starter',
      active: {
        stability: 0,
        difficulty: 0,
        interval: 0,
        due: now - 1000,
        reps: 0,
        lapses: 0,
        status: 'new'
      },
      contextExamples: []
    });

    renderWithProviders(<DebugDrawer />);
    
    const trigger = screen.getByRole('button', { name: /Debug/i });
    fireEvent.click(trigger);
    
    // Ждем, пока слово появится в инспекторе БД (это гарантирует, что данные загрузились)
    expect((await screen.findAllByText('テスト')).length).toBeGreaterThan(0);
    
    // В списке "Слова на повторении (0)" должно быть 0 слов на повторении
    expect(screen.getByText('Слова на повторении (0)')).toBeInTheDocument();
  });
});

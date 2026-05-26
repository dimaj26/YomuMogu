import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
import { DebugDrawer } from '../DebugDrawer';
import { JapanificationProvider } from '../../hooks/useJapanification';
import { JpUIProvider } from '../JpUIProvider';

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
});

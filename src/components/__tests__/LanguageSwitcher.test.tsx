import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Globe: () => <span data-testid="icon-globe" />,
  ChevronDown: () => <span data-testid="icon-chevron" />,
  Check: () => <span data-testid="icon-check" />,
}));

import { LanguageSwitcher } from '../LanguageSwitcher';
import { JapanificationProvider } from '@/hooks/useJapanification';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderSwitcher = () =>
    render(
      <JapanificationProvider>
        <LanguageSwitcher />
      </JapanificationProvider>
    );

  it('показывает три режима с пояснениями при открытии', () => {
    renderSwitcher();
    // Открываем выпадающий список
    fireEvent.click(screen.getByRole('button', { name: /Smart/ }));

    expect(screen.getByText('Русский')).toBeInTheDocument();
    expect(screen.getByText('日本語')).toBeInTheDocument();
    // Пояснение Smart: упоминает постепенную японизацию и сброс в Настройках
    const smartDesc = screen.getByText(/постепенно становится японским/);
    expect(smartDesc).toBeInTheDocument();
    expect(smartDesc.textContent).toMatch(/Настройка/);
  });
});

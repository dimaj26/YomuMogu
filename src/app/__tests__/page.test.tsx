import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage from '../page';
import { JapanificationProvider } from '@/hooks/useJapanification';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  Settings: () => <span data-testid="icon-settings" />,
  User: () => <span data-testid="icon-user" />,
  HelpCircle: () => <span data-testid="icon-help" />,
  X: () => <span data-testid="icon-x" />,
  Check: () => <span data-testid="icon-check" />,
  Award: () => <span data-testid="icon-award" />,
  BarChart2: () => <span data-testid="icon-barchart2" />,
  Globe: () => <span data-testid="icon-globe" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
}));

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock JpUI component to avoid context error
vi.mock('@/components/JpUI', () => ({
  JpUI: ({ ru }: { ru: string }) => <span>{ru}</span>,
}));

describe('HomePage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockPush.mockReset();
  });

  it('renders landing page with Start Practice button when no active session', async () => {
    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    // Wait for the loading state to complete
    await waitFor(() => {
      expect(screen.getByText('Начать практику')).toBeInTheDocument();
    });

    expect(screen.getByText('Превратите слова из Anki в живую речь!')).toBeInTheDocument();
    expect(screen.getByText('Привет! Давай попрактикуемся сегодня? Выбери тему в настройках!')).toBeInTheDocument();
  });

  it('renders landing page with Resume Practice button when there is an active session', async () => {
    // Set active session in localStorage
    const activeSession = {
      id: 'test-session',
      title: 'В ресторане',
      targetWords: [{ word: '猫', translation: 'кошка' }]
    };
    const chatState = {
      messages: [{ id: '1', role: 'model', text: 'こんにちは' }],
      collectedWords: ['猫'],
      isComplete: false
    };

    localStorage.setItem('yomumogu_profile_default_active_session', JSON.stringify(activeSession));
    localStorage.setItem('yomumogu_profile_default_chat_state_test-session', JSON.stringify(chatState));

    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Продолжить: В ресторане')).toBeInTheDocument();
    });

    expect(screen.getByText('Собрано целевых слов: 1 из 1')).toBeInTheDocument();
    expect(screen.getByText('У тебя остался незавершенный диалог! Давай продолжим практику "В ресторане"?')).toBeInTheDocument();
  });

  it('opens and closes profile modal', async () => {
    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Начать практику')).toBeInTheDocument();
    });

    // Click Profile button
    const profileBtns = screen.getAllByRole('button', { name: /Профиль/ });
    fireEvent.click(profileBtns[0]); // Header profile button

    expect(screen.getByText('Профиль и прогресс')).toBeInTheDocument();
    expect(screen.getByText('Уровень: 0')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: '' }); // Lucide X button inside modal
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Профиль и прогресс')).not.toBeInTheDocument();
  });

  it('opens and closes help modal, switches tabs', async () => {
    render(<JapanificationProvider><HomePage /></JapanificationProvider>);

    await waitFor(() => {
      expect(screen.getByText('Начать практику')).toBeInTheDocument();
    });

    // Click Help button
    const helpBtn = screen.getByRole('button', { name: /Справка/ });
    fireEvent.click(helpBtn);

    expect(screen.getByText('Справка YomuMogu')).toBeInTheDocument();
    expect(screen.getByText('Превращение пассивного словаря в активный')).toBeInTheDocument();

    // Switch to Rules tab
    const rulesTabBtn = screen.getByRole('button', { name: /Правила/ });
    fireEvent.click(rulesTabBtn);
    expect(screen.getByText('Использование Cyrillic Placeholders')).toBeInTheDocument();

    // Switch to Japanification tab
    const japTabBtn = screen.getByRole('button', { name: /Погружение/ });
    fireEvent.click(japTabBtn);
    expect(screen.getByText('Система языкового погружения (Immersion)')).toBeInTheDocument();
  });
});

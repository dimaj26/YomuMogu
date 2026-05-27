import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrammarTrack } from '../GrammarTrack';
import { JapanificationProvider } from '../../hooks/useJapanification';

// Мокаем next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-book" />,
  Lock: () => <span data-testid="icon-lock" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
}));

// Прогресс для тестов: первые 2 ступени открыты
const mockProgress = {
  g_n5_s1_1: {
    ruleId: 'g_n5_s1_1',
    profileId: 'default',
    status: 'mature' as const,
    due: Date.now() + 100000,
    stepIndex: 4,
  },
  g_n5_s1_2: {
    ruleId: 'g_n5_s1_2',
    profileId: 'default',
    status: 'learning' as const,
    due: Date.now() - 1000,
    stepIndex: 1,
  },
};

describe('GrammarTrack Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <JapanificationProvider>
        {ui}
      </JapanificationProvider>
    );
  };

  it('renders GrammarTrack and unlocks nodes correctly', () => {
    renderWithProvider(
      <GrammarTrack
        grammarProgress={mockProgress}
        onSelectRule={vi.fn()}
      />
    );

    // Должен отобразить первую ступень (1.1 — именной предикат)
    const node1 = screen.getByTitle('Именной предикат и частицы');
    expect(node1).toBeInTheDocument();
    expect(node1).not.toBeDisabled();

    // Должен отобразить вторую ступень (1.2 — прилагательные, разблокирована)
    const node2 = screen.getByTitle('Морфология прилагательных');
    expect(node2).toBeInTheDocument();
    expect(node2).not.toBeDisabled();
  });

  it('opens popover details on node click', () => {
    renderWithProvider(
      <GrammarTrack
        grammarProgress={mockProgress}
        onSelectRule={vi.fn()}
      />
    );

    // Кликаем по первой ступени (1.1)
    const node = screen.getByTitle('Именной предикат и частицы');
    fireEvent.click(node);

    // Поповер должен открыться — ищем текст объяснения
    expect(screen.getByText(/базовая формула японского предложения/)).toBeInTheDocument();
  });

  it('блокирует ступень 1.2 если 1.1 не начата', () => {
    // Прогресс без ступени 1.1
    renderWithProvider(
      <GrammarTrack
        grammarProgress={{}}
        onSelectRule={vi.fn()}
      />
    );

    // Ступень 1.1 — разблокирована (нет пререквизита)
    const node1 = screen.getByTitle('Именной предикат и частицы');
    expect(node1).not.toBeDisabled();

    // Ступень 1.2 — заблокирована (1.1 не начата)
    const node2 = screen.getByTitle('Морфология прилагательных');
    expect(node2).toBeDisabled();
  });

  it('блокирует ない-форму (S4) если ます-форма (S3) не начата', () => {
    // Прогресс: 1.1–2 пройдены, 3 начата, но всё ещё «new»
    const progressUpToS3New = {
      g_n5_s1_1: { ruleId: 'g_n5_s1_1', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s1_2: { ruleId: 'g_n5_s1_2', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s2:   { ruleId: 'g_n5_s2',   profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s3:   { ruleId: 'g_n5_s3',   profileId: 'default', status: 'new' as const,    due: 0, stepIndex: 0 },
    };

    renderWithProvider(
      <GrammarTrack
        grammarProgress={progressUpToS3New}
        onSelectRule={vi.fn()}
      />
    );

    // S4 (ない-форма) должна быть заблокирована, т.к. S3 ещё status='new'
    const nodeNai = screen.getByTitle('Отрицательная форма (ない-форма)');
    expect(nodeNai).toBeDisabled();
  });

  it('разблокирует て-форму (S5) после завершения ない-формы (S4)', () => {
    // Прогресс: вся цепь до S4 пройдена
    const progressUpToS4 = {
      g_n5_s1_1: { ruleId: 'g_n5_s1_1', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s1_2: { ruleId: 'g_n5_s1_2', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s2:   { ruleId: 'g_n5_s2',   profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s3:   { ruleId: 'g_n5_s3',   profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s4:   { ruleId: 'g_n5_s4',   profileId: 'default', status: 'learning' as const, due: 0, stepIndex: 1 },
    };

    renderWithProvider(
      <GrammarTrack
        grammarProgress={progressUpToS4}
        onSelectRule={vi.fn()}
      />
    );

    // S5 (て-форма) должна быть разблокирована
    const nodeTe = screen.getByTitle('Морфология て-формы');
    expect(nodeTe).not.toBeDisabled();
  });
});

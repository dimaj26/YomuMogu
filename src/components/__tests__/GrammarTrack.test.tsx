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

  it('разблокирует ない-форму (S4) независимо от ます-формы (S3), если S2 начата', () => {
    // Прогресс: S2 пройдена, но S3 еще «new»
    const progressS2StartedS3New = {
      g_n5_s1_1: { ruleId: 'g_n5_s1_1', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s1_2: { ruleId: 'g_n5_s1_2', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s2:   { ruleId: 'g_n5_s2',   profileId: 'default', status: 'learning' as const, due: 0, stepIndex: 1 },
      g_n5_s3:   { ruleId: 'g_n5_s3',   profileId: 'default', status: 'new' as const,    due: 0, stepIndex: 0 },
    };

    renderWithProvider(
      <GrammarTrack
        grammarProgress={progressS2StartedS3New}
        onSelectRule={vi.fn()}
      />
    );

    // S4 (ない-форма) должна быть разблокирована, т.к. зависит только от S2
    const nodeNai = screen.getByTitle('Отрицательная форма (ない-форма)');
    expect(nodeNai).not.toBeDisabled();
  });

  it('блокирует ない-форму (S4) если S2 не начата', () => {
    // Прогресс: S1_1 начата, но S2 еще нет
    const progressS1Started = {
      g_n5_s1_1: { ruleId: 'g_n5_s1_1', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
    };

    renderWithProvider(
      <GrammarTrack
        grammarProgress={progressS1Started}
        onSelectRule={vi.fn()}
      />
    );

    // S4 (ない-форма) должна быть заблокирована, т.к. S2 не начата
    const nodeNai = screen.getByTitle('Отрицательная форма (ない-форма)');
    expect(nodeNai).toBeDisabled();
  });

  it('разблокирует て-форму (S5) независимо от S4, если S2 начата', () => {
    // Прогресс: S2 начата, остальные ноды еще 'new'
    const progressS2Started = {
      g_n5_s1_1: { ruleId: 'g_n5_s1_1', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s2:   { ruleId: 'g_n5_s2',   profileId: 'default', status: 'learning' as const, due: 0, stepIndex: 1 },
    };

    renderWithProvider(
      <GrammarTrack
        grammarProgress={progressS2Started}
        onSelectRule={vi.fn()}
      />
    );

    // S5 (て-форма) должна быть разблокирована
    const nodeTe = screen.getByTitle('Морфология て-формы');
    expect(nodeTe).not.toBeDisabled();
  });

  it('отображает s3 и s4 одновременно доступными после старта s2', () => {
    const progressS2Started = {
      g_n5_s1_1: { ruleId: 'g_n5_s1_1', profileId: 'default', status: 'mature' as const, due: 0, stepIndex: 4 },
      g_n5_s2:   { ruleId: 'g_n5_s2',   profileId: 'default', status: 'learning' as const, due: 0, stepIndex: 1 },
    };

    renderWithProvider(
      <GrammarTrack
        grammarProgress={progressS2Started}
        onSelectRule={vi.fn()}
      />
    );

    // S3 и S4 должны быть доступны одновременно
    const nodeS3 = screen.getByTitle('Вежливое спряжение');
    const nodeS4 = screen.getByTitle('Отрицательная форма (ない-форма)');
    
    expect(nodeS3).not.toBeDisabled();
    expect(nodeS4).not.toBeDisabled();
  });

  it('рисует рёбра по prerequisites, а не по линейному порядку', () => {
    const { container } = renderWithProvider(
      <GrammarTrack
        grammarProgress={{}}
        onSelectRule={vi.fn()}
      />
    );

    // В DAG-таблице ровно 14 рёбер:
    // s1_1 -> s1_2
    // s1_1 -> s2
    // s2 -> s3
    // s2 -> s4
    // s2 -> s5
    // s5 -> s6
    // s5 -> s7
    // s7 -> s8
    // s3 -> s9
    // s1_2 -> exam
    // s4 -> exam
    // s6 -> exam
    // s8 -> exam
    // s9 -> exam
    // Каждое ребро отображается в виде dashed-линии в SVG
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBe(14);
  });

  it('после авторинга контента плейсхолдерами остаются g_n5_exam и g_n4_exam', () => {
    const grammarRules = require('../../resources/grammar_rules.json');
    const placeholders = grammarRules.filter((r: any) => r.isPlaceholder);
    expect(placeholders.length).toBe(2);
    expect(placeholders.map((p: any) => p.id)).toContain('g_n5_exam');
    expect(placeholders.map((p: any) => p.id)).toContain('g_n4_exam');
  });

  it('level=N5 (по умолчанию) рендерит только N5-ноды, N4 скрыты', () => {
    renderWithProvider(
      <GrammarTrack
        grammarProgress={mockProgress}
        onSelectRule={vi.fn()}
      />
    );
    expect(screen.getByTitle('Именной предикат и частицы')).toBeInTheDocument();
    expect(screen.queryByTitle('Модификация существительных (относительные придаточные)')).not.toBeInTheDocument();
  });

  it('level=N4 рендерит 6 N4-нод и рисует рёбра только внутри N4-набора', () => {
    const { container } = renderWithProvider(
      <GrammarTrack
        grammarProgress={{}}
        onSelectRule={vi.fn()}
        level="N4"
      />
    );
    expect(screen.getByTitle('Модификация существительных (относительные придаточные)')).toBeInTheDocument();
    expect(screen.queryByTitle('Именной предикат и частицы')).not.toBeInTheDocument();

    // N4 рёбра:
    // s1 -> exam
    // s2 -> exam
    // s3 -> exam
    // s4 -> exam
    // s5 -> exam
    // Итого 5 рёбер
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBe(5);
  });

  it('N4-нода заблокирована пока её N5-пререквизит не mature, и разблокируется когда mature', () => {
    // 1. Провайдим пустой прогресс (N5 пререквизит g_n5_s7 не пройден/новый)
    const { rerender } = renderWithProvider(
      <GrammarTrack
        grammarProgress={{}}
        onSelectRule={vi.fn()}
        level="N4"
      />
    );
    const node = screen.getByTitle('Модификация существительных (относительные придаточные)');
    expect(node).toBeDisabled();

    // 2. g_n5_s7 начат (learning)
    const learningProgress = {
      g_n5_s7: { ruleId: 'g_n5_s7', profileId: 'default', status: 'learning' as const, due: 0, stepIndex: 1 }
    };
    rerender(
      <JapanificationProvider>
        <GrammarTrack
          grammarProgress={learningProgress}
          onSelectRule={vi.fn()}
          level="N4"
        />
      </JapanificationProvider>
    );
    const nodeUnlocked = screen.getByTitle('Модификация существительных (относительные придаточные)');
    expect(nodeUnlocked).not.toBeDisabled();
  });
});


import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GrammarTrainer } from '../GrammarTrainer';

// Мокаем глобальный fetch для проверки ИИ
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Loader2: () => <span data-testid="icon-loader" />,
  Play: () => <span data-testid="icon-play" />,
  Volume2: () => <span data-testid="icon-volume" />,
  HelpCircle: () => <span data-testid="icon-help" />,
}));

describe('GrammarTrainer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rule g_n5_s1_1 and shows cards and default content', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s1_1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Должен отобразить тему и конструкцию
    expect(screen.getByText('Именной предикат и частицы')).toBeInTheDocument();
    expect(screen.getByText('AはBです')).toBeInTheDocument();

    // Должен отобразить карточки предложения в песочнице
    expect(screen.getByText('私 (わたし)', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('は', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('学生 (がくせい)', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('です', { selector: 'span' })).toBeInTheDocument();
  });

  it('updates card text when switching Tone and Polarity', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s1_1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Исходно: вежливо утвердительно (です)
    expect(screen.getByText('です', { selector: 'span' })).toBeInTheDocument();

    // Кликаем «Дружески»
    const plainBtn = screen.getByRole('button', { name: 'Дружески' });
    fireEvent.click(plainBtn);

    // Должно поменяться на «だ» (Plain affirmative) и «俺 (оре)» (Plain subject)
    expect(screen.getByText('だ', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('俺 (おれ)', { selector: 'span' })).toBeInTheDocument();

    // Кликаем «Отрицание (-)»
    const negBtn = screen.getByRole('button', { name: 'Отрицание (-)' });
    fireEvent.click(negBtn);

    // Должно поменяться на «じゃない» (Plain negative)
    expect(screen.getByText('じゃない', { selector: 'span' })).toBeInTheDocument();
  });

  it('toggles tabs correctly', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s1_1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Переключаем на вкладку «Секреты устной речи»
    const secretsTab = screen.getByRole('button', { name: 'Секреты устной речи' });
    fireEvent.click(secretsTab);

    // Должен появиться текст разговорных секретов
    expect(screen.getByText(/Секреты устного языка/)).toBeInTheDocument();
    expect(screen.getByText(/частицу は/i)).toBeInTheDocument();

    // Переключаем на вкладку «ИИ-Проверка»
    const verifyTab = screen.getByRole('button', { name: 'ИИ-Проверка' });
    fireEvent.click(verifyTab);

    // Должно отобразиться поле ввода и кнопка проверки
    expect(screen.getByLabelText(/Напишите собственное предложение на японском/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Пример: 私は学生です。')).toBeInTheDocument();
  });

  it('clicking card opens its explanation tooltip', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s1_1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Кликаем по кнопке «は» (карточка с подсказкой)
    const particleCard = screen.getByRole('button', { name: /は/ });
    fireEvent.click(particleCard);

    // Должен отобразиться поповер с подсказкой
    expect(screen.getAllByText('Частица (Тема)')[0]).toBeInTheDocument();
    expect(screen.getByText(/Частица темы は/)).toBeInTheDocument();
  });

  it('fills inputs on suggestion click', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s1_1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Находим кнопку "Использовать" в примерах
    const useBtns = screen.getAllByRole('button', { name: 'Использовать' });
    expect(useBtns.length).toBeGreaterThan(0);

    // Кликаем по первой кнопке (Сказать, что студент)
    fireEvent.click(useBtns[0]);

    // Должен автоматически переключить вкладку на «ИИ-Проверка» и заполнить поле
    const input = screen.getByLabelText(/Напишите собственное предложение на японском/) as HTMLInputElement;
    expect(input.value).toBe('私は学生です。');
  });

  it('submits verify form and renders AI feedback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        isCorrect: true,
        correction: '',
        explanation: 'Отличная работа!'
      })
    });

    render(
      <GrammarTrainer
        ruleId="g_n5_s1_1"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Идем во вкладку проверки
    const verifyTab = screen.getByRole('button', { name: 'ИИ-Проверка' });
    fireEvent.click(verifyTab);

    const input = screen.getByLabelText(/Напишите собственное предложение на японском/);
    fireEvent.change(input, { target: { value: '私は学生です。' } });

    const submitBtn = screen.getByRole('button', { name: 'Проверить' });
    fireEvent.click(submitBtn);

    // Должна появиться надпись о проверке
    expect(submitBtn).toBeDisabled();

    // Ждем завершения проверки
    await waitFor(() => {
      expect(screen.getByText('Правильно!')).toBeInTheDocument();
      expect(screen.getByText('Начать диалог с ИИ')).toBeInTheDocument();
    });
  });

  it('renders other rules like g_n5_s2 (Verb groups) with custom labels without crash', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s2"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Должен отобразить тему классификации глаголов
    expect(screen.getByText('Классификация глаголов')).toBeInTheDocument();
    expect(screen.getByText('動詞の分類')).toBeInTheDocument();

    // Должен отобразить новые ярлыки выбора глаголов
    expect(screen.getByText('Выбор глагола:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 группа (Godan)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 группа (Ichidan)' })).toBeInTheDocument();

    // Должен отобразить ярлыки формы
    expect(screen.getByText('Форма:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Словарная форма' })).toBeInTheDocument();

    // Карточки глаголов
    expect(screen.getByText('読む')).toBeInTheDocument();
    expect(screen.getByText('む')).toBeInTheDocument();
    expect(screen.getByText('1 группа (五段)')).toBeInTheDocument();
  });

  it('renders rule g_n5_s6 (te-constructions) with custom styles and labels', () => {
    render(
      <GrammarTrainer
        ruleId="g_n5_s6"
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Проверяем кастомный ярлык «Конструкция:» и «Стиль:»
    expect(screen.getByText('Конструкция:')).toBeInTheDocument();
    expect(screen.getByText('Стиль:')).toBeInTheDocument();

    // Кнопки
    expect(screen.getByRole('button', { name: 'Просьба (てください)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Процесс (ている)' })).toBeInTheDocument();

    // Карточки
    expect(screen.getByText('読んで')).toBeInTheDocument();
    expect(screen.getByText('ください')).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScienceTip } from '../ScienceTip';

// Мокаем lucide-react
vi.mock('lucide-react', () => ({
  Info: () => <span data-testid="icon-info">ⓘ</span>,
}));

describe('ScienceTip Component', () => {
  it('неизвестный id ничего не рендерит', () => {
    const { container } = render(<ScienceTip tipId="unknown_tip_id" />);
    expect(container.firstChild).toBeNull();
  });

  it('клик раскрывает body и строку Исследование', () => {
    render(<ScienceTip tipId="furigana" />);

    // Сначала поповер скрыт
    expect(screen.queryByText('Угасание фуриганы')).not.toBeInTheDocument();

    // Находим кнопку триггера и кликаем
    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();
    
    fireEvent.click(trigger);

    // Теперь заголовок, текст и строка исследования отображаются
    expect(screen.getByText('Угасание фуриганы')).toBeInTheDocument();
    expect(screen.getByText(/Распознавание иероглифов слабеет/)).toBeInTheDocument();
    expect(screen.getByText(/Исследование: эффект генерации; TOPRA, Barcroft/)).toBeInTheDocument();

    // Кликаем еще раз для закрытия
    fireEvent.click(trigger);
    expect(screen.queryByText('Угасание фуриганы')).not.toBeInTheDocument();
  });
});

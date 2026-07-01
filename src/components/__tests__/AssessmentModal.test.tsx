import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssessmentModal } from '../AssessmentModal';
import { LOCAL_DECK_NAME } from '@/core/localDeckService';

// In-memory замена таблицы words: сохранение колоды идёт через importStarterDeck
// (bulkPut ~500 слов) в fake-indexeddb — под параллельной нагрузкой vitest это
// разбухает за таймаут (015, та же природа, что чинили в home-grid/014).
// Мок покрывает ровно тот Dexie-чейн, что реально используется этими путями:
// where(field).equals(value) -> {toArray, count, filter(pred) -> {toArray, count}}.
// vi.hoisted нужен, т.к. vi.mock хойстится над обычными объявлениями.
const { mockWordsTable } = vi.hoisted(() => {
  let store: any[] = [];

  function makeChain(rows: any[]) {
    return {
      toArray: async () => rows,
      count: async () => rows.length,
      filter: (pred: (row: any) => boolean) => {
        const f = rows.filter(pred);
        return { toArray: async () => f, count: async () => f.length };
      },
    };
  }

  return {
    mockWordsTable: {
      bulkPut: async (rows: any[]) => { store.push(...rows); },
      put: async (row: any) => { store.push(row); },
      clear: async () => { store = []; },
      where: (field: string) => ({
        equals: (value: unknown) => makeChain(store.filter(r => r[field] === value)),
      }),
    },
  };
});

vi.mock('@/core/db', () => ({ db: { words: mockWordsTable } }));

const db = { words: mockWordsTable };

describe('AssessmentModal', () => {
  beforeEach(async () => {
    await db.words.clear();
  });

  it('isOpen=false: ничего не рендерит', () => {
    const { container } = render(
      <AssessmentModal isOpen={false} profileId="default" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('сохранение импортирует стартовую колоду в БД и вызывает onSaved', async () => {
    const onSaved = vi.fn();
    render(
      <AssessmentModal isOpen profileId="default" onClose={vi.fn()} onSaved={onSaved} />
    );

    const saveBtn = await screen.findByRole('button', { name: 'Сохранить и начать' });
    // Кнопка активна после ленивой загрузки стартовой колоды
    await waitFor(() => expect(saveBtn).not.toBeDisabled(), { timeout: 5000 });

    fireEvent.click(saveBtn);

    await waitFor(() => expect(onSaved).toHaveBeenCalled(), { timeout: 5000 });

    // Слова локальной колоды появились в IndexedDB
    const count = await db.words
      .where('profileId')
      .equals('default')
      .filter(w => w.category === LOCAL_DECK_NAME)
      .count();
    expect(count).toBeGreaterThan(0);
  });

  it('«Я начинаю с нуля»: засевает колоду со всеми словами new и вызывает onSaved (C-11)', async () => {
    const onSaved = vi.fn();
    render(
      <AssessmentModal isOpen profileId="default" onClose={vi.fn()} onSaved={onSaved} />
    );

    const freshBtn = await screen.findByRole('button', { name: 'Я начинаю с нуля' });
    await waitFor(() => expect(freshBtn).not.toBeDisabled(), { timeout: 5000 });

    fireEvent.click(freshBtn);

    await waitFor(() => expect(onSaved).toHaveBeenCalled(), { timeout: 5000 });

    const localWords = await db.words
      .where('profileId')
      .equals('default')
      .filter(w => w.category === LOCAL_DECK_NAME)
      .toArray();
    expect(localWords.length).toBeGreaterThan(0);
    // Экспресс-старт «с нуля» -> ни одно слово не отмечено как известное
    expect(localWords.every(w => w.active.status === 'new')).toBe(true);
  });
});

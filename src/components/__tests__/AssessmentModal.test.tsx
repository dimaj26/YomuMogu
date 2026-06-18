import React from 'react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';

// Полифилл IndexedDB до загрузки Dexie
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssessmentModal } from '../AssessmentModal';
import { db } from '@/core/db';
import { LOCAL_DECK_NAME } from '@/core/localDeckService';

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
    await waitFor(() => expect(saveBtn).not.toBeDisabled(), { timeout: 8000 });

    fireEvent.click(saveBtn);

    await waitFor(() => expect(onSaved).toHaveBeenCalled(), { timeout: 8000 });

    // Слова локальной колоды появились в IndexedDB
    const count = await db.words
      .where('profileId')
      .equals('default')
      .filter(w => w.category === LOCAL_DECK_NAME)
      .count();
    expect(count).toBeGreaterThan(0);
  });
});

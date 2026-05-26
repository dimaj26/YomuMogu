import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
import { JpUI } from '../JpUI';
import { JapanificationProvider } from '../../hooks/useJapanification';
import { JpUIProvider } from '../JpUIProvider';
import { db } from '../../core/db';

// Полифилл для IndexedDB в тестах
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

describe('JpUI Component FSRS Opacity', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.ui_words.clear();
  });

  const renderJpUI = (id: string, ru: string, ja: string, reading?: string) => {
    return render(
      <JapanificationProvider>
        <JpUIProvider>
          <JpUI id={id} ru={ru} ja={ja} reading={reading} />
        </JpUIProvider>
      </JapanificationProvider>
    );
  };

  it('renders furigana with full opacity class for learning words (interval < 3)', async () => {
    await db.ui_words.put({
      profileId: 'default',
      id: 'test_word_1',
      word: '犬',
      reading: 'いぬ',
      translation: 'собака',
      status: 'learning',
      stability: 1.0,
      difficulty: 5.0,
      interval: 1, // < 3 days
      due: Date.now(),
      reps: 1,
      lapses: 0
    });

    renderJpUI('test_word_1', 'собака', '犬', 'いぬ');

    await waitFor(() => {
      expect(screen.getByText('犬')).toBeInTheDocument();
    });

    const rtElement = document.querySelector('rt');
    expect(rtElement).toBeInTheDocument();
    expect(rtElement?.className).toContain('furiganaFull');
  });

  it('renders furigana with review opacity class for review words (3 <= interval < 21)', async () => {
    await db.ui_words.put({
      profileId: 'default',
      id: 'test_word_2',
      word: '猫',
      reading: 'ねこ',
      translation: 'кошка',
      status: 'review',
      stability: 10.0,
      difficulty: 4.0,
      interval: 10, // 3 <= interval < 21
      due: Date.now(),
      reps: 3,
      lapses: 0
    });

    renderJpUI('test_word_2', 'кошка', '猫', 'ねこ');

    await waitFor(() => {
      expect(screen.getByText('猫')).toBeInTheDocument();
    });

    const rtElement = document.querySelector('rt');
    expect(rtElement).toBeInTheDocument();
    expect(rtElement?.className).toContain('furiganaReview');
  });

  it('renders furigana with mature opacity class for mature words (interval >= 21)', async () => {
    await db.ui_words.put({
      profileId: 'default',
      id: 'test_word_3',
      word: '鳥',
      reading: 'とり',
      translation: 'птица',
      status: 'mature',
      stability: 30.0,
      difficulty: 3.0,
      interval: 25, // >= 21 days
      due: Date.now(),
      reps: 5,
      lapses: 0
    });

    renderJpUI('test_word_3', 'птица', '鳥', 'とり');

    await waitFor(() => {
      expect(screen.getByText('鳥')).toBeInTheDocument();
    });

    const rtElement = document.querySelector('rt');
    expect(rtElement).toBeInTheDocument();
    expect(rtElement?.className).toContain('furiganaMature');
  });
});

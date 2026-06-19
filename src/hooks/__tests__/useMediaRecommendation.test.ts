import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb';
globalThis.indexedDB = fakeIndexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMediaRecommendation } from '../useMediaRecommendation';
import { db } from '@/core/db';
import { getProfileItem, setProfileItem } from '@/lib/profile';

vi.mock('@/lib/profile', () => {
  const store: Record<string, string> = {};
  return {
    getActiveProfileId: () => 'test-profile',
    getProfileItem: vi.fn((key: string) => store[key] || null),
    setProfileItem: vi.fn((key: string, val: string) => {
      store[key] = val;
    }),
  };
});

describe('useMediaRecommendation hook', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    
    // Очищаем IndexedDB перед каждым тестом
    await db.words.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should load default feed and calculate 0% comprehension when database is empty', async () => {
    const { result } = renderHook(() => useMediaRecommendation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recommendations.length).toBeGreaterThan(0);
    // Проверяем, что для первого видео с леммами процент понимания равен 0, так как бд пуста
    const firstRec = result.current.recommendations[0];
    expect(firstRec.comprehensionRate).toBe(0);
    expect(firstRec.knownCount).toBe(0);
  });

  it('should calculate correct comprehension rate based on IndexedDB word states', async () => {
    // Вставляем 2 слова из лемм первого дефолтного видео ("友達", "電話")
    // Одно слово активно-известно, другое пассивно-известно (due в будущем)
    await db.words.bulkPut([
      {
        profileId: 'test-profile',
        id: 1,
        word: '友達',
        reading: 'ともだち',
        translation: 'друг',
        category: 'Japanese',
        source: 'manual',
        active: { stability: 10, difficulty: 5.0, interval: 10, due: Date.now() + 50000, reps: 3, lapses: 0, status: 'review' } // Активно-известно (interval >= 7)
      },
      {
        profileId: 'test-profile',
        id: 2,
        word: '電話',
        reading: 'でんわ',
        translation: 'телефон',
        category: 'Japanese',
        source: 'manual',
        // §2.6: было «пассивно-известно» (passive.due в будущем) — теперь passive не считается, слово НЕ известно
        active: { stability: 0, difficulty: 0, interval: 0, due: Date.now() - 1000, reps: 0, lapses: 0, status: 'new' }
      }
    ]);

    const { result } = renderHook(() => useMediaRecommendation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstRec = result.current.recommendations.find(r => r.id === 'yt_1');
    expect(firstRec).toBeDefined();
    // В первом видео 20 лемм. Известно только активно-известное 友達 (passive не считается). 1 / 20 = 5%.
    expect(firstRec?.knownCount).toBe(1);
    expect(firstRec?.comprehensionRate).toBe(5);
  });

  it('should calculate FSRS due overlap count correctly', async () => {
    // Вставляем слово "友達" как просроченное для повторения (active.due <= now)
    await db.words.put({
      profileId: 'test-profile',
      id: 1,
      word: '友達',
      reading: 'ともだち',
      translation: 'друг',
      category: 'Japanese',
      source: 'manual',
      active: { stability: 2, difficulty: 5.0, interval: 2, due: Date.now() - 1000, reps: 3, lapses: 1, status: 'review' } // Due <= now
    });

    const { result } = renderHook(() => useMediaRecommendation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstRec = result.current.recommendations.find(r => r.id === 'yt_1');
    expect(firstRec?.dueOverlapCount).toBe(1); // Совпало 1 из просроченных слов
  });

  it('should support adding custom YouTube URL and saving it to profile storage', async () => {
    const mockLemmas = ['日本', '行く'];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lemmas: mockLemmas }),
    });

    const { result } = renderHook(() => useMediaRecommendation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let addedItem: any = null;
    await act(async () => {
      addedItem = await result.current.addCustomUrl('https://www.youtube.com/watch?v=customVideoId');
    });

    expect(addedItem).not.toBeNull();
    expect(addedItem.lemmas).toEqual(mockLemmas);
    expect(setProfileItem).toHaveBeenCalled();
    
    // Новое видео должно появиться в списке рекомендаций на первом месте
    await waitFor(() => {
      const customVideoInList = result.current.recommendations[0];
      expect(customVideoInList.id).toContain('custom_');
      expect(customVideoInList.lemmas).toEqual(mockLemmas);
    });
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuests } from '../useQuests';

// Мокаем useJapanification
const mockAddPoints = vi.fn();
vi.mock('../useJapanification', () => ({
  useJapanification: () => ({
    addPoints: mockAddPoints
  })
}));

// Мокаем localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Вспомогательный хелпер для мокания времени
const mockDate = (hours: number, minutes: number) => {
  const baseTime = new Date('2026-05-27T00:00:00Z');
  baseTime.setUTCHours(hours, minutes, 0, 0);
  vi.setSystemTime(baseTime);
};

describe('useQuests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('хук не экспортирует claimQuestReward', () => {
    const { result } = renderHook(() => useQuests());
    // @ts-expect-error Проверяем отсутствие метода в типах и рантайме
    expect(result.current.claimQuestReward).toBeUndefined();
  });

  it('завершение квеста не начисляет XP', () => {
    mockDate(10, 0);
    const { result } = renderHook(() => useQuests());

    act(() => {
      result.current.incrementQuestProgress('mnemonics', 2);
    });

    const mnemonics = result.current.quests.find(q => q.type === 'mnemonics');
    expect(mnemonics?.completed).toBe(true);
    expect(mockAddPoints).not.toHaveBeenCalled();
  });

  it('легаси-данные с claimed: true парсятся без ошибок', () => {
    mockDate(10, 0);
    const { result } = renderHook(() => useQuests());
    const dateKey = result.current.todayKey;
    const storageKey = `yomumogu_profile_default_daily_quests_${dateKey}`;
    const legacyData = [
      {
        id: 'reviews_quest',
        type: 'reviews',
        title: 'Охота на долги',
        description: 'Пройти 10 FSRS-повторений в квизе',
        target: 10,
        current: 10,
        rewardXp: 3,
        completed: true,
        claimed: true,
      }
    ];
    localStorageMock.setItem(storageKey, JSON.stringify(legacyData));

    act(() => {
      result.current.refreshQuests();
    });

    expect(result.current.quests.length).toBe(1);
    expect(result.current.quests[0].claimed).toBe(true);
  });

  it('прогресс и completed работают как раньше', () => {
    mockDate(10, 0);
    const { result } = renderHook(() => useQuests());

    const reviewsBefore = result.current.quests.find(q => q.type === 'reviews');
    expect(reviewsBefore?.current).toBe(0);
    expect(reviewsBefore?.completed).toBe(false);

    act(() => {
      result.current.incrementQuestProgress('reviews', 5);
    });

    const reviewsMiddle = result.current.quests.find(q => q.type === 'reviews');
    expect(reviewsMiddle?.current).toBe(5);
    expect(reviewsMiddle?.completed).toBe(false);

    act(() => {
      result.current.incrementQuestProgress('reviews', 5);
    });

    const reviewsAfter = result.current.quests.find(q => q.type === 'reviews');
    expect(reviewsAfter?.current).toBe(10);
    expect(reviewsAfter?.completed).toBe(true);
  });
});

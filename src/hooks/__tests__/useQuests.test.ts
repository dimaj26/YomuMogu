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

  it('should initialize daily quests with defaults if not exists', () => {
    mockDate(10, 0); // 10:00 UTC (14:00+ local standard)
    const { result } = renderHook(() => useQuests());

    expect(result.current.loading).toBe(false);
    expect(result.current.quests.length).toBe(3);
    
    const reviews = result.current.quests.find(q => q.type === 'reviews');
    expect(reviews).toBeDefined();
    expect(reviews?.target).toBe(10);
    expect(reviews?.current).toBe(0);
    expect(reviews?.completed).toBe(false);
  });

  it('should increment quest progress correctly', () => {
    mockDate(10, 0);
    const { result } = renderHook(() => useQuests());

    act(() => {
      result.current.incrementQuestProgress('reviews', 3);
    });

    const reviews = result.current.quests.find(q => q.type === 'reviews');
    expect(reviews?.current).toBe(3);
    expect(reviews?.completed).toBe(false);

    act(() => {
      result.current.incrementQuestProgress('reviews', 7);
    });

    const completedReviews = result.current.quests.find(q => q.type === 'reviews');
    expect(completedReviews?.current).toBe(10);
    expect(completedReviews?.completed).toBe(true);
  });

  it('should claim quest reward and add XP points', () => {
    mockDate(10, 0);
    const { result } = renderHook(() => useQuests());

    // Инкрементируем до завершения квеста
    act(() => {
      result.current.incrementQuestProgress('mnemonics', 2);
    });

    const mnemonics = result.current.quests.find(q => q.type === 'mnemonics');
    expect(mnemonics?.completed).toBe(true);
    expect(mnemonics?.claimed).toBe(false);

    // Забираем награду
    let claimResult = false;
    act(() => {
      claimResult = result.current.claimQuestReward('mnemonics_quest');
    });

    expect(claimResult).toBe(true);
    expect(mockAddPoints).toHaveBeenCalledWith(2); // XP reward = 2

    const claimedMnemonics = result.current.quests.find(q => q.type === 'mnemonics');
    expect(claimedMnemonics?.claimed).toBe(true);
  });

  it('should respect 4:00 AM local time boundary for daily resets', () => {
    // 03:00 AM local (UTC + 6 = 21:00 UTC previous day)
    const timeBeforeBoundary = new Date('2026-05-27T03:00:00+06:00');
    vi.setSystemTime(timeBeforeBoundary);

    const { result: resultBefore, rerender } = renderHook(() => useQuests());
    
    // Делаем прогресс
    act(() => {
      resultBefore.current.incrementQuestProgress('chats', 1);
    });
    
    const chatsBefore = resultBefore.current.quests.find(q => q.type === 'chats');
    expect(chatsBefore?.completed).toBe(true);

    // Сдвигаем время на 04:05 AM local (UTC + 6 = 22:05 UTC)
    const timeAfterBoundary = new Date('2026-05-27T04:05:00+06:00');
    vi.setSystemTime(timeAfterBoundary);

    // Перезапускаем хук для имитации загрузки нового дня
    const { result: resultAfter } = renderHook(() => useQuests());

    // Квесты должны обнулиться
    const chatsAfter = resultAfter.current.quests.find(q => q.type === 'chats');
    expect(chatsAfter?.current).toBe(0);
    expect(chatsAfter?.completed).toBe(false);
  });
});

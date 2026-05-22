import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJapanification } from '../useJapanification';

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

describe('useJapanification', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useJapanification());
    expect(result.current.state.level).toBe(0);
    expect(result.current.state.percentage).toBe(0);
    expect(result.current.state.speed).toBe('normal');
    expect(result.current.state.points).toBe(0);
  });

  it('should return Russian text at level 0', () => {
    const { result } = renderHook(() => useJapanification());
    expect(result.current.t('Отправить', '送信')).toBe('Отправить');
  });

  it('should show translation by default at level 0', () => {
    const { result } = renderHook(() => useJapanification());
    expect(result.current.shouldShowTranslation()).toBe(true);
  });

  it('should add points and persist to localStorage', () => {
    const { result } = renderHook(() => useJapanification());
    
    act(() => {
      result.current.addPoints(10);
    });

    expect(result.current.state.points).toBe(10);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should track word usage', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.trackWordUsed(3);
    });

    expect(result.current.state.totalWordsUsed).toBe(3);
    expect(result.current.state.points).toBe(3);
  });

  it('should complete session and add bonus points', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.completeSession();
    });

    expect(result.current.state.sessionsCompleted).toBe(1);
    expect(result.current.state.points).toBe(5);
  });

  it('should level up after reaching threshold', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.addPoints(20); // normal speed, level 1 threshold = 20
    });

    expect(result.current.state.level).toBe(1);
  });

  it('should change speed and recalculate level', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.addPoints(15);
    });

    // При normal speed 15 очков = уровень 0
    expect(result.current.state.level).toBe(0);

    act(() => {
      result.current.setSpeed('fast');
    });

    // При fast speed 15 очков = уровень 1 (порог = 10)
    expect(result.current.state.level).toBe(1);
  });

  it('should reset progress', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.addPoints(50);
      result.current.completeSession();
    });

    expect(result.current.state.points).toBe(55);

    act(() => {
      result.current.resetProgress();
    });

    expect(result.current.state.points).toBe(0);
    expect(result.current.state.level).toBe(0);
    expect(result.current.state.sessionsCompleted).toBe(0);
  });

  it('should toggle always show translations', () => {
    const { result } = renderHook(() => useJapanification());

    expect(result.current.state.showTranslationsAlways).toBe(false);

    act(() => {
      result.current.toggleAlwaysShowTranslations();
    });

    expect(result.current.state.showTranslationsAlways).toBe(true);
  });

  it('should return Japanese text at high levels', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.addPoints(100); // level 3 at normal speed
    });

    expect(result.current.state.level).toBeGreaterThanOrEqual(2);
    expect(result.current.t('Отправить', '送信')).toBe('送信');
  });

  it('should initialize chatLevel to 1', () => {
    const { result } = renderHook(() => useJapanification());
    expect(result.current.state.chatLevel).toBe(1);
  });

  it('should change chatLevel and persist to localStorage', () => {
    const { result } = renderHook(() => useJapanification());

    act(() => {
      result.current.setChatLevel(3);
    });

    expect(result.current.state.chatLevel).toBe(3);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

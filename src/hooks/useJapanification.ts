'use client';

import { useState, useEffect, useCallback } from 'react';

import { getProfileItem, setProfileItem } from '../lib/profile';

export type UiMode = 'ru' | 'smart' | 'ja';

export interface JapanificationState {
  uiMode: UiMode;
  points: number;           // Накопленные очки (XP)
  totalWordsUsed: number;
  sessionsCompleted: number;
  showTranslationsAlways: boolean;
  chatLevel: number;        // Сложность японского языка в чате (1-5)
  level: number;            // Виртуальный уровень японизации
  percentage: number;       // Виртуальный процент прогресса уровня
  speed: 'slow' | 'normal' | 'fast'; // Виртуальная скорость
}

const STORAGE_KEY = 'japanification';

const DEFAULT_STATE: Omit<JapanificationState, 'level' | 'percentage' | 'speed'> = {
  uiMode: 'smart',
  points: 0,
  totalWordsUsed: 0,
  sessionsCompleted: 0,
  showTranslationsAlways: false,
  chatLevel: 1,
};

export function useJapanification() {
  const [state, setState] = useState<Omit<JapanificationState, 'level' | 'percentage' | 'speed'>>(DEFAULT_STATE);

  // Загружаем состояние из localStorage при монтировании с миграцией данных
  useEffect(() => {
    try {
      const saved = getProfileItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Миграция со старого формата уровней
        let uiMode: UiMode = 'smart';
        if (parsed.uiMode) {
          uiMode = parsed.uiMode;
        } else if (typeof parsed.level === 'number') {
          if (parsed.level >= 6) uiMode = 'ja';
          else if (parsed.level >= 2) uiMode = 'smart';
          else uiMode = 'ru';
        }
        
        setState({
          uiMode,
          points: parsed.points ?? 0,
          totalWordsUsed: parsed.totalWordsUsed ?? 0,
          sessionsCompleted: parsed.sessionsCompleted ?? 0,
          showTranslationsAlways: parsed.showTranslationsAlways ?? false,
          chatLevel: parsed.chatLevel ?? 1,
        });
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }, []);

  const persistState = useCallback((newState: Omit<JapanificationState, 'level' | 'percentage' | 'speed'>) => {
    setState(newState);
    try {
      setProfileItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // localStorage может быть недоступен
    }
  }, []);

  // Вычисляем виртуальные поля на лету
  const thresholds = [0, 20, 50, 100, 170, 280, 420];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (state.points >= thresholds[i]) {
      level = i;
    }
  }

  /**
   * Функция перевода для простых строк.
   * Если режим 'ja' — переводит. 
   * Если режим 'ru' — не переводит.
   * Если режим 'smart' — переводит, если виртуальный уровень японизации >= levelRequired.
   */
  const t = useCallback((ruText: string, jaText: string, levelRequired: number = 6): string => {
    if (state.uiMode === 'ja') return jaText;
    if (state.uiMode === 'ru') return ruText;
    return level >= levelRequired ? jaText : ruText;
  }, [state.uiMode, level]);

  const shouldShowTranslation = useCallback((): boolean => {
    if (state.showTranslationsAlways) return true;
    if (state.uiMode === 'ja') return false;
    if (state.uiMode === 'ru') return true;
    return level < 1;
  }, [state.uiMode, state.showTranslationsAlways, level]);

  const shouldGrammarBeJapanese = useCallback((): boolean => {
    if (state.uiMode === 'ja') return true;
    if (state.uiMode === 'ru') return false;
    return level >= 5;
  }, [state.uiMode, level]);

  const shouldHintsBeJapanese = useCallback((): boolean => {
    if (state.uiMode === 'ja') return true;
    if (state.uiMode === 'ru') return false;
    return level >= 4;
  }, [state.uiMode, level]);

  const addPoints = useCallback((n: number) => {
    setState(prev => {
      const newState = { ...prev, points: prev.points + n };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  const trackWordUsed = useCallback((count: number = 1) => {
    setState(prev => {
      const newState = {
        ...prev,
        totalWordsUsed: prev.totalWordsUsed + count,
        points: prev.points + count
      };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  const completeSession = useCallback(() => {
    setState(prev => {
      const newState = {
        ...prev,
        sessionsCompleted: prev.sessionsCompleted + 1,
        points: prev.points + 5
      };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  const setUiMode = useCallback((uiMode: UiMode) => {
    setState(prev => {
      const newState = { ...prev, uiMode };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  const toggleAlwaysShowTranslations = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, showTranslationsAlways: !prev.showTranslationsAlways };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  const setChatLevel = useCallback((chatLevel: number) => {
    setState(prev => {
      const newState = { ...prev, chatLevel };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  const resetProgress = useCallback(() => {
    persistState(DEFAULT_STATE);
  }, [persistState]);

  let percentage = 0;
  if (level >= 6) {
    percentage = 100;
  } else {
    const current = thresholds[level];
    const next = thresholds[level + 1];
    const progress = state.points - current;
    const total = next - current;
    percentage = Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
  }

  const stateWithDerived: JapanificationState = {
    ...state,
    level,
    percentage,
    speed: 'normal',
  };

  return {
    state: stateWithDerived,
    t,
    shouldShowTranslation,
    shouldGrammarBeJapanese,
    shouldHintsBeJapanese,
    addPoints,
    trackWordUsed,
    completeSession,
    setUiMode,
    setChatLevel,
    toggleAlwaysShowTranslations,
    resetProgress,
  };
}

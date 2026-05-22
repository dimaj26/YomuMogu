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

  /**
   * Функция перевода для простых строк.
   * Если режим 'ja' — переводит. В остальных режимах ('ru', 'smart') — возвращает русский текст.
   */
  const t = useCallback((ruText: string, jaText: string): string => {
    return state.uiMode === 'ja' ? jaText : ruText;
  }, [state.uiMode]);

  const shouldShowTranslation = useCallback((): boolean => {
    if (state.showTranslationsAlways) return true;
    return state.uiMode !== 'ja';
  }, [state.uiMode, state.showTranslationsAlways]);

  const shouldGrammarBeJapanese = useCallback((): boolean => {
    return state.uiMode === 'ja';
  }, [state.uiMode]);

  const shouldHintsBeJapanese = useCallback((): boolean => {
    return state.uiMode === 'ja';
  }, [state.uiMode]);

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

  // Вычисляем виртуальные поля на лету
  const thresholds = [0, 20, 50, 100, 170, 280, 420];
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (state.points >= thresholds[i]) {
      level = i;
    }
  }

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

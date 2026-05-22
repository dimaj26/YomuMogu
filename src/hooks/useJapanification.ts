'use client';

import { useState, useEffect, useCallback } from 'react';

import { getProfileItem, setProfileItem } from '../lib/profile';

// Пороги очков для каждого уровня в зависимости от скорости
const THRESHOLDS: Record<JapanificationSpeed, number[]> = {
  slow:   [0, 30, 80, 150, 250, 400, 600],
  normal: [0, 20, 50, 100, 170, 280, 420],
  fast:   [0, 10, 25,  50,  85, 140, 210],
};

export type JapanificationSpeed = 'slow' | 'normal' | 'fast';

export interface JapanificationState {
  level: number;            // 0–6
  percentage: number;       // 0–100
  speed: JapanificationSpeed;
  points: number;           // Накопленные очки
  totalWordsUsed: number;
  sessionsCompleted: number;
  showTranslationsAlways: boolean; // Ручной переключатель для комфорта
  chatLevel: number;        // Сложность японского языка в чате (1-5)
}

const STORAGE_KEY = 'japanification';

const DEFAULT_STATE: JapanificationState = {
  level: 0,
  percentage: 0,
  speed: 'normal',
  points: 0,
  totalWordsUsed: 0,
  sessionsCompleted: 0,
  showTranslationsAlways: false,
  chatLevel: 1,
};

function calculateLevel(points: number, speed: JapanificationSpeed): { level: number; percentage: number } {
  const thresholds = THRESHOLDS[speed];
  let level = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (points >= thresholds[i]) {
      level = i;
      break;
    }
  }

  // Вычисляем процент прогресса
  if (level >= 6) {
    return { level: 6, percentage: 100 };
  }
  const currentThreshold = thresholds[level];
  const nextThreshold = thresholds[level + 1];
  const progressInLevel = (points - currentThreshold) / (nextThreshold - currentThreshold);
  const percentage = Math.round((level / 6) * 100 + (progressInLevel / 6) * 100);

  return { level, percentage: Math.min(percentage, 100) };
}

export function useJapanification() {
  const [state, setState] = useState<JapanificationState>(DEFAULT_STATE);

  // Загружаем состояние из localStorage при монтировании
  useEffect(() => {
    try {
      const saved = getProfileItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as JapanificationState;
        // Пересчитываем уровень на случай изменения скорости
        const { level, percentage } = calculateLevel(parsed.points, parsed.speed);
        setState({ ...DEFAULT_STATE, ...parsed, level, percentage });
      }
    } catch {
      // Если данные повреждены, используем дефолт
    }
  }, []);

  // Сохраняем в localStorage при каждом изменении
  const persistState = useCallback((newState: JapanificationState) => {
    setState(newState);
    try {
      setProfileItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // localStorage может быть недоступен
    }
  }, []);

  /**
   * Функция перевода: возвращает русский или японский текст в зависимости от уровня
   * 
   * Уровни:
   * 0 — всё на русском
   * 1 — перевод реплик ИИ скрыт по умолчанию
   * 2 — кнопки на японском
   * 3 — меню на японском (с фуриганой) 
   * 4 — хинты на японском
   * 5 — фидбек грамматики на японском
   * 6 — всё на японском
   */
  const t = useCallback((ruText: string, jaText: string, minLevel: number = 2): string => {
    return state.level >= minLevel ? jaText : ruText;
  }, [state.level]);

  /**
   * Должен ли перевод реплик ИИ показываться по умолчанию (не скрыт)
   */
  const shouldShowTranslation = useCallback((): boolean => {
    if (state.showTranslationsAlways) return true;
    return state.level < 1;
  }, [state.level, state.showTranslationsAlways]);

  /**
   * Должен ли грамматический фидбек быть на японском
   */
  const shouldGrammarBeJapanese = useCallback((): boolean => {
    return state.level >= 5;
  }, [state.level]);

  /**
   * Должны ли хинты быть на японском
   */
  const shouldHintsBeJapanese = useCallback((): boolean => {
    return state.level >= 4;
  }, [state.level]);

  /**
   * Начислить очки прогресса
   */
  const addPoints = useCallback((n: number) => {
    setState(prev => {
      const newPoints = prev.points + n;
      const { level, percentage } = calculateLevel(newPoints, prev.speed);
      const newState = { ...prev, points: newPoints, level, percentage };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  /**
   * Отметить использованное слово
   */
  const trackWordUsed = useCallback((count: number = 1) => {
    setState(prev => {
      const newState = { 
        ...prev, 
        totalWordsUsed: prev.totalWordsUsed + count,
        points: prev.points + count
      };
      const { level, percentage } = calculateLevel(newState.points, newState.speed);
      newState.level = level;
      newState.percentage = percentage;
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  /**
   * Завершить сессию (бонусные очки)
   */
  const completeSession = useCallback(() => {
    setState(prev => {
      const newPoints = prev.points + 5;
      const { level, percentage } = calculateLevel(newPoints, prev.speed);
      const newState = { 
        ...prev, 
        sessionsCompleted: prev.sessionsCompleted + 1,
        points: newPoints,
        level,
        percentage 
      };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  /**
   * Изменить скорость японификации
   */
  const setSpeed = useCallback((speed: JapanificationSpeed) => {
    setState(prev => {
      const { level, percentage } = calculateLevel(prev.points, speed);
      const newState = { ...prev, speed, level, percentage };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  /**
   * Переключить режим «всегда показывать переводы»
   */
  const toggleAlwaysShowTranslations = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, showTranslationsAlways: !prev.showTranslationsAlways };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  /**
   * Изменить сложность чата
   */
  const setChatLevel = useCallback((chatLevel: number) => {
    setState(prev => {
      const newState = { ...prev, chatLevel };
      try {
        setProfileItem(STORAGE_KEY, JSON.stringify(newState));
      } catch {}
      return newState;
    });
  }, []);

  /**
   * Сбросить весь прогресс
   */
  const resetProgress = useCallback(() => {
    persistState(DEFAULT_STATE);
  }, [persistState]);

  return {
    state,
    t,
    shouldShowTranslation,
    shouldGrammarBeJapanese,
    shouldHintsBeJapanese,
    addPoints,
    trackWordUsed,
    completeSession,
    setSpeed,
    setChatLevel,
    toggleAlwaysShowTranslations,
    resetProgress,
  };
}

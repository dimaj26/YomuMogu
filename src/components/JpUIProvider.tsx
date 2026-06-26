'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, UiWord } from '../core/db';
import { calculateNextFsrsState } from '../core/scheduler';
import type { LocalWord } from '../core/db';
import { getActiveProfileId } from '../lib/profile';
import { useJapanification } from '../hooks/useJapanification';

interface JpUIContextType {
  uiWords: Record<string, UiWord>;
  upgradedThisSession: string | null;
  revertedIds: Set<string>;
  isLoaded: boolean;
  upgradeWord: (id: string, ru: string, ja: string, reading?: string) => Promise<void>;
  revertWord: (id: string) => Promise<void>;
  confirmWord: (id: string) => Promise<void>;
  resetUiProgress: () => Promise<void>;
}

const JpUIContext = createContext<JpUIContextType | undefined>(undefined);

/**
 * Минимальный уровень погружения, с которого контентные элементы начинают
 * японизироваться в режиме Smart. Нулевому новичку (level 0–1) контент остаётся
 * на русском — японизируется только то, к чему он уже подрос. (chrome-элементы
 * не японизируются никогда, см. JpUI kind='chrome'.)
 */
export const CONTENT_JP_MIN_LEVEL = 2;

export function JpUIProvider({ children }: { children: React.ReactNode }) {
  const [uiWords, setUiWords] = useState<Record<string, UiWord>>({});
  const [upgradedThisSession, setUpgradedThisSession] = useState<string | null>(null);
  const [revertedIds, setRevertedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [profileId, setProfileId] = useState<string>('default');
  
  const { state: jState } = useJapanification();
  const uiMode = jState.uiMode;

  // Инициализация профиля и загрузка данных
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const activeId = getActiveProfileId();
    setProfileId(activeId);

    // Восстанавливаем информацию об апгрейде в текущей сессии
    const sessionUpgrade = sessionStorage.getItem(`yomumogu_ui_upgraded_${activeId}`);
    if (sessionUpgrade) {
      setUpgradedThisSession(sessionUpgrade === '__none__' ? null : sessionUpgrade);
    }

    // Загружаем сохраненный прогресс из БД
    db.ui_words
      .where('profileId')
      .equals(activeId)
      .toArray()
      .then((words) => {
        const dict: Record<string, UiWord> = {};
        words.forEach((w) => {
          dict[w.id] = w;
        });
        setUiWords(dict);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('Ошибка загрузки ui_words из IndexedDB', err);
        setIsLoaded(true);
      });
  }, []);

  // Функция для апгрейда нового слова в японский режим
  const upgradeWord = useCallback(async (id: string, ru: string, ja: string, reading: string = '') => {
    if (!isLoaded || uiMode !== 'smart' || upgradedThisSession) return;
    // Порог уровня: нулевому новичку контент по-русски (chrome уже отфильтрован в JpUI)
    if (jState.level < CONTENT_JP_MIN_LEVEL) return;

    const activeId = getActiveProfileId();

    // Создаем начальное состояние слова
    const initialWord: UiWord = {
      profileId: activeId,
      id,
      word: ja,
      reading,
      translation: ru,
      status: 'new',
      stability: 0,
      difficulty: 0,
      interval: 0,
      due: Date.now(),
      reps: 0,
      lapses: 0
    };

    // Прогоняем через FSRS с первой успешной оценкой Good (3)
    const result = calculateNextFsrsState(initialWord as unknown as LocalWord, 3);
    const newWord = result.updatedWord as unknown as UiWord;
    newWord.reps = 1; // Устанавливаем reps = 1, чтобы отображалась фуригана

    try {
      await db.ui_words.put(newWord);
      
      setUiWords(prev => ({ ...prev, [id]: newWord }));
      setUpgradedThisSession(id);
      sessionStorage.setItem(`yomumogu_ui_upgraded_${activeId}`, id);
    } catch (err) {
      console.error('Ошибка сохранения апгрейда слова в БД', err);
    }
  }, [isLoaded, uiMode, upgradedThisSession, jState.level]);

  // Функция для отката слова на русский (оценка Again)
  const revertWord = useCallback(async (id: string) => {
    if (!isLoaded) return;
    
    const activeId = getActiveProfileId();
    const currentWord = uiWords[id];
    
    if (!currentWord) return;

    // Рассчитываем FSRS с оценкой Again (1)
    const result = calculateNextFsrsState(currentWord as unknown as LocalWord, 1);
    const updatedWord = result.updatedWord as unknown as UiWord;
    
    // Сбрасываем reps в 0, чтобы слово снова считалось новым/русским,
    // но сохраняем историю сложности (difficulty и stability по FSRS)
    updatedWord.reps = 0;

    try {
      await db.ui_words.put(updatedWord);
      
      // Обновляем состояние
      setUiWords(prev => ({ ...prev, [id]: updatedWord }));
      setRevertedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      // Если это слово было апгрейднуто в текущей сессии, разблокируем слот для апгрейда другого слова
      if (upgradedThisSession === id) {
        setUpgradedThisSession(null);
        sessionStorage.setItem(`yomumogu_ui_upgraded_${activeId}`, '__none__');
      }
    } catch (err) {
      console.error('Ошибка сохранения отката слова в БД', err);
    }
  }, [isLoaded, uiWords, upgradedThisSession]);

  // Функция для подтверждения знания слова (оценка Good)
  const confirmWord = useCallback(async (id: string) => {
    if (!isLoaded) return;

    const currentWord = uiWords[id];
    if (!currentWord) return;

    // Рассчитываем FSRS с оценкой Good (3)
    const result = calculateNextFsrsState(currentWord as unknown as LocalWord, 3);
    const updatedWord = result.updatedWord as unknown as UiWord;

    try {
      await db.ui_words.put(updatedWord);
      
      setUiWords(prev => ({ ...prev, [id]: updatedWord }));
    } catch (err) {
      console.error('Ошибка сохранения подтверждения слова в БД', err);
    }
  }, [isLoaded, uiWords]);

  // Сброс всего UI прогресса FSRS
  const resetUiProgress = useCallback(async () => {
    const activeId = getActiveProfileId();
    try {
      await db.ui_words.where('profileId').equals(activeId).delete();
      
      setUiWords({});
      setUpgradedThisSession(null);
      setRevertedIds(new Set());
      sessionStorage.removeItem(`yomumogu_ui_upgraded_${activeId}`);
    } catch (err) {
      console.error('Ошибка сброса прогресса UI в IndexedDB', err);
    }
  }, []);

  return (
    <JpUIContext.Provider
      value={{
        uiWords,
        upgradedThisSession,
        revertedIds,
        isLoaded,
        upgradeWord,
        revertWord,
        confirmWord,
        resetUiProgress
      }}
    >
      {children}
    </JpUIContext.Provider>
  );
}

export function useJpUI() {
  const context = useContext(JpUIContext);
  if (!context) {
    throw new Error('useJpUI должен использоваться внутри JpUIProvider');
  }
  return context;
}

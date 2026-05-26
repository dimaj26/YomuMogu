'use client';

import { useState, useEffect, useCallback } from 'react';
import { getProfileItem, setProfileItem, getActiveProfileId } from '../lib/profile';
import { useJapanification } from './useJapanification';

export interface DailyQuest {
  id: string;
  type: 'reviews' | 'chats' | 'mnemonics';
  title: string;
  description: string;
  target: number;
  current: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

const getTodayKey = (): string => {
  if (typeof window === 'undefined') return '';
  const now = new Date();
  const adjusted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const year = adjusted.getFullYear();
  const month = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getQuestsStorageKey = (profileId: string, dateKey: string): string => {
  return `daily_quests_${dateKey}`;
};

const createDefaultQuests = (): DailyQuest[] => [
  {
    id: 'reviews_quest',
    type: 'reviews',
    title: 'Охота на долги',
    description: 'Пройти 10 FSRS-повторений в квизе',
    target: 10,
    current: 0,
    rewardXp: 3,
    completed: false,
    claimed: false,
  },
  {
    id: 'chats_quest',
    type: 'chats',
    title: 'Красноречие',
    description: 'Завершить 1 разговорную сессию с ИИ-Sensei',
    target: 1,
    current: 0,
    rewardXp: 5,
    completed: false,
    claimed: false,
  },
  {
    id: 'mnemonics_quest',
    type: 'mnemonics',
    title: 'Творец ассоциаций',
    description: 'Создать или обновить 2 мнемоники в квизе',
    target: 2,
    current: 0,
    rewardXp: 2,
    completed: false,
    claimed: false,
  },
];

export function useQuests() {
  const { addPoints } = useJapanification();
  const [quests, setQuests] = useState<DailyQuest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileId, setProfileId] = useState<string>('default');
  const [todayKey, setTodayKey] = useState<string>('');

  // Загрузка квестов
  const loadQuests = useCallback(() => {
    if (typeof window === 'undefined') return;
    const activeProfile = getActiveProfileId();
    const dateKey = getTodayKey();
    setProfileId(activeProfile);
    setTodayKey(dateKey);

    const storageKey = getQuestsStorageKey(activeProfile, dateKey);
    const saved = getProfileItem(storageKey);

    if (saved) {
      try {
        setQuests(JSON.parse(saved));
      } catch (e) {
        const defaults = createDefaultQuests();
        setQuests(defaults);
        setProfileItem(storageKey, JSON.stringify(defaults));
      }
    } else {
      const defaults = createDefaultQuests();
      setQuests(defaults);
      setProfileItem(storageKey, JSON.stringify(defaults));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuests();
  }, [loadQuests]);

  // Инкремент прогресса квеста
  const incrementQuestProgress = useCallback((type: 'reviews' | 'chats' | 'mnemonics', amount: number = 1) => {
    if (typeof window === 'undefined') return;
    const activeProfile = getActiveProfileId();
    const dateKey = getTodayKey();
    const storageKey = getQuestsStorageKey(activeProfile, dateKey);

    const saved = getProfileItem(storageKey);
    let currentQuests: DailyQuest[] = [];

    if (saved) {
      try {
        currentQuests = JSON.parse(saved);
      } catch (e) {
        currentQuests = createDefaultQuests();
      }
    } else {
      currentQuests = createDefaultQuests();
    }

    let updated = false;
    const nextQuests = currentQuests.map(q => {
      if (q.type === type && !q.claimed && !q.completed) {
        const nextCurrent = Math.min(q.target, q.current + amount);
        const nextCompleted = nextCurrent >= q.target;
        updated = true;
        return {
          ...q,
          current: nextCurrent,
          completed: nextCompleted,
        };
      }
      return q;
    });

    if (updated) {
      setQuests(nextQuests);
      setProfileItem(storageKey, JSON.stringify(nextQuests));
    }
  }, []);

  // Получение награды
  const claimQuestReward = useCallback((questId: string): boolean => {
    if (typeof window === 'undefined') return false;
    const activeProfile = getActiveProfileId();
    const dateKey = getTodayKey();
    const storageKey = getQuestsStorageKey(activeProfile, dateKey);

    const saved = getProfileItem(storageKey);
    if (!saved) return false;

    try {
      const currentQuests: DailyQuest[] = JSON.parse(saved);
      let rewardAmount = 0;
      let success = false;

      const nextQuests = currentQuests.map(q => {
        if (q.id === questId && q.completed && !q.claimed) {
          rewardAmount = q.rewardXp;
          success = true;
          return { ...q, claimed: true };
        }
        return q;
      });

      if (success) {
        setQuests(nextQuests);
        setProfileItem(storageKey, JSON.stringify(nextQuests));
        addPoints(rewardAmount);
        return true;
      }
    } catch (e) {
      console.error('Ошибка получения награды за квест:', e);
    }
    return false;
  }, [addPoints]);

  return {
    quests,
    loading,
    incrementQuestProgress,
    claimQuestReward,
    refreshQuests: loadQuests,
    todayKey,
  };
}

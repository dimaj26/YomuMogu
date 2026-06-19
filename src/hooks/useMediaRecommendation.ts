import { useState, useEffect } from 'react';
import { db, type LocalWord } from '@/core/db';
import { getProfileItem, setProfileItem, getActiveProfileId } from '@/lib/profile';
import { logger } from '@/lib/logger';
import defaultFeed from '@/resources/media_feed.json';

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  url: string;
  platform: 'youtube' | 'podcast';
  lemmas: string[];
  comprehensionRate?: number;
  trackKind?: string;
  knownCount?: number;
  totalCount?: number;
  dueOverlapCount?: number;
}

export function useMediaRecommendation() {
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const profileId = getActiveProfileId();

  // Функция пересчета процента понимания и совпадения с FSRS-картами
  const recalculateCoverage = async (items: MediaItem[]): Promise<MediaItem[]> => {
    try {
      // 1. Получаем все локальные слова из IndexedDB для профиля
      const localWords = await db.words.where('profileId').equals(profileId).toArray();
      const now = Date.now();

      // Набор слов, которые пользователь знает (активно или пассивно)
      const knownWordsSet = new Set<string>();
      // Набор слов, которые требуют повторения прямо сейчас по графику FSRS (due)
      const dueWordsSet = new Set<string>();

      for (const w of localWords) {
        const wordStr = w.word;
        
        // §2.6: «known» считается только от единственной active-кривой — зрелая карта
        // или долгосрочный обзор (интервал >= 7 дней)
        const isActiveKnown = w.active && (w.active.status === 'mature' || (w.active.status === 'review' && w.active.interval >= 7));

        if (isActiveKnown) {
          knownWordsSet.add(wordStr);
        }

        // Слово просрочено в планировщике FSRS и не является абсолютно новым
        if (w.active && w.active.due <= now && w.active.status !== 'new') {
          dueWordsSet.add(wordStr);
        }
      }

      // 2. Рассчитываем метрики совпадения для каждого видео
      return items.map(item => {
        const totalCount = item.lemmas.length;
        if (totalCount === 0) {
          return { ...item, comprehensionRate: 0, knownCount: 0, totalCount: 0, dueOverlapCount: 0 };
        }

        let knownCount = 0;
        let dueOverlapCount = 0;

        for (const lemma of item.lemmas) {
          if (knownWordsSet.has(lemma)) {
            knownCount++;
          }
          if (dueWordsSet.has(lemma)) {
            dueOverlapCount++;
          }
        }

        const comprehensionRate = Math.round((knownCount / totalCount) * 100);

        return {
          ...item,
          comprehensionRate,
          knownCount,
          totalCount,
          dueOverlapCount
        };
      });
    } catch (err) {
      console.error('Ошибка расчета покрытия словаря для медиа-рекомендаций:', err);
      return items;
    }
  };

  const loadFeed = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Подгружаем стандартную ленту
      let feed: MediaItem[] = [...defaultFeed] as MediaItem[];

      // Подгружаем пользовательские кастомные ссылки из localStorage (namespaced)
      const customVideosJson = getProfileItem('custom_videos', profileId);
      if (customVideosJson) {
        try {
          const customVideos = JSON.parse(customVideosJson) as MediaItem[];
          feed = [...customVideos, ...feed];
        } catch (e) {
          logger.warn('Ошибка парсинга кастомных видео из профиля:', e);
        }
      }

      // Пересчитываем статистику пересечения
      const calculatedFeed = await recalculateCoverage(feed);
      setRecommendations(calculatedFeed);
    } catch (err) {
      setError((err instanceof Error ? err.message : '') || 'Не удалось загрузить рекомендации медиаконтента');
    } finally {
      setIsLoading(false);
    }
  };

  // Метод добавления кастомного видео по ссылке
  const addCustomUrl = async (url: string): Promise<MediaItem | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Отправляем запрос на сервер для парсинга и получения уникальных лемм
      const res = await fetch('/api/media/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось импортировать видео с YouTube');
      }

      const data = await res.json();
      const lemmas: string[] = data.lemmas;

      // 2. Формируем новый элемент медиа
      const newVideoId = `custom_${Date.now()}`;
      const newMediaItem: MediaItem = {
        id: newVideoId,
        title: `Импортированное видео YouTube`,
        description: `Пользовательская ссылка: ${url.substring(0, 50)}...`,
        url,
        platform: 'youtube',
        lemmas
      };

      // 3. Получаем текущие кастомные видео и дописываем новое в начало
      const customVideosJson = getProfileItem('custom_videos', profileId);
      let customVideos: MediaItem[] = [];
      if (customVideosJson) {
        try {
          customVideos = JSON.parse(customVideosJson);
        } catch {}
      }

      customVideos = [newMediaItem, ...customVideos];
      setProfileItem('custom_videos', JSON.stringify(customVideos), profileId);

      // Перезагружаем всю ленту
      await loadFeed();
      return newMediaItem;
    } catch (err) {
      setError((err instanceof Error ? err.message : '') || 'Ошибка импорта ссылки');
      setIsLoading(false);
      return null;
    }
  };

  useEffect(() => {
    loadFeed();
  }, [profileId]);

  return {
    recommendations,
    isLoading,
    error,
    addCustomUrl,
    refreshFeed: loadFeed,
    recalculateCoverage
  };
}

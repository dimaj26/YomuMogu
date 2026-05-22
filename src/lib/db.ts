import Dexie, { type Table } from 'dexie';
import { calculateNextFsrsState } from './anki/fsrs';
import { getProfileItem } from './profile';
import { logger } from './logger';

export interface LocalWord {
  profileId: string;
  id: number; // cardId из Anki
  word: string;
  reading: string;
  translation: string;
  status: 'new' | 'learning' | 'review' | 'mature';
  deckName: string;
  stability: number;
  difficulty: number;
  interval: number; // интервал повторения в днях
  due: number; // timestamp (ms) даты следующего повторения
  lastReview?: number; // timestamp последнего повторения
  reps: number; // количество повторений
  lapses: number; // количество ошибок (Again)
}

export interface LocalReview {
  id?: number; // локальный автоинкрементный ID
  profileId: string;
  cardId: number; // cardId из Anki
  ease: number; // оценка (1-4)
  interval: number; // новый интервал в днях (отрицательное число для секунд/минут)
  lastInterval: number; // предыдущий интервал в днях
  duration: number; // время ответа в мс
  timestamp: number; // точное время ответа (ms)
  synced: number; // 0 = не синхронизировано, 1 = синхронизировано
}

export interface UiWord {
  profileId: string;
  id: string; // Строковый ID элемента интерфейса (например, btn_settings)
  word: string; // Японское написание
  reading: string; // Хирагана чтение (опционально)
  translation: string; // Русский перевод
  status: 'new' | 'learning' | 'review' | 'mature';
  stability: number;
  difficulty: number;
  interval: number; // Интервал в днях
  due: number; // Timestamp следующего повторения (ms)
  lastReview?: number;
  reps: number;
  lapses: number;
}

class YomuMoguDatabase extends Dexie {
  words!: Table<LocalWord>;
  reviews!: Table<LocalReview>;
  ui_words!: Table<UiWord>;

  constructor() {
    super('YomuMoguDatabase');
    this.version(1).stores({
      words: '[profileId+id], id, word, status, deckName, due, profileId',
      reviews: '++id, [profileId+cardId], cardId, timestamp, synced, profileId',
    });
    this.version(2).stores({
      words: '[profileId+id], id, word, status, deckName, due, profileId',
      reviews: '++id, [profileId+cardId], cardId, timestamp, synced, profileId',
      ui_words: '[profileId+id], id, status, due, profileId',
    });
  }
}

// Экспортируем инстанс БД. Для безопасности SSR запросы должны делаться только на клиенте.
export const db = new YomuMoguDatabase();

/**
 * Получение всех слов текущего профиля для выбранной колоды
 */
export async function getLocalWords(profileId: string, deckName: string): Promise<LocalWord[]> {
  if (typeof window === 'undefined') return [];
  return db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.deckName === deckName)
    .toArray();
}

/**
 * Получение списка слов текущего профиля, требующих повторения (due <= now)
 */
export async function getDueWords(profileId: string, deckName: string, now: number): Promise<LocalWord[]> {
  if (typeof window === 'undefined') return [];
  return db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.deckName === deckName && w.due <= now)
    .toArray();
}

/**
 * Сохранение/обновление слов в локальной БД
 */
export async function saveLocalWords(words: LocalWord[]): Promise<void> {
  if (typeof window === 'undefined' || words.length === 0) return;
  await db.words.bulkPut(words);
}

/**
 * Запись локального ответа (прохождения карточки) в историю
 */
export async function addLocalReview(review: LocalReview): Promise<void> {
  if (typeof window === 'undefined') return;
  await db.reviews.add(review);
}

/**
 * Получение несинхронизированных ответов для отправки в Anki
 */
export async function getUnsyncedReviews(profileId: string): Promise<LocalReview[]> {
  if (typeof window === 'undefined') return [];
  return db.reviews
    .where('profileId')
    .equals(profileId)
    .filter(r => r.synced === 0)
    .toArray();
}

/**
 * Отметка логов ответов как синхронизированных
 */
export async function markReviewsAsSynced(reviewIds: number[]): Promise<void> {
  if (typeof window === 'undefined' || reviewIds.length === 0) return;
  await db.transaction('rw', db.reviews, async () => {
    for (const id of reviewIds) {
      await db.reviews.update(id, { synced: 1 });
    }
  });
}

/**
 * Выполняет двустороннюю синхронизацию IndexedDB с Anki Desktop
 */
export async function syncLocalDatabaseWithAnki(
  profileId: string,
  deckName: string
): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Синхронизация доступна только в браузере' };
  }

  try {
    // 1. Получаем несинхронизированные локальные логи
    const unsyncedReviews = await getUnsyncedReviews(profileId);

    // 2. Получаем текущие локальные слова, чтобы сервер знал, какие из них изменились в Anki
    const localWords = await db.words.where('profileId').equals(profileId).toArray();
    const localWordsSummary = localWords.map(w => ({
      id: w.id,
      interval: w.interval,
      due: w.due,
      reps: w.reps,
      status: w.status
    }));

    const frontField = getProfileItem('front_field', profileId) || 'Front';
    const backField = getProfileItem('back_field', profileId) || 'Back';

    const deckMappingsStr = getProfileItem('deck_mappings', profileId);
    let deckMappings = undefined;
    if (deckMappingsStr) {
      try {
        deckMappings = JSON.parse(deckMappingsStr);
      } catch (e) {
        console.error('Ошибка парсинга deck_mappings:', e);
      }
    }

    // 3. Вызываем API-эндпоинт синхронизации
    const res = await fetch('/api/anki/sync-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileId,
        deckName,
        frontField,
        backField,
        deckMappings,
        localReviews: unsyncedReviews,
        localWords: localWordsSummary
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Ошибка сети при вызове /api/anki/sync-db');
    }

    const { remoteCards, remoteReviews } = await res.json() as {
      remoteCards: Array<{
        id: number;
        word: string;
        translation: string;
        interval: number;
        status: 'new' | 'learning' | 'review' | 'mature';
        deckName: string;
        rawFront: string;
        rawBack: string;
        cardIds?: number[];
      }>;
      remoteReviews: Record<number, Array<{
        id: number;
        ease: number;
        ivl: number;
        lastIvl: number;
        time: number;
        type: number;
      }>>;
    };

    // 4. Помечаем локальные логи как синхронизированные
    const syncedIds = unsyncedReviews.map(r => r.id).filter((id): id is number => id !== undefined);
    if (syncedIds.length > 0) {
      await markReviewsAsSynced(syncedIds);
    }

    // 5. Вспомогательная функция извлечения чтения из [фуриганы]
    const extractReading = (rawFront: string): string => {
      const match = rawFront.match(/\[([^\]]+)\]/);
      return match ? match[1] : '';
    };

    // 6. Синхронизируем состояние карточек в IndexedDB
    await db.transaction('rw', db.words, db.reviews, async () => {
      for (const card of remoteCards) {
        const cardIds = card.cardIds && card.cardIds.length > 0 ? card.cardIds : [card.id];

        for (const cid of cardIds) {
          const reviews = remoteReviews[cid];
          const hasRemoteReviews = reviews && reviews.length > 0;

          if (hasRemoteReviews) {
            // Сортируем отзывы по возрастанию времени (хронологически)
            const sortedReviews = [...reviews].sort((a, b) => a.id - b.id);

            // Инициализируем пустое/новое состояние
            let localWord: LocalWord = {
              profileId,
              id: cid,
              word: card.word,
              reading: extractReading(card.rawFront),
              translation: card.translation,
              status: 'new',
              deckName: card.deckName || deckName,
              stability: 0,
              difficulty: 0,
              interval: 0,
              due: Date.now(),
              reps: 0,
              lapses: 0
            };

            // Прокручиваем FSRS по всей истории
            for (const r of sortedReviews) {
              // Игнорируем ручные перепланирования (тип 4 или оценка 0 в Anki)
              if (r.type === 4 || r.ease === 0) {
                continue;
              }
              const result = calculateNextFsrsState(localWord, r.ease, new Date(r.id));
              localWord = result.updatedWord;

              // Записываем отзыв в локальную историю, если его еще нет
              const reviewExists = await db.reviews
                .where('[profileId+cardId]')
                .equals([profileId, cid])
                .filter(x => x.timestamp === r.id)
                .first();

              if (!reviewExists) {
                await db.reviews.add({
                  profileId,
                  cardId: cid,
                  ease: r.ease,
                  interval: r.ivl,
                  lastInterval: r.lastIvl,
                  duration: r.time,
                  timestamp: r.id,
                  synced: 1
                });
              }
            }

            // Перезаписываем/сохраняем слово в БД
            await db.words.put(localWord);
          } else {
            // Отзывов нет. Проверяем, есть ли слово локально
            const exists = await db.words.get({ profileId, id: cid });
            if (!exists) {
              // Если слова нет, добавляем его как новое
              // При положительном интервале аппроксимируем параметры FSRS
              const stability = card.interval > 0 ? card.interval : 0;
              const difficulty = card.interval > 0 ? 5.0 : 0;
              const reps = card.interval > 0 ? 1 : 0;

              await db.words.put({
                profileId,
                id: cid,
                word: card.word,
                reading: extractReading(card.rawFront),
                translation: card.translation,
                status: card.status,
                deckName: card.deckName || deckName,
                stability,
                difficulty,
                interval: card.interval,
                due: Date.now(),
                reps,
                lapses: 0
              });
            } else {
              // Если слово есть, но отзывы не поменялись, обновляем базовые свойства (на случай редактирования полей в Anki)
              await db.words.update([profileId, cid], {
                word: card.word,
                translation: card.translation,
                reading: extractReading(card.rawFront)
              });
            }
          }
        }
      }
    });

    return { success: true, message: 'Синхронизация успешно завершена' };
  } catch (error: any) {
    logger.error('Ошибка при синхронизации локальной БД с Anki', error);
    return {
      success: false,
      message: error.message || 'Ошибка синхронизации'
    };
  }
}

/**
 * Получение всех UI-слов для указанного профиля
 */
export async function getLocalUiWords(profileId: string): Promise<UiWord[]> {
  if (typeof window === 'undefined') return [];
  return db.ui_words
    .where('profileId')
    .equals(profileId)
    .toArray();
}

/**
 * Сохранение/обновление UI-слова в БД
 */
export async function saveLocalUiWord(word: UiWord): Promise<void> {
  if (typeof window === 'undefined') return;
  await db.ui_words.put(word);
}

/**
 * Сброс FSRS прогресса для UI элементов профиля
 */
export async function resetLocalUiWords(profileId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  await db.ui_words.where('profileId').equals(profileId).delete();
}


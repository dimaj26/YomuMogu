import Dexie, { type Table } from 'dexie';
import { calculateNextFsrsState, createDefaultFsrsState, alignPassiveToActiveState } from './scheduler';
import { GRAMMAR_LEITNER_INTERVALS_DAYS } from './intervals';
import { getProfileItem } from '../lib/profile';
import { logger } from '../lib/logger';
import { LocalWord, LocalReview, UiWord, GrammarProgress } from './types';
import { getJlptLevel, mergeJlptTag } from '../lib/jlpt/levels';
import { stripHtml } from '../plugins/anki/filter';

export type { LocalWord, LocalReview, UiWord, GrammarProgress };


class YomuMoguDatabase extends Dexie {
  words!: Table<LocalWord>;
  reviews!: Table<LocalReview>;
  ui_words!: Table<UiWord>;
  grammar_progress!: Table<GrammarProgress>;

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

    this.version(3).stores({
      words: '[profileId+id], id, word, category, [profileId+category], passive.due, active.due, profileId',
      reviews: '++id, [profileId+cardId], cardId, timestamp, synced, profileId',
      ui_words: '[profileId+id], id, status, due, profileId',
    }).upgrade(async (tx) => {
      logger.info('Миграция IndexedDB на версию 3: конвертация плоской структуры FSRS в двойную (passive/active)');
      await tx.table('words').toCollection().modify((word: any) => {
        const flatFsrs = {
          stability: word.stability ?? 0,
          difficulty: word.difficulty ?? 0,
          interval: word.interval ?? 0,
          due: word.due ?? Date.now(),
          lastReview: word.lastReview,
          reps: word.reps ?? 0,
          lapses: word.lapses ?? 0,
          status: word.status ?? 'new'
        };

        word.passive = { ...flatFsrs };
        word.active = { ...flatFsrs };
        word.category = word.deckName || 'Japanese';
        word.source = word.source || 'anki';
        word.contextExamples = [];

        // Удаляем старые плоские поля
        delete word.stability;
        delete word.difficulty;
        delete word.interval;
        delete word.due;
        delete word.lastReview;
        delete word.reps;
        delete word.lapses;
        delete word.status;
        delete word.deckName;
      });
    });

    this.version(4).stores({
      words: '[profileId+id], id, word, category, [profileId+category], passive.due, active.due, profileId',
      reviews: '++id, [profileId+cardId], cardId, timestamp, synced, profileId',
      ui_words: '[profileId+id], id, status, due, profileId',
      grammar_progress: '[profileId+ruleId], ruleId, status, due, profileId',
    });

    this.version(5).stores({
      words: '[profileId+id], id, word, category, [profileId+category], passive.due, active.due, *tags, profileId',
      reviews: '++id, [profileId+cardId], cardId, timestamp, synced, profileId',
      ui_words: '[profileId+id], id, status, due, profileId',
      grammar_progress: '[profileId+ruleId], ruleId, status, due, profileId',
    });

    this.version(6).stores({
      words: '[profileId+id], id, word, category, [profileId+category], passive.due, active.due, *tags, profileId',
      reviews: '++id, [profileId+cardId], cardId, timestamp, synced, profileId',
      ui_words: '[profileId+id], id, status, due, profileId',
      grammar_progress: '[profileId+ruleId], ruleId, status, due, profileId',
      exposure_log: '[profileId+word], profileId, word, count, lastSeen',
    });

    // version(7): удаляем неиспользуемую таблицу exposure_log (мёртвая система майнинга по счётчику встреч).
    this.version(7).stores({
      exposure_log: null,
    });
  }
}

// Экспортируем инстанс БД. Для безопасности SSR запросы должны делаться только на клиенте.
export const db = new YomuMoguDatabase();

/**
 * Проверяет, является ли значение валидным ключом для IndexedDB.
 * Валидные ключи: string (не пустая), number (не NaN), Date (не с getTime() = NaN), Array.
 */
export function isValidIndexedDbKey(key: any): boolean {
  if (key === null || key === undefined) return false;
  if (typeof key === 'string') return key.length > 0;
  if (typeof key === 'number') return !isNaN(key);
  if (key instanceof Date) return !isNaN(key.getTime());
  if (Array.isArray(key)) {
    if (key.length === 0) return false;
    return key.every(k => isValidIndexedDbKey(k));
  }
  return false;
}

/**
 * Получение всех слов текущего профиля для выбранной категории (колоды)
 */
export async function getLocalWords(profileId: string, category: string): Promise<LocalWord[]> {
  if (typeof window === 'undefined') return [];
  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('getLocalWords: Невалидный profileId', { profileId });
    return [];
  }
  return db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === category)
    .toArray();
}

/**
 * Получение списка слов текущего профиля, требующих повторения (due <= now) в пассивной или активной форме
 */
export async function getDueWords(profileId: string, category: string, now: number): Promise<LocalWord[]> {
  if (typeof window === 'undefined') return [];
  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('getDueWords: Невалидный profileId', { profileId });
    return [];
  }
  return db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === category && (w.passive.due <= now || w.active.due <= now))
    .toArray();
}

/**
 * Сохранение/обновление слов в локальной БД
 */
export async function saveLocalWords(words: LocalWord[]): Promise<void> {
  if (typeof window === 'undefined' || words.length === 0) return;
  const validWords = words.filter(w => isValidIndexedDbKey([w.profileId, w.id]));
  if (validWords.length === 0) {
    logger.warn('saveLocalWords: Нет слов с валидными ключами для сохранения');
    return;
  }
  await db.words.bulkPut(validWords);
}

/**
 * Запись локального ответа (прохождения карточки) в историю
 */
export async function addLocalReview(review: LocalReview): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!review || !isValidIndexedDbKey([review.profileId, review.cardId])) {
    logger.warn('addLocalReview: Попытка добавить отзыв с невалидными ключами', {
      profileId: review?.profileId,
      cardId: review?.cardId
    });
    return;
  }
  await db.reviews.add(review);
}

/**
 * Получение несинхронизированных ответов для отправки в Anki
 */
export async function getUnsyncedReviews(profileId: string): Promise<LocalReview[]> {
  if (typeof window === 'undefined') return [];
  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('getUnsyncedReviews: Невалидный profileId', { profileId });
    return [];
  }
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
  const validIds = reviewIds.filter(id => typeof id === 'number' && !isNaN(id));
  if (validIds.length === 0) return;
  await db.transaction('rw', db.reviews, async () => {
    for (const id of validIds) {
      await db.reviews.update(id, { synced: 1 });
    }
  });
}

/**
 * Выполняет двустороннюю синхронизацию IndexedDB с Anki Desktop
 */
export async function syncLocalDatabaseWithAnki(
  profileId: string,
  deckName: string,
  sessionId?: string
): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Синхронизация доступна только в браузере' };
  }

  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('syncLocalDatabaseWithAnki: Невалидный profileId', { profileId });
    return { success: false, message: 'Неверный идентификатор профиля' };
  }

  try {
    // 1. Получаем несинхронизированные локальные логи
    const unsyncedReviews = await getUnsyncedReviews(profileId);

    // 2. Получаем текущие локальные слова, чтобы сервер знал, какие из них изменились в Anki
    const localWords = await db.words.where('profileId').equals(profileId).toArray();
    
    // Передаем active шкалу в Anki как основную для планирования интервалов
    const localWordsSummary = localWords.map(w => ({
      id: w.id,
      interval: w.active.interval,
      due: w.active.due,
      reps: w.active.reps,
      status: w.active.status
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
        localWords: localWordsSummary,
        sessionId
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
        const cardIds = (card.cardIds && card.cardIds.length > 0 ? card.cardIds : [card.id])
          .filter((id): id is number => typeof id === 'number' && !isNaN(id));

        for (const cid of cardIds) {
          if (!isValidIndexedDbKey([profileId, cid])) {
            logger.warn(`Пропуск синхронизации для карты из-за невалидного ключа: profileId=${profileId}, cardId=${cid}`);
            continue;
          }

          const reviews = remoteReviews[cid];
          const hasRemoteReviews = reviews && reviews.length > 0;

          if (hasRemoteReviews) {
            // Сортируем отзывы по возрастанию времени (хронологически)
            const sortedReviews = [...reviews].sort((a, b) => a.id - b.id);

            // Получаем существующее слово, чтобы сохранить его свойства
            const exists = await db.words.get([profileId, cid]);

            // Инициализируем пустое/новое состояние
            let localWord: LocalWord = {
              profileId,
              id: cid,
              word: card.word,
              reading: extractReading(card.rawFront),
              translation: card.translation,
              category: card.deckName || deckName,
              source: 'anki',
              passive: exists?.passive || createDefaultFsrsState(Date.now()),
              active: exists?.active || createDefaultFsrsState(Date.now()),
              contextExamples: exists?.contextExamples || [],
              mnemonic: exists?.mnemonic,
              tags: exists?.tags || []
            };

            // Прокручиваем FSRS по всей истории для обеих шкал
            for (const r of sortedReviews) {
              if (r.type === 4 || r.ease === 0) {
                continue;
              }
              if (typeof r.id !== 'number' || isNaN(r.id)) {
                logger.warn(`Пропуск некорректного отзыва с невалидным таймстампом`, r);
                continue;
              }

              const resultActive = calculateNextFsrsState(localWord, r.ease, 'active', new Date(r.id));
              localWord = alignPassiveToActiveState(resultActive.updatedWord);

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

            // Добавляем JLPT-тег при совпадении уровня
            const cleanedWord = stripHtml(localWord.word);
            const jlptLevel = getJlptLevel(cleanedWord);
            if (jlptLevel) {
              localWord.tags = mergeJlptTag(localWord.tags || [], jlptLevel);
            }

            // Перезаписываем/сохраняем слово в БД
            if (isValidIndexedDbKey([localWord.profileId, localWord.id])) {
              await db.words.put(localWord);
            }
          } else {
            // Отзывов нет. Проверяем, есть ли слово локально
            const exists = await db.words.get([profileId, cid]);
            if (!exists) {
              // Если слова нет, добавляем его как новое.
              // При положительном интервале аппроксимируем параметры FSRS для обеих шкал.
              const stability = card.interval > 0 ? card.interval : 0;
              const difficulty = card.interval > 0 ? 5.0 : 0;
              const reps = card.interval > 0 ? 1 : 0;
              const due = card.interval > 0 ? Date.now() + card.interval * 24 * 60 * 60 * 1000 : Date.now();

              const approximatedState = {
                stability,
                difficulty,
                interval: card.interval,
                due,
                reps,
                lapses: 0,
                status: card.status
              };

              let tags: string[] = [];
              const cleanedWord = stripHtml(card.word);
              const jlptLevel = getJlptLevel(cleanedWord);
              if (jlptLevel) {
                tags = mergeJlptTag(tags, jlptLevel);
              }

              await db.words.put({
                profileId,
                id: cid,
                word: card.word,
                reading: extractReading(card.rawFront),
                translation: card.translation,
                category: card.deckName || deckName,
                source: 'anki',
                passive: { ...approximatedState },
                active: { ...approximatedState },
                contextExamples: [],
                tags
              });
            } else {
              // Если слово есть, но отзывы не поменялись, обновляем базовые свойства
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

    // Запускаем фоновую ленивую классификацию слов, у которых нет тегов
    if (typeof window !== 'undefined') {
      import('./localDeckService').then(({ classifyMissingWords }) => {
        db.words.where('profileId').equals(profileId).toArray().then(allWords => {
          classifyMissingWords(profileId, allWords).catch(err => {
            console.error('[LazyTagger] Ошибка фоновой классификации при синхронизации:', err);
          });
        }).catch(err => {
          console.error('[LazyTagger] Ошибка чтения слов при синхронизации:', err);
        });
      }).catch(err => {
        console.error('[LazyTagger] Ошибка динамического импорта localDeckService при синхронизации:', err);
      });
    }

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
  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('getLocalUiWords: Невалидный profileId', { profileId });
    return [];
  }
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
  if (!word || !isValidIndexedDbKey([word.profileId, word.id])) {
    logger.warn('saveLocalUiWord: Попытка сохранить UiWord с невалидными ключами', word);
    return;
  }
  await db.ui_words.put(word);
}

/**
 * Сброс FSRS прогресса для UI элементов профиля
 */
export async function resetLocalUiWords(profileId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('resetLocalUiWords: Невалидный profileId', { profileId });
    return;
  }
  await db.ui_words.where('profileId').equals(profileId).delete();
}

/**
 * Получение всего прогресса по грамматике для указанного профиля
 */
export async function getGrammarProgressList(profileId: string): Promise<GrammarProgress[]> {
  if (typeof window === 'undefined') return [];
  if (!isValidIndexedDbKey(profileId)) {
    logger.warn('getGrammarProgressList: Невалидный profileId', { profileId });
    return [];
  }
  return db.grammar_progress
    .where('profileId')
    .equals(profileId)
    .toArray();
}

/**
 * Обновление интервала грамматического правила по системе Leitner.
 * Шаги интервалов в днях: [1, 3, 7, 14, 30].
 * Оценки:
 *  - 'forgot' (совсем забыл): откат на шаг 0 (интервал 1 день).
 *  - 'hard' (плохо помню): уменьшение шага на 1 (минимум 0).
 *  - 'good' (хорошо помню / по умолчанию): увеличение шага на 1 (максимум 4).
 */
export async function updateGrammarProgress(
  profileId: string,
  ruleId: string,
  grade: 'forgot' | 'hard' | 'good'
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isValidIndexedDbKey([profileId, ruleId])) {
    logger.warn('updateGrammarProgress: Невалидные ключи', { profileId, ruleId });
    return;
  }

  const intervals = GRAMMAR_LEITNER_INTERVALS_DAYS;
  const now = Date.now();

  let progress = await db.grammar_progress.get([profileId, ruleId]);

  if (!progress) {
    progress = {
      profileId,
      ruleId,
      stepIndex: 0,
      due: now,
      status: 'new',
    };
  }

  let nextStep = progress.stepIndex;

  if (grade === 'forgot') {
    nextStep = 0;
  } else if (grade === 'hard') {
    nextStep = Math.max(0, nextStep - 1);
  } else {
    nextStep = Math.min(4, nextStep + 1);
  }

  const intervalDays = intervals[nextStep];
  const due = now + intervalDays * 24 * 60 * 60 * 1000;
  const status = nextStep >= 3 ? 'mature' : nextStep >= 1 ? 'learning' : 'review';

  await db.grammar_progress.put({
    profileId,
    ruleId,
    stepIndex: nextStep,
    lastReviewed: now,
    due,
    status,
  });

  logger.info(`Грамматический прогресс обновлен: ruleId=${ruleId}, stepIndex=${nextStep}, due=${new Date(due).toISOString()}`);
}




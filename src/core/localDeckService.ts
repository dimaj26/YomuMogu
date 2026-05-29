import { db } from './db';
import type { LocalWord, CardWord as AnkiWord } from './types';
import { getProfileItem, setProfileItem } from '../lib/profile';
import { alignToDayBoundary, createDefaultFsrsState } from './scheduler';

// Константы системы
export const LOCAL_DECK_NAME = '__local_starter__';
export const MATURE_INTERVAL_DAYS = 200;
export const MIN_WORDS_FOR_3_SESSIONS = 15;
export const LOCAL_STORAGE_KEY_PREFIX = 'daily_new_words';

export interface DeckStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  mature: number;
}

/**
 * Возвращает дневной лимит новых слов для указанного профиля.
 */
export function getDailyNewWordsLimitOffset(profileId: string): number {
  if (typeof window === 'undefined') return 0;
  const key = `${LOCAL_STORAGE_KEY_PREFIX}_limit_offset_${getLocalDateString()}`;
  const val = getProfileItem(key, profileId);
  return val ? parseInt(val, 10) : 0;
}

export function incrementDailyNewWordsLimitOffset(profileId: string, amount: number): void {
  if (typeof window === 'undefined') return;
  const key = `${LOCAL_STORAGE_KEY_PREFIX}_limit_offset_${getLocalDateString()}`;
  const current = getDailyNewWordsLimitOffset(profileId);
  setProfileItem(key, (current + amount).toString(), profileId);
}

export function getDailyNewWordsLimit(profileId: string): number {
  if (typeof window === 'undefined') return 10;
  let baseLimit = 10;
  const preset = getProfileItem('quota_preset', profileId);
  if (preset === 'easy') baseLimit = 5;
  else if (preset === 'hard') baseLimit = 20;
  else if (preset === 'custom') {
    const customLimitStr = getProfileItem('daily_new_words_limit', profileId);
    if (customLimitStr) {
      const parsed = parseInt(customLimitStr, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
        baseLimit = parsed;
      }
    }
  }
  const offset = getDailyNewWordsLimitOffset(profileId);
  return baseLimit + offset;
}

/**
 * Вспомогательная функция для получения текущей локальной даты в формате YYYY-MM-DD
 */
function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Проверяет наличие записей с category === LOCAL_DECK_NAME в IndexedDB для данного профиля.
 */
export async function isLocalDeckInitialized(profileId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const count = await db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === LOCAL_DECK_NAME)
    .count();
  return count > 0;
}

/**
 * Массово импортирует starter_deck.json в таблицу words.
 * АДДИТИВНЫЙ РЕЖИМ: слова с существующим status !== 'new' НЕ перезаписываются.
 */
export async function importStarterDeck(profileId: string, knownWordIds: Set<number>): Promise<void> {
  if (typeof window === 'undefined') return;

  // Ленивый динамический импорт
  const deckData = (await import('../resources/starter_deck.json')).default;
  let dictionary: Record<string, string[]> = {};
  try {
    dictionary = (await import('../resources/situational_dictionary.json')).default as Record<string, string[]>;
  } catch (e) {
    console.error('Ошибка загрузки ситуационного словаря:', e);
  }

  // Извлекаем существующие слова для этого профиля и колоды
  const existingWords = await db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === LOCAL_DECK_NAME)
    .toArray();

  const existingMap = new Map<number, LocalWord>(existingWords.map(w => [w.id, w]));
  const wordsToSave: LocalWord[] = [];

  const now = Date.now();
  const matureDue = alignToDayBoundary(new Date(now + MATURE_INTERVAL_DAYS * 24 * 60 * 60 * 1000)).getTime();

  for (const item of deckData) {
    const wordId = item.id;
    const existing = existingMap.get(wordId);

    // Если слово уже есть в БД и его статус не 'new' в активном состоянии, то пропускаем
    if (existing && existing.active.status !== 'new') {
      continue;
    }

    const isKnown = knownWordIds.has(wordId);
    
    // Получаем ситуационные теги из словаря
    const tags = dictionary[item.word] || ["universal"];
    
    const wordRecord: LocalWord = {
      profileId,
      id: wordId,
      word: item.word,
      reading: item.reading,
      translation: item.translation,
      category: LOCAL_DECK_NAME,
      source: 'starter',
      passive: isKnown ? {
        stability: MATURE_INTERVAL_DAYS,
        difficulty: 5.0,
        interval: MATURE_INTERVAL_DAYS,
        due: matureDue,
        reps: 1,
        lapses: 0,
        status: 'mature',
        lastReview: now
      } : createDefaultFsrsState(now),
      active: isKnown ? {
        stability: MATURE_INTERVAL_DAYS,
        difficulty: 5.0,
        interval: MATURE_INTERVAL_DAYS,
        due: matureDue,
        reps: 1,
        lapses: 0,
        status: 'mature',
        lastReview: now
      } : createDefaultFsrsState(now),
      contextExamples: [],
      tags
    };

    wordsToSave.push(wordRecord);
  }

  if (wordsToSave.length > 0) {
    await db.words.bulkPut(wordsToSave);
  }
}

/**
 * Читает localStorage ключ daily_new_words_YYYY-MM-DD для указанного профиля.
 * Автоматически возвращает 0 при смене даты.
 */
export function getDailyNewWordsCount(profileId: string): number {
  if (typeof window === 'undefined') return 0;
  const key = `${LOCAL_STORAGE_KEY_PREFIX}_${getLocalDateString()}`;
  const val = getProfileItem(key, profileId);
  return val ? parseInt(val, 10) : 0;
}

/**
 * Обновляет localStorage счетчик для указанного профиля.
 */
export function incrementDailyNewWordsCount(profileId: string, count: number): void {
  if (typeof window === 'undefined') return;
  const key = `${LOCAL_STORAGE_KEY_PREFIX}_${getLocalDateString()}`;
  const current = getDailyNewWordsCount(profileId);
  setProfileItem(key, (current + count).toString(), profileId);
}

/**
 * Конвертер LocalWord -> AnkiWord для совместимости с API Gemini.
 */
export function localWordToAnkiWord(word: LocalWord): AnkiWord {
  return {
    id: word.id,
    word: word.word,
    translation: word.translation,
    interval: word.active.interval,
    status: word.active.status,
    deckName: word.category,
    rawFront: word.word,
    rawBack: word.translation,
    cardIds: [word.id],
    tags: word.tags
  };
}

/**
 * Возвращает активный пул слов для генерации сессий:
 *   1. due words: status in ('learning','review','mature') AND due <= now в одной из шкал
 *   2. Если |due| < MIN_WORDS_FOR_3_SESSIONS: добирать new, не превышая дневной лимит
 *   3. Если всё ещё < MIN_WORDS_FOR_3_SESSIONS: добирать mature с наименьшим interval
 */
export async function getDailyActivePool(profileId: string, category: string): Promise<AnkiWord[]> {
  if (typeof window === 'undefined') return [];

  // Получаем все слова категории из IndexedDB
  const allWords = await db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === category)
    .toArray();

  const now = Date.now();

  // Разделяем слова по категориям на основе пассивного/активного состояния
  const dueWords = allWords.filter(w => 
    (w.passive.status !== 'new' || w.active.status !== 'new') && 
    (w.passive.due <= now || w.active.due <= now)
  );
  
  const newWords = allWords.filter(w => 
    w.passive.status === 'new' && 
    w.active.status === 'new'
  ).sort((a, b) => a.id - b.id);
  
  const matureFallbackWords = allWords
    .filter(w => 
      (w.passive.status === 'mature' || w.active.status === 'mature') && 
      w.passive.due > now && 
      w.active.due > now
    )
    .sort((a, b) => Math.min(a.passive.interval, a.active.interval) - Math.min(b.passive.interval, b.active.interval));

  const pool: LocalWord[] = [...dueWords];

  // Если слов меньше 15, добираем новые слова с учетом дневного лимита
  if (pool.length < MIN_WORDS_FOR_3_SESSIONS) {
    const todayNewCount = getDailyNewWordsCount(profileId);
    const limit = getDailyNewWordsLimit(profileId);
    const remainingNewQuota = Math.max(0, limit - todayNewCount);
    const neededNewCount = MIN_WORDS_FOR_3_SESSIONS - pool.length;
    const addedNewCount = Math.min(neededNewCount, remainingNewQuota);

    if (addedNewCount > 0) {
      const added = newWords.slice(0, addedNewCount);
      pool.push(...added);
    }
  }

  // Mature-добор только при ПОЛНОСТЬЮ пустом пуле (ни due, ни new)
  if (pool.length === 0) {
    const neededFallbackCount = MIN_WORDS_FOR_3_SESSIONS;
    const added = matureFallbackWords.slice(0, neededFallbackCount);
    pool.push(...added);
  }

  // Лениво классифицируем слова в пуле, у которых нет тегов
  await classifyMissingWords(profileId, pool);

  return pool.map(localWordToAnkiWord);
}

/**
 * Возвращает статистику по колоде локального режима.
 */
export async function getLocalDeckStats(profileId: string): Promise<DeckStats> {
  if (typeof window === 'undefined') {
    return { total: 0, new: 0, learning: 0, review: 0, mature: 0 };
  }

  const words = await db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === LOCAL_DECK_NAME)
    .toArray();

  const stats: DeckStats = { total: words.length, new: 0, learning: 0, review: 0, mature: 0 };

  for (const w of words) {
    const status = w.active.status; // За основу берем активную шкалу
    if (status === 'new') stats.new++;
    else if (status === 'learning') stats.learning++;
    else if (status === 'review') stats.review++;
    else if (status === 'mature') stats.mature++;
  }

  return stats;
}

/**
 * Добавляет новое слово в локальную колоду.
 */
export async function addWord(
  profileId: string,
  word: string,
  reading: string,
  translation: string,
  deckName: string = LOCAL_DECK_NAME
): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Добавление доступно только в браузере' };
  }

  const wordId = Date.now();
  
  let tags: string[] = ["universal"];
  try {
    const dictionary = (await import('../resources/situational_dictionary.json')).default as Record<string, string[]>;
    if (dictionary[word]) {
      tags = dictionary[word];
    }
  } catch (e) {
    console.error('Ошибка загрузки ситуационного словаря при добавлении слова:', e);
  }
  
  const wordRecord: LocalWord = {
    profileId,
    id: wordId,
    word,
    reading,
    translation,
    category: deckName,
    source: 'manual',
    passive: createDefaultFsrsState(Date.now()),
    active: createDefaultFsrsState(Date.now()),
    contextExamples: [],
    tags
  };

  try {
    await db.words.put(wordRecord);
    return { success: true, message: 'Слово добавлено локально' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Ошибка добавления' };
  }
}

/**
 * Вспомогательная функция для разделения склеенных nJMdict слов и значений.
 */
export function fixConcatenatedTranslation(text: string): string {
  if (!text) return '';
  let fixed = text;
  
  // Конкретные исправления известных слияний
  fixed = fixed.replace(/sadmiserableunhappysorrowfulof/g, 'sad, miserable, unhappy, sorrowful, of');
  fixed = fixed.replace(/sadmiserableunhappysorrowful/g, 'sad, miserable, unhappy, sorrowful');
  fixed = fixed.replace(/\(waving\)longitude/g, '(waving), longitude');
  
  // Общий эвристический сплиттер для типичных английских слов, если они слиплись
  const commonWords = [
    'sad', 'miserable', 'unhappy', 'sorrowful', 'person', 'warp', 'waving', 'longitude', 
    'happy', 'joyful', 'cheerful', 'angry', 'mad', 'annoyed', 'scared', 'afraid', 'frightened',
    'tired', 'sleepy', 'exhausted', 'hungry', 'thirsty', 'sick', 'ill', 'pain', 'hurt'
  ];
  
  for (let i = 0; i < commonWords.length; i++) {
    for (let j = 0; j < commonWords.length; j++) {
      if (i === j) continue;
      const combined = commonWords[i] + commonWords[j];
      const regex = new RegExp(combined, 'g');
      fixed = fixed.replace(regex, `${commonWords[i]}, ${commonWords[j]}`);
    }
  }
  
  return fixed;
}

/**
 * Удаляет мусор разметки и служебные надписи словарей (например, nJMdict English)
 * из полей переводов.
 */
export function cleanTranslationJunk(translation: string): string {
  if (!translation) return '';
  let cleaned = translation;
  
  // Исправляем слипшиеся слова nJMdict
  cleaned = fixConcatenatedTranslation(cleaned);
  
  // Удаляем варианты с GemDict/nJMdict English/Russian/Japanese/etc. с любыми скобками или без них
  cleaned = cleaned.replace(/[\(\[\{]?\s*(?:GemDict|nJMdict)(?:\s+[a-zA-Z]+)?\s*[\)\]\}]?/gi, '');
  
  // Восстанавливаем пробелы после закрывающих скобок, если за ними сразу идет слово (проблема слияния nJMdict)
  cleaned = cleaned.replace(/([\)\]\}])(?=[a-zA-Zа-яА-ЯёЁ])/g, '$1 ');
  
  // Удаляем двоеточия или тире, которые могли остаться с краю после удаления
  cleaned = cleaned.replace(/^\s*[:;\-\–\—\s]+\s*/, '');
  cleaned = cleaned.replace(/\s*[:;\-\–\—\s]+\s*$/, '');
  
  // Очищаем лишние двойные пробелы
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned.trim();
}

/**
 * Вручную исправляет опечатки и разделяет склеенные слова в переводе
 * во всех словах профиля "test" для устранения импортированного мусора.
 */
export async function manuallyFixTestProfileWords(profileId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const allWords = await db.words
      .where('profileId')
      .equals(profileId)
      .toArray();

    const updated: LocalWord[] = [];
    for (const w of allWords) {
      let changed = false;
      let t = w.translation;

      // Точечные ручные замены слипшихся цепочек по указанию пользователя
      if (t.includes('sadmiserableunhappysorrowfulof a person')) {
        t = t.replace('sadmiserableunhappysorrowfulof a person', 'sad, miserable, unhappy, sorrowful (of a person)');
        changed = true;
      }
      if (t.includes('sadmiserableunhappysorrowful')) {
        t = t.replace('sadmiserableunhappysorrowful', 'sad, miserable, unhappy, sorrowful');
        changed = true;
      }
      if (t.includes('warp (waving)longitude')) {
        t = t.replace('warp (waving)longitude', 'warp (waving), longitude');
        changed = true;
      }
      if (t.includes('waving)longitude')) {
        t = t.replace('waving)longitude', 'waving), longitude');
        changed = true;
      }

      if (changed) {
        w.translation = t;
        updated.push(w);
      }
    }

    if (updated.length > 0) {
      await db.words.bulkPut(updated);
      console.log(`[ManualFix] Вручную исправлено ${updated.length} слов в профиле ${profileId}`);
    }
  } catch (e) {
    console.error('Ошибка ручного исправления колоды:', e);
  }
}

/**
 * Корректирует опечатки/поля в уже импортированных словах локального списка
 * на основе свежей версии starter_deck.json, сохраняя историю FSRS.
 * Также очищает мусор внешних словарей во всех импортированных словах.
 */
export async function syncExistingLocalWordsWithStarterDeck(profileId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Вручную исправляем колоду профиля
  await manuallyFixTestProfileWords(profileId);

  const deckData = (await import('../resources/starter_deck.json')).default;
  const existingWords = await db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === LOCAL_DECK_NAME)
    .toArray();

  const wordsToUpdate: LocalWord[] = [];
  const existingMap = new Map<number, LocalWord>(existingWords.map(w => [w.id, w]));

  for (const item of deckData) {
    const existing = existingMap.get(item.id);
    if (existing) {
      if (
        existing.word !== item.word ||
        existing.reading !== item.reading ||
        existing.translation !== item.translation
      ) {
        existing.word = item.word;
        existing.reading = item.reading;
        existing.translation = item.translation;
        wordsToUpdate.push(existing);
      }
    }
  }

  // Очистка мусора GemDict во всех сохраненных словах профиля
  const allProfileWords = await db.words
    .where('profileId')
    .equals(profileId)
    .toArray();

  for (const w of allProfileWords) {
    const cleaned = cleanTranslationJunk(w.translation);
    if (cleaned !== w.translation) {
      w.translation = cleaned;
      if (!wordsToUpdate.some(item => item.id === w.id)) {
        wordsToUpdate.push(w);
      }
    }
  }

  if (wordsToUpdate.length > 0) {
    await db.words.bulkPut(wordsToUpdate);
    console.log(`[LocalDeck] Автоматически исправлены опечатки и очищен мусор разметки в ${wordsToUpdate.length} словах для профиля ${profileId}`);
  }
}

/**
 * Возвращает количество приоритетных слов (due + новые в рамках дневного лимита).
 * Используется для предупреждающего баннера при генерации сессий.
 */
export async function getPriorityWordsCount(profileId: string, category: string): Promise<number> {
  if (typeof window === 'undefined') return 0;

  const allWords = await db.words
    .where('profileId')
    .equals(profileId)
    .filter(w => w.category === category)
    .toArray();

  const now = Date.now();

  // Due-слова: не 'new' и просрочены
  const dueCount = allWords.filter(w =>
    w.active.status !== 'new' &&
    (w.passive.due <= now || w.active.due <= now)
  ).length;

  // Новые слова в рамках дневного лимита
  const newWords = allWords.filter(w =>
    w.passive.status === 'new' && w.active.status === 'new'
  );
  const todayNewCount = getDailyNewWordsCount(profileId);
  const limit = getDailyNewWordsLimit(profileId);
  const remainingNewQuota = Math.max(0, limit - todayNewCount);
  const newCount = Math.min(newWords.length, remainingNewQuota);

  return dueCount + newCount;
}

/**
 * Синхронизирует счетчик изученных за сегодня слов в localStorage с базой данных IndexedDB.
 */
export async function syncDailyNewWordsCountWithDb(profileId: string): Promise<number> {
  if (typeof window === 'undefined') return 0;

  // Вычисляем границу дня (с 4:00 утра текущего дня)
  const now = new Date();
  const boundary = new Date(now);
  boundary.setHours(4, 0, 0, 0);
  if (now.getHours() < 4) {
    boundary.setDate(boundary.getDate() - 1);
  }
  const startTimestamp = boundary.getTime();

  let dbCount = 0;

  try {
    const todayReviews = await db.reviews
      .where('profileId')
      .equals(profileId)
      .filter(r => r.timestamp >= startTimestamp)
      .toArray();

    if (todayReviews.length > 0) {
      const uniqueCardIds = Array.from(new Set(todayReviews.map(r => r.cardId)));

      for (const cardId of uniqueCardIds) {
        const pastReviewsCount = await db.reviews
          .where('[profileId+cardId]')
          .equals([profileId, cardId])
          .filter(r => r.timestamp < startTimestamp)
          .count();

        if (pastReviewsCount === 0) {
          dbCount++;
        }
      }
    }
  } catch (e) {
    console.error('Ошибка в syncDailyNewWordsCountWithDb:', e);
  }

  const key = `${LOCAL_STORAGE_KEY_PREFIX}_${getLocalDateString()}`;
  setProfileItem(key, dbCount.toString(), profileId);

  return dbCount;
}

/**
 * Проверяет слова на наличие тегов. Если тегов нет, пытается найти их в статическом словаре.
 * Если слова нет в словаре, обращается к Gemini API для классификации.
 * Обновляет слова в БД.
 */
export async function classifyMissingWords(profileId: string, words: LocalWord[]): Promise<void> {
  if (typeof window === 'undefined' || words.length === 0) return;

  const missing = words.filter(w => !w.tags || w.tags.length === 0);
  if (missing.length === 0) return;

  // Загружаем статический словарь
  let dictionary: Record<string, string[]> = {};
  try {
    dictionary = (await import('../resources/situational_dictionary.json')).default as Record<string, string[]>;
  } catch (e) {
    console.error('Ошибка загрузки ситуационного словаря при ленивой классификации:', e);
  }

  const wordsToClassifyOnline: LocalWord[] = [];
  const wordsToSaveLocally: LocalWord[] = [];

  for (const w of missing) {
    const staticTags = dictionary[w.word];
    if (staticTags && staticTags.length > 0) {
      w.tags = staticTags;
      wordsToSaveLocally.push(w);
    } else {
      wordsToClassifyOnline.push(w);
    }
  }

  // Если есть слова для онлайн-классификации через Gemini
  if (wordsToClassifyOnline.length > 0) {
    try {
      const response = await fetch('/api/gemini/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          words: wordsToClassifyOnline.map(w => w.word)
        })
      });

      if (response.ok) {
        const { classifications } = await response.json() as { classifications: { word: string; tags: string[] }[] };
        const classMap = new Map(classifications.map(c => [c.word, c.tags]));
        
        for (const w of wordsToClassifyOnline) {
          const tags = classMap.get(w.word) || ['universal'];
          w.tags = tags;
          wordsToSaveLocally.push(w);
        }
      } else {
        console.error('Ошибка вызова API классификации:', response.statusText);
        // Фолбек на universal при ошибке API, чтобы не спамить
        for (const w of wordsToClassifyOnline) {
          w.tags = ['universal'];
          wordsToSaveLocally.push(w);
        }
      }
    } catch (e) {
      console.error('Ошибка при онлайн-классификации слов:', e);
      // Фолбек на universal при ошибке сети
      for (const w of wordsToClassifyOnline) {
        w.tags = ['universal'];
        wordsToSaveLocally.push(w);
      }
    }
  }

  if (wordsToSaveLocally.length > 0) {
    await db.words.bulkPut(wordsToSaveLocally);
    console.log(`[LazyTagger] Классифицировано слов: ${wordsToSaveLocally.length}`);
  }
}

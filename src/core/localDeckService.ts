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
export function getDailyNewWordsLimit(profileId: string): number {
  if (typeof window === 'undefined') return 10;
  const preset = getProfileItem('quota_preset', profileId);
  if (preset === 'easy') return 5;
  if (preset === 'hard') return 20;
  if (preset === 'custom') {
    const customLimitStr = getProfileItem('daily_new_words_limit', profileId);
    if (customLimitStr) {
      const parsed = parseInt(customLimitStr, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
        return parsed;
      }
    }
    return 10; // фоллбек при некорректном кастомном значении
  }
  return 10; // 'standard' или если пресет не задан
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
      contextExamples: []
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

  // Если все еще меньше 15, добираем mature-слова с наименьшим интервалом
  if (pool.length < MIN_WORDS_FOR_3_SESSIONS) {
    const neededFallbackCount = MIN_WORDS_FOR_3_SESSIONS - pool.length;
    const added = matureFallbackWords.slice(0, neededFallbackCount);
    pool.push(...added);
  }

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
    contextExamples: []
  };

  try {
    await db.words.put(wordRecord);
    return { success: true, message: 'Слово добавлено локально' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Ошибка добавления' };
  }
}


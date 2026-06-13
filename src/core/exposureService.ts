import { db } from './db';
import { ExposureEntry } from './types';
import { EXPOSURE_MINING_THRESHOLD } from './intervals';

// Фиксированный стоп-лист грамматических слов и частиц
export const EXPOSURE_STOPLIST = new Set([
  'は', 'を', 'が', 'に', 'で', 'と', 'も', 'へ', 'や', 'の', 'か', 'な', 'ね', 'よ',
  'です', 'ます', 'だ', 'する', 'いる', 'ある', 'これ', 'それ', 'あれ'
]);

/**
 * Идемпотентно обновляет логи встреч (exposure) для списка слов.
 * Инкрементирует count, обновляет lastSeen, устанавливает firstSeen при первом добавлении.
 * Игнорирует слова, которые уже находятся в таблице words (изучаемые) или в стоп-листе.
 */
export async function recordExposure(profileId: string, words: string[], source: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!words || words.length === 0) return;

  const uniqueWords = Array.from(new Set(words.map(w => w.trim()).filter(Boolean)));

  await db.transaction('rw', [db.words, db.exposure_log], async () => {
    const userWords = await db.words.where('profileId').equals(profileId).toArray();
    const userWordSet = new Set(userWords.map(w => w.word));

    const now = Date.now();

    for (const word of uniqueWords) {
      if (EXPOSURE_STOPLIST.has(word) || userWordSet.has(word)) {
        continue;
      }

      const existing: ExposureEntry | undefined = await db.exposure_log.get([profileId, word]);

      if (existing) {
        await db.exposure_log.put({
          ...existing,
          count: existing.count + 1,
          lastSeen: now,
          source
        });
      } else {
        const entry: ExposureEntry = {
          profileId,
          word,
          count: 1,
          firstSeen: now,
          lastSeen: now,
          source
        };
        await db.exposure_log.add(entry);
      }
    }
  });
}

/**
 * Возвращает список кандидатов для импорта с количеством встреч >= EXPOSURE_MINING_THRESHOLD,
 * отсортированный по убыванию счетчика.
 */
export async function getMiningCandidates(profileId: string): Promise<ExposureEntry[]> {
  if (typeof window === 'undefined') return [];

  const entries = await db.exposure_log
    .where('profileId')
    .equals(profileId)
    .toArray();

  return entries
    .filter(entry => entry.count >= EXPOSURE_MINING_THRESHOLD)
    .sort((a, b) => b.count - a.count);
}

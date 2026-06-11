import { Candidate } from './ranking';

/**
 * Seeded PRNG generator (mulberry32 algorithm)
 */
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Детерминированное перемешивание массива с использованием Fisher-Yates и seed.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  const rand = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Выбирает страницу кандидатов заданного размера, отдавая приоритет ранее непоказанным видео.
 * Гарантирует минимальное пересечение с предыдущими показами и детерминированность по seed.
 */
export function selectPage(
  pool: Candidate[],
  historyIds: string[],
  pageSize: number,
  seed: number
): { page: Candidate[]; exhausted: boolean } {
  if (pool.length === 0) {
    return { page: [], exhausted: true };
  }

  const historySet = new Set(historyIds);
  const unseen = pool.filter(c => !historySet.has(c.videoId));
  const seen = pool.filter(c => historySet.has(c.videoId));

  // Сортируем ранее показанные видео по возрасту их показа (старейшие первыми)
  seen.sort((a, b) => historyIds.indexOf(a.videoId) - historyIds.indexOf(b.videoId));

  let selected: Candidate[] = [];
  let exhausted = false;

  if (unseen.length >= pageSize) {
    // Непоказанных кандидатов достаточно для формирования полной страницы. Перемешиваем их.
    const shuffled = seededShuffle(unseen, seed);
    selected = shuffled.slice(0, pageSize);
    exhausted = unseen.length === pageSize;
  } else {
    // Непоказанных кандидатов не хватает. Забираем все оставшиеся непоказанные...
    const shuffledUnseen = seededShuffle(unseen, seed);
    selected = [...shuffledUnseen];

    // ...и добираем оставшиеся места из истории, начиная со старейших
    const needed = pageSize - selected.length;
    selected = [...selected, ...seen.slice(0, needed)];
    exhausted = true;
  }

  return { page: selected, exhausted };
}

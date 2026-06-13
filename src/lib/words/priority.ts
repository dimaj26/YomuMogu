import { LocalWord } from '../../core/types';
import { getJlptLevel } from '../jlpt/levels';
import { shareKanji } from './similarity';

/**
 * Возвращает ранг частотности на основе уровня JLPT:
 * N5 -> 0, N4 -> 1, N3 -> 2, N2 -> 3, N1 -> 4, без уровня/тега -> 5.
 * Сначала проверяет теги 'jlpt:n*', затем запрашивает базу jlpt_levels.json.
 */
export function jlptRank(word: LocalWord): number {
  if (word.tags) {
    for (const tag of word.tags) {
      const match = tag.match(/^jlpt:n([1-5])$/i);
      if (match) {
        return 5 - parseInt(match[1], 10);
      }
    }
  }

  const level = getJlptLevel(word.word, word.reading);
  if (level) {
    const match = level.match(/^N([1-5])$/i);
    if (match) {
      return 5 - parseInt(match[1], 10);
    }
  }

  return 5;
}

/**
 * Выполняет стабильную сортировку массива новых слов по возрастанию jlptRank (более частые N5 вначале).
 * Возвращает новый массив без мутации исходного.
 */
export function sortNewWordsByPriority(words: LocalWord[]): LocalWord[] {
  return [...words]
    .map((word, index) => ({ word, index }))
    .sort((a, b) => {
      const rankA = jlptRank(a.word);
      const rankB = jlptRank(b.word);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.index - b.index;
    })
    .map(item => item.word);
}

/**
 * Строит батч слов для изучения заданного лимита, исключая попадание в один батч слов,
 * делящих один и тот же кандзи (интерференция).
 */
export function pickNonInterferingBatch(sorted: LocalWord[], limit: number): LocalWord[] {
  const batch: LocalWord[] = [];
  for (const word of sorted) {
    if (batch.length >= limit) {
      break;
    }
    const hasCollision = batch.some(b => shareKanji(b.word, word.word));
    if (!hasCollision) {
      batch.push(word);
    }
  }
  return batch;
}

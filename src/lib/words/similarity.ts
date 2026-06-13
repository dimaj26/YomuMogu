import { LocalWord } from '../../core/types';

/**
 * Проверяет, делят ли два слова хотя бы один общий иероглиф кандзи.
 * Кандзи определяются как символы в диапазоне Юникода CJK [一-鿿].
 */
export function shareKanji(a: string, b: string): boolean {
  if (!a || !b) return false;
  const kanjiRegex = /[一-鿿]/;
  const aKanji = new Set(a.split('').filter(char => kanjiRegex.test(char)));
  if (aKanji.size === 0) return false;

  for (const char of b) {
    if (aKanji.has(char)) {
      return true;
    }
  }
  return false;
}

/**
 * Находит все неупорядоченные пары слов, которые делят хотя бы один общий кандзи.
 */
export function findSimilarPairs(words: LocalWord[]): Array<[LocalWord, LocalWord]> {
  const pairs: Array<[LocalWord, LocalWord]> = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      if (shareKanji(words[i].word, words[j].word)) {
        pairs.push([words[i], words[j]]);
      }
    }
  }
  return pairs;
}

/**
 * Возвращает до 2 вариантов-дистракторов из слов-партнеров, которые делят кандзи с текущим словом,
 * при условии, что ОБА слова (текущее и партнер) находятся в статусе 'review' или 'mature'.
 */
export function pickDiscriminationDistractors(
  current: LocalWord,
  allWords: LocalWord[],
  field: string
): string[] {
  const isCurrentMature = current.active.status === 'review' || current.active.status === 'mature';
  if (!isCurrentMature) return [];

  const distractors: string[] = [];
  for (const word of allWords) {
    if (word.id === current.id || word.word === current.word) continue;
    
    const isPartnerMature = word.active.status === 'review' || word.active.status === 'mature';
    if (isPartnerMature && shareKanji(current.word, word.word)) {
      const val = (word as any)[field];
      if (typeof val === 'string' && val.trim() !== '') {
        distractors.push(val);
        if (distractors.length >= 2) {
          break;
        }
      }
    }
  }
  return distractors;
}

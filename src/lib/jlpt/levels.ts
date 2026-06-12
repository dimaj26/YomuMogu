import jlptLevels from '../../resources/jlpt_levels.json';

export type JlptLevel = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

interface JlptWordEntry {
  word: string;
  reading?: string;
}

export function getJlptLevel(word: string, reading?: string): JlptLevel | null {
  if (!word) return null;

  // 1. Точное совпадение по kanji/word форме
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1'] as JlptLevel[]) {
    const list = (jlptLevels.levels[level] || []) as JlptWordEntry[];
    const match = list.find(e => e.word === word && (!reading || e.reading === reading));
    if (match) {
      return level;
    }
  }

  // 2. Если совпадения нет и слово записано только каной, ищем по чтению или кане
  const isKanaOnly = !/[\u4e00-\u9faf]/.test(word);
  if (isKanaOnly) {
    for (const level of ['N5', 'N4', 'N3', 'N2', 'N1'] as JlptLevel[]) {
      const list = (jlptLevels.levels[level] || []) as JlptWordEntry[];
      const match = list.find(e => e.word === word || e.reading === word);
      if (match) {
        return level;
      }
    }
  }

  return null;
}

export function toJlptTag(level: JlptLevel): string {
  return `jlpt:${level.toLowerCase()}`;
}

export function mergeJlptTag(tags: string[], level: JlptLevel | string): string[] {
  const newNum = parseJlptNNumber(level);
  if (newNum === null) {
    return tags;
  }

  const newTag = `jlpt:n${newNum}`;
  const existingJlptIndex = tags.findIndex(t => t.startsWith('jlpt:n'));

  if (existingJlptIndex === -1) {
    return [...tags, newTag];
  }

  const existingTag = tags[existingJlptIndex];
  const existingNum = parseJlptNNumber(existingTag);

  if (existingNum === null) {
    const newTags = [...tags];
    newTags[existingJlptIndex] = newTag;
    return newTags;
  }

  // Находим самый простой уровень (чем больше цифра, тем проще: N5 проще N4)
  const easiestNum = Math.max(newNum, existingNum);
  const easiestTag = `jlpt:n${easiestNum}`;

  const newTags = [...tags];
  newTags[existingJlptIndex] = easiestTag;
  return newTags;
}

function parseJlptNNumber(tagOrLevel: string): number | null {
  const m = tagOrLevel.toLowerCase().match(/(?:jlpt:)?n(\d)/);
  if (m) {
    return parseInt(m[1], 10);
  }
  return null;
}

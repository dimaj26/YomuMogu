import { SubtitleSegment } from './parser';

/**
 * Оценивает пригодность сегмента субтитров для караоке-подсветки.
 * Возвращает объект с флагом допуска eligible и текстовой причиной в случае отказа.
 */
export function assessKaraokeQuality(segment: SubtitleSegment): { eligible: boolean; reason: string } {
  // 1. Проверяем наличие слов
  if (!segment.words || segment.words.length === 0) {
    return { eligible: false, reason: 'Поле words отсутствует или пусто' };
  }

  // 2. Проверяем минимальное количество слов (не менее 3)
  if (segment.words.length < 3) {
    return { eligible: false, reason: 'В сегменте меньше 3 слов' };
  }

  // 3. Проверяем долю слов с ненулевым оффсетом (должно быть >= 0.8)
  let positiveOffsets = 0;
  for (const w of segment.words) {
    if (w.offsetMs > 0) {
      positiveOffsets++;
    }
  }

  const share = positiveOffsets / segment.words.length;
  if (share < 0.8) {
    return { eligible: false, reason: 'доля offsetMs > 0 ниже 0.8' };
  }

  // 4. Проверяем монотонность возрастания меток и границы длительности
  const maxAllowedOffset = segment.duration * 1000;
  let lastOffset = -1;

  for (const w of segment.words) {
    if (w.offsetMs < lastOffset) {
      return { eligible: false, reason: 'Нарушена монотонность временных меток слов' };
    }
    if (w.offsetMs > maxAllowedOffset) {
      return { eligible: false, reason: 'Временная метка слова выходит за рамки длительности сегмента' };
    }
    lastOffset = w.offsetMs;
  }

  return { eligible: true, reason: '' };
}

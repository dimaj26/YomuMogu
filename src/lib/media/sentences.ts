import { SubtitleSegment } from './parser';

const TERMINAL_PUNCTUATION = new Set(['。', '？', '！', '?', '!']);

/**
 * Группирует последовательные сегменты в предложения до тех пор, пока:
 * 1. Последний символ склеенного текста не станет терминальным (。？！?!)
 * 2. Либо длина склеенного текста не превысит 90 символов
 * 3. Либо общая длительность склеенного фрагмента не превысит 15 секунд
 * 
 * При склейке пословные тайминги (`words`) пересчитываются относительно времени начала предложения.
 */
export function regroupIntoSentences(segments: SubtitleSegment[]): SubtitleSegment[] {
  if (!segments || segments.length === 0) return [];

  const result: SubtitleSegment[] = [];
  let currentGroup: SubtitleSegment[] = [];

  for (const seg of segments) {
    if (currentGroup.length === 0) {
      currentGroup.push(seg);
    } else {
      const first = currentGroup[0];
      
      // Вычисляем суммарную длину текста, если добавить текущий сегмент
      const combinedText = currentGroup.map(g => g.text).join('') + seg.text;
      
      // Вычисляем суммарную длительность: (текущий.start + текущий.duration) - первый.start
      const combinedDuration = (seg.start + seg.duration) - first.start;

      // Проверяем лимиты (90 символов, 15 секунд)
      if (combinedText.length > 90 || combinedDuration > 15) {
        // Лимиты превышены -> закрываем текущую группу и отправляем на слияние
        result.push(mergeGroup(currentGroup));
        currentGroup = [seg];
      } else {
        currentGroup.push(seg);
      }
    }

    // Проверяем окончание последнего добавленного сегмента на терминальный знак препинания
    const lastSeg = currentGroup[currentGroup.length - 1];
    const lastChar = lastSeg.text ? lastSeg.text.slice(-1) : '';
    if (TERMINAL_PUNCTUATION.has(lastChar)) {
      result.push(mergeGroup(currentGroup));
      currentGroup = [];
    }
  }

  // Закрываем оставшуюся группу, если она не пуста
  if (currentGroup.length > 0) {
    result.push(mergeGroup(currentGroup));
  }

  return result;
}

/**
 * Вспомогательная функция для слияния группы сегментов в один сегмент
 */
function mergeGroup(group: SubtitleSegment[]): SubtitleSegment {
  if (group.length === 1) return group[0];

  const first = group[0];
  const last = group[group.length - 1];
  
  // Склеиваем тексты напрямую
  const text = group.map(g => g.text).join('');
  const start = first.start;
  const duration = Math.round(((last.start + last.duration) - start) * 1000) / 1000;
  
  // Объединяем и ребейзим пословные тайминги
  let words: Array<{ text: string; offsetMs: number }> | undefined = undefined;
  
  // Проверяем, есть ли хотя бы у одного сегмента в группе массив слов
  const hasWords = group.some(g => g.words && g.words.length > 0);
  if (hasWords) {
    words = [];
    for (const g of group) {
      const timeOffsetMs = Math.round((g.start - start) * 1000);
      if (g.words) {
        for (const w of g.words) {
          words.push({
            text: w.text,
            offsetMs: w.offsetMs + timeOffsetMs
          });
        }
      } else {
        // Если у сегмента нет слов, добавляем плейсхолдер с текстом всего сегмента
        words.push({
          text: g.text,
          offsetMs: timeOffsetMs
        });
      }
    }
  }

  return {
    start,
    duration,
    text,
    ...(words ? { words } : {}),
    ...(first.source ? { source: first.source } : {})
  };
}

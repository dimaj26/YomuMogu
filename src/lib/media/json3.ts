import { SubtitleSegment } from './parser';

/**
 * Парсит timedtext JSON3 от YouTube в формат SubtitleSegment[] приложения YomuMogu.
 * 
 * @param data - Ответ timedtext в формате JSON3 (содержит events)
 * @returns Массив сегментов субтитров с пословными таймингами
 */
export function parseJson3ToSegments(data: any): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  if (data && Array.isArray(data.events)) {
    for (const ev of data.events) {
      if (!ev.segs) continue;
      
      const text = ev.segs.map((s: any) => s.utf8).join('').trim();
      if (!text) continue;

      // Извлекаем пословные тайминги с относительным сдвигом в миллисекундах
      const words = ev.segs.map((s: any) => ({
        text: s.utf8,
        offsetMs: s.tOffsetMs || 0
      }));

      segments.push({
        start: ev.tStartMs / 1000,
        duration: (ev.dDurationMs || 0) / 1000,
        text: text,
        words: words
      });
    }
  }
  return segments;
}

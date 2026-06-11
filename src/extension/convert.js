/**
 * Конвертирует структуру timedtext JSON3 от YouTube в формат SubtitleSegment[] приложения YomuMogu.
 * 
 * @param {object} data - Ответ timedtext в формате JSON3 (содержит events)
 * @returns {Array<{start: number, duration: number, text: string}>} Массив сегментов субтитров
 */
export function convertJson3ToSegments(data) {
  const segments = [];
  if (data && Array.isArray(data.events)) {
    for (const ev of data.events) {
      if (!ev.segs) continue;
      const text = ev.segs.map(s => s.utf8).join('').trim();
      if (!text) continue;

      const words = ev.segs.map(s => ({
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

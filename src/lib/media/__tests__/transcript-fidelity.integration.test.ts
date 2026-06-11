import { describe, it, expect } from 'vitest';
import { getYoutubeTranscriptSegments } from '../youtube';
import mediaTranscripts from '../../../resources/media_transcripts.json';

// Функция для нормализации текста субтитров (удаление пробелов, знаков препинания) для сравнения
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()？!。、\s]/g, '');
}

describe('Transcript Fidelity Integration', () => {
  it('pregenerated транскрипт соответствует реальным субтитрам видео (совпадение ≥60%, дрейф ≤3с)', async (context) => {
    try {
      // Проверяем доступность YouTube, чтобы отловить 429
      const testRes = await fetch('https://www.youtube.com/watch?v=Jnea4HbYIso&hl=ja');
      if (testRes.status === 429) {
        console.warn('Skipping integration test: YouTube IP rate-limit (429)');
        context.skip();
        return;
      }
    } catch (e) {}

    const entries = Object.entries(mediaTranscripts);
    expect(entries.length).toBeGreaterThan(0);

    for (const [videoId, data] of entries) {
      console.log(`Проверка видео ${videoId}...`);

      // (a) Проверяем наличие метаданных provenance
      expect(data).toHaveProperty('generatedAt');
      expect((data as any).generatedAt).not.toBeUndefined();
      expect(Array.isArray((data as any).segments)).toBe(true);

      const pregeneratedSegments = (data as any).segments;
      expect(pregeneratedSegments.length).toBeGreaterThan(0);

      // Скачиваем реальные субтитры
      let scrapedSegments;
      try {
        scrapedSegments = await getYoutubeTranscriptSegments(videoId);
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.toLowerCase().includes('too many requests')) {
          console.warn('Skipping integration test due to YouTube 429 IP rate-limit during execution');
          context.skip();
          return;
        }
        throw new Error(`Не удалось получить реальные субтитры для ${videoId}: ${err.message}`);
      }

      expect(scrapedSegments.length).toBeGreaterThan(0);

      // Сравниваем первые 10 сегментов index-by-index
      const limit = Math.min(10, pregeneratedSegments.length, scrapedSegments.length);
      let matches = 0;

      for (let i = 0; i < limit; i++) {
        const preSeg = pregeneratedSegments[i];
        const scrapedSeg = scrapedSegments[i];

        const normalizedPreText = normalizeText(preSeg.text);
        const normalizedScrapedText = normalizeText(scrapedSeg.text);

        const textMatches = normalizedScrapedText.includes(normalizedPreText) || normalizedPreText.includes(normalizedScrapedText);
        if (textMatches) {
          // Проверяем дрейф времени
          const drift = Math.abs(preSeg.start - scrapedSeg.start);
          if (drift <= 3) {
            matches++;
          }
        }
      }

      // (b) Должно совпадать не менее 60% сегментов из первой десятки
      const matchPercentage = (matches / limit) * 100;
      console.log(`Видео ${videoId}: процент совпадения = ${matchPercentage}%`);
      expect(matchPercentage).toBeGreaterThanOrEqual(60);
    }
  });
});

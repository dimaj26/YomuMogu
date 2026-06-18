/**
 * Display-time очистка субтитров от служебных скобочных аннотаций
 * (звуковые теги авто-сабов YouTube: [音楽], [拍手], 【音楽】, [Music] и т.п.).
 *
 * ВАЖНО (Prime Directive [PL-8.8]): хранимые `segments` НЕ мутируются — эти
 * функции применяются только к отображаемым копиям текста и массива слов.
 * Музыкальные ноты `♪` и круглые скобки `（）/()` (чтения/обычный контент)
 * НЕ трогаются — срезаются только квадратные `[…]` и угловые `【…】` теги.
 */

// Регэксп скобочных аннотаций: [ ... ] или 【 ... 】 (без вложенности)
const ANNOTATION_RE = /[\[【][^\]】]*[\]】]/g;

/**
 * Срезает скобочные звуковые аннотации из текста сегмента, схлопывает
 * образовавшиеся лишние пробелы и тримит результат.
 */
export function stripCaptionAnnotations(text: string): string {
  if (!text) return '';
  return text.replace(ANNOTATION_RE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Чистит локальную копию массива слов сегмента: слова, которые целиком
 * являются аннотацией (после среза стали пустыми), выбрасываются. Это держит
 * `totalChars` в `computeFillFraction` согласованным с речевыми токенами,
 * полученными из уже-стрипнутого текста (синхронность караоке-фронта).
 */
export function stripAnnotationWords(
  words?: Array<{ text: string; offsetMs: number }>
): Array<{ text: string; offsetMs: number }> {
  if (!words || words.length === 0) return [];
  const result: Array<{ text: string; offsetMs: number }> = [];
  for (const w of words) {
    const cleaned = stripCaptionAnnotations(w.text);
    if (cleaned === '') continue; // чисто-аннотационное слово — выбрасываем
    result.push({ text: cleaned, offsetMs: w.offsetMs });
  }
  return result;
}

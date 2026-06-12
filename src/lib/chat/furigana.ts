export interface WordIntervalMap {
  [word: string]: number;
}

/**
 * Применяет постепенное угасание фуриганы на основе интервалов FSRS для слов.
 *
 * @param html HTML-строка, содержащая теги <ruby>
 * @param map Карта интервалов (слово -> интервал в днях)
 * @returns HTML-строка с добавленными классами rtFade/rtHidden для тегов rt
 */
export function applyGradualFurigana(html: string, map: WordIntervalMap): string {
  if (!html) return html;

  return html.replace(/<ruby>([^<]+)<rt>([^<]+)<\/rt><\/ruby>/g, (match, base, reading) => {
    const interval = map[base];
    if (interval === undefined || interval < 3) {
      return match;
    }
    if (interval >= 3 && interval < 21) {
      return `<ruby>${base}<rt class="rtFade">${reading}</rt></ruby>`;
    }
    // interval >= 21
    return `<ruby>${base}<rt class="rtHidden">${reading}</rt></ruby>`;
  });
}

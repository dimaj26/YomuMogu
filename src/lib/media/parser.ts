/**
 * Парсит содержимое файлов SRT или VTT, очищая их от таймстампов и индексов
 */
export function parseSrtOrVtt(content: string): string {
  if (!content) return '';
  
  const lines = content.replace(/\r/g, '').split('\n');
  const textSegments: string[] = [];
  
  // Регулярное выражение для распознавания таймлингов: "00:00:01,000 --> 00:00:04,000" или "00:00:01.000 --> 00:00:04.000"
  const timestampRegex = /\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/;
  
  for (let line of lines) {
    line = line.trim();
    
    // Пропускаем метаданные WEBVTT, пустые строки, cue индексы и таймстампы
    if (!line) continue;
    if (line === 'WEBVTT') continue;
    if (/^\d+$/.test(line)) continue;
    if (timestampRegex.test(line)) continue;
    
    textSegments.push(line);
  }
  
  return textSegments.join('\n');
}

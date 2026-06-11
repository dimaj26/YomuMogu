/**
 * Структура временного сегмента субтитров
 */
export interface SubtitleSegment {
  start: number;     // Время начала в секундах
  duration: number;  // Длительность в секундах
  text: string;      // Текст субтитра
  words?: Array<{ text: string; offsetMs: number }>; // Пословные тайминги (json3)
  source?: 'pregenerated' | 'scraped' | 'extension' | 'upload'; // Источник сегмента
}

/**
 * Преобразует строковый таймстамп формата HH:MM:SS,mmm или MM:SS.mmm в секунды (float)
 */
function parseTimestamp(timeStr: string): number {
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');
  
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  
  if (parts.length === 3) {
    hours = parseFloat(parts[0]);
    minutes = parseFloat(parts[1]);
    seconds = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    minutes = parseFloat(parts[0]);
    seconds = parseFloat(parts[1]);
  } else {
    seconds = parseFloat(parts[0]) || 0;
  }
  
  return hours * 3600 + minutes * 60 + seconds;
}

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

/**
 * Парсит SRT/VTT контент на отдельные временные сегменты (для интерактивного плеера)
 */
export function parseSubtitlesToSegments(content: string): SubtitleSegment[] {
  if (!content) return [];
  
  // Разделяем по двойным переносам строк, чтобы получить блоки
  const blocks = content.replace(/\r/g, '').split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];
  
  // Распознает таймлинги, поддерживая 2- или 3-разрядные часы/минуты
  const timestampRegex = /(\d{2}:\d{2}:\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})/;
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeMatch = null;
    let timeLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(timestampRegex);
      if (match) {
        timeMatch = match;
        timeLineIndex = i;
        break;
      }
    }
    
    if (timeMatch && timeLineIndex !== -1) {
      const start = parseTimestamp(timeMatch[1]);
      const end = parseTimestamp(timeMatch[2]);
      const duration = Math.round(Math.max(0, end - start) * 1000) / 1000;
      
      // Все строки после строки с таймстампом соединяются в текст
      const textLines = lines.slice(timeLineIndex + 1)
        .map(l => l.trim())
        .filter(l => l && l !== 'WEBVTT');
        
      if (textLines.length > 0) {
        segments.push({
          start,
          duration,
          text: textLines.join('\n')
        });
      }
    }
  }
  
  return segments;
}

/**
 * Нормализует временные сегменты субтитров.
 * Сортирует по времени начала.
 * Устанавливает длительность sticky-сегментов до начала следующего сегмента.
 * Ограничивает длительность перекрывающихся сегментов.
 * Для последнего сегмента (или единственного) рассчитывает длительность на основе длины текста с ограничением.
 */
export function normalizeSegments(segments: SubtitleSegment[]): SubtitleSegment[] {
  if (!segments || segments.length === 0) return [];

  // Сортируем копию по возрастанию времени начала
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const normalized: SubtitleSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    let duration = current.duration;

    if (next) {
      // Если длительность <= 0 или заходит на следующий сегмент, обрезаем ее до старта следующего
      if (duration <= 0 || (current.start + duration) > next.start) {
        duration = Math.max(0, next.start - current.start);
      }
    } else {
      // Для последнего сегмента
      const textLen = current.text ? current.text.length : 0;
      const textDurationCap = Math.min(textLen / 6, 10);
      duration = Math.max(duration, textDurationCap);
    }

    normalized.push({
      ...current,
      duration: Math.round(duration * 1000) / 1000
    });
  }

  return normalized;
}

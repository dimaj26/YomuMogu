import { logger } from '../logger';
import { SubtitleSegment } from './parser';

/**
 * Извлекает ID видео из различных форматов ссылок YouTube
 */
export function extractYoutubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Декодирует базовые HTML-сущности в тексте субтитров
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Скачивает и парсит XML транскрипта по списку дорожек
 */
async function fetchAndParseTranscriptXml(tracks: any[], videoId: string): Promise<string> {
  // Ищем сначала точную японскую дорожку (ja), затем автоперевод/автогенерацию (ja или a.ja)
  const jaTrack = tracks.find(t => t.languageCode === 'ja') || 
                  tracks.find(t => t.languageCode?.startsWith('ja')) ||
                  tracks.find(t => t.vssId?.includes('.ja'));
                  
  if (!jaTrack || !jaTrack.baseUrl) {
    throw new Error('Японская дорожка субтитров (ja) не найдена для этого видео');
  }
  
  logger.info(`[YouTube Scraper] Запрос XML субтитров по ссылке для видео ${videoId}`);
  
  const xmlRes = await fetch(jaTrack.baseUrl);
  if (!xmlRes.ok) {
    throw new Error(`Не удалось загрузить XML субтитров: ${xmlRes.statusText}`);
  }
  
  const xmlText = await xmlRes.text();
  
  // Регулярным выражением вытаскиваем текст из тегов <text>
  const textMatches = xmlText.matchAll(/<text[^>]*>(.*?)<\/text>/g);
  const segments: string[] = [];
  
  for (const match of textMatches) {
    if (match[1]) {
      const decoded = decodeHtmlEntities(match[1]);
      segments.push(decoded.trim());
    }
  }
  
  if (segments.length === 0) {
    throw new Error('В файле XML субтитров не обнаружено текстовых сегментов');
  }
  
  return segments.join('\n');
}

/**
 * Скачивает и парсит XML транскрипта на отдельные временные сегменты
 */
async function fetchAndParseTranscriptXmlToSegments(tracks: any[], videoId: string): Promise<SubtitleSegment[]> {
  const jaTrack = tracks.find(t => t.languageCode === 'ja') || 
                  tracks.find(t => t.languageCode?.startsWith('ja')) ||
                  tracks.find(t => t.vssId?.includes('.ja'));
                  
  if (!jaTrack || !jaTrack.baseUrl) {
    throw new Error('Японская дорожка субтитров (ja) не найдена для этого видео');
  }
  
  logger.info(`[YouTube Scraper] Запрос XML субтитров по ссылке для видео ${videoId} (сегменты)`);
  
  const xmlRes = await fetch(jaTrack.baseUrl);
  if (!xmlRes.ok) {
    throw new Error(`Не удалось загрузить XML субтитров: ${xmlRes.statusText}`);
  }
  
  const xmlText = await xmlRes.text();
  
  // Регулярным выражением вытаскиваем start, dur и текст
  const textMatches = xmlText.matchAll(/<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>(.*?)<\/text>/g);
  const segments: SubtitleSegment[] = [];
  
  for (const match of textMatches) {
    const start = parseFloat(match[1]) || 0;
    const duration = parseFloat(match[2]) || 0;
    const text = match[3] ? decodeHtmlEntities(match[3]).trim() : '';
    
    if (text) {
      segments.push({ start, duration, text });
    }
  }
  
  return segments;
}

/**
 * Получает текстовые субтитры для видео YouTube по его ID
 */
export async function getYoutubeTranscript(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}&hl=ja`;
  
  logger.info(`[YouTube Scraper] Скачивание страницы видео ${videoId} для поиска субтитров`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  };
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить страницу YouTube: ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Проверяем доступность видео на странице
  if (html.includes('player-unavailable') || html.includes('playabilityStatus":{"status":"ERROR"') || html.includes('playabilityStatus":{"status":"UNPLAYABLE"') || html.includes('playabilityStatus":{"status":"LOGIN_REQUIRED"')) {
    throw new Error('Видео недоступно или удалено (ошибка воспроизведения YouTube)');
  }
  
  // Вариант 1: Ищем captionTracks in JSON-конфигурации страницы
  const captionTracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
  if (captionTracksMatch) {
    try {
      const tracks = JSON.parse(captionTracksMatch[1]);
      if (Array.isArray(tracks) && tracks.length > 0) {
        return await fetchAndParseTranscriptXml(tracks, videoId);
      }
    } catch (err: any) {
      logger.warn('[YouTube Scraper] Ошибка разбора captionTracks, пробуем ytInitialPlayerResponse:', err);
    }
  }
  
  // Вариант 2: Ищем ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/);
  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && Array.isArray(tracks)) {
        return await fetchAndParseTranscriptXml(tracks, videoId);
      }
    } catch (e) {
      logger.warn('[YouTube Scraper] Ошибка парсинга ytInitialPlayerResponse:', e);
    }
  }
  
  throw new Error('На этой странице YouTube не найдено доступных субтитров');
}

/**
 * Получает временные сегменты субтитров для видео YouTube по его ID
 */
export async function getYoutubeTranscriptSegments(videoId: string): Promise<SubtitleSegment[]> {
  const url = `https://www.youtube.com/watch?v=${videoId}&hl=ja`;
  
  logger.info(`[YouTube Scraper] Скачивание страницы видео ${videoId} для поиска субтитров (сегменты)`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  };
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить страницу YouTube: ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Проверяем доступность видео на странице
  if (html.includes('player-unavailable') || html.includes('playabilityStatus":{"status":"ERROR"') || html.includes('playabilityStatus":{"status":"UNPLAYABLE"') || html.includes('playabilityStatus":{"status":"LOGIN_REQUIRED"')) {
    throw new Error('Видео недоступно или удалено (ошибка воспроизведения YouTube)');
  }
  
  // Вариант 1: Ищем captionTracks
  const captionTracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
  if (captionTracksMatch) {
    try {
      const tracks = JSON.parse(captionTracksMatch[1]);
      if (Array.isArray(tracks) && tracks.length > 0) {
        return await fetchAndParseTranscriptXmlToSegments(tracks, videoId);
      }
    } catch (err: any) {
      logger.warn('[YouTube Scraper] Ошибка разбора captionTracks для сегментов, пробуем ytInitialPlayerResponse:', err);
    }
  }
  
  // Вариант 2: Ищем ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/);
  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && Array.isArray(tracks)) {
        return await fetchAndParseTranscriptXmlToSegments(tracks, videoId);
      }
    } catch (e) {
      logger.warn('[YouTube Scraper] Ошибка парсинга ytInitialPlayerResponse для сегментов:', e);
    }
  }
  
  throw new Error('На этой странице YouTube не найдено доступных субтитров');
}

import { logger } from '../logger';
import { SubtitleSegment } from './parser';
import { parseJson3ToSegments } from './json3';
import { getCachedAvailability, setCachedAvailability, getCachedTranscript, setCachedTranscript } from './cache';

// Глобальный кулдаун при 429 ошибке (IP rate-limit)
let rateLimitResetTime = 0;

function checkRateLimit() {
  if (Date.now() < rateLimitResetTime) {
    const remainingSec = Math.ceil((rateLimitResetTime - Date.now()) / 1000);
    throw new Error(`Too Many Requests (IP rate-limit активен, осталось ${remainingSec} сек)`);
  }
}

function handle429Error(responseHeaders?: Headers) {
  let delaySec = 60; // дефолт 1 минута
  if (responseHeaders) {
    const retryAfterHeader = responseHeaders.get('Retry-After');
    if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed) && parsed > 0) {
        delaySec = parsed;
      }
    }
  }
  rateLimitResetTime = Date.now() + delaySec * 1000;
  logger.error(`[YouTube Scraper] Получен статус 429 Too Many Requests. Кулдаун установлен на ${delaySec} сек.`);
}

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

// Дорожка субтитров из ответа InnerTube Player API (поля, используемые при выборе ja-дорожки)
interface CaptionTrack {
  languageCode?: string;
  kind?: string;
  vssId?: string;
  baseUrl?: string;
}

/**
 * Вспомогательная функция для получения списка дорожек субтитров и сессионных кук через InnerTube API
 */
async function getTracksAndCookies(videoId: string): Promise<{ tracks: CaptionTrack[]; cookieString: string }> {
  checkRateLimit();
  const url = `https://www.youtube.com/watch?v=${videoId}&hl=ja`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  };

  logger.info(`[YouTube Scraper] Скачивание страницы видео ${videoId} для получения кук`);
  const response = await fetch(url, { headers });
  if (response.status === 429) {
    handle429Error(response.headers);
    throw new Error('Too Many Requests');
  }
  if (!response.ok) {
    throw new Error(`Не удалось загрузить страницу YouTube: ${response.statusText}`);
  }
  const html = await response.text();

  // Проверяем доступность видео
  if (
    html.includes('player-unavailable') ||
    html.includes('playabilityStatus:{"status":"ERROR"') ||
    html.includes('playabilityStatus:{"status":"UNPLAYABLE"') ||
    html.includes('playabilityStatus:{"status":"LOGIN_REQUIRED"')
  ) {
    throw new Error('Видео недоступно или удалено (ошибка воспроизведения YouTube)');
  }

  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');

  logger.info(`[YouTube Scraper] Запрос к InnerTube Player API для видео ${videoId}`);
  const innerTubeKey = process.env.YOUTUBE_INNERTUBE_KEY || '';
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${innerTubeKey}`;
  
  checkRateLimit();
  const playerRes = await fetch(playerUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cookie': cookieString
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38'
        }
      },
      videoId: videoId
    })
  });

  if (playerRes.status === 429) {
    handle429Error(playerRes.headers);
    throw new Error('Too Many Requests');
  }
  if (!playerRes.ok) {
    throw new Error(`Не удалось вызвать player API: ${playerRes.statusText}`);
  }

  const playerJson = await playerRes.json();
  const tracks = playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  return { tracks, cookieString };
}

/**
 * Скачивает и парсит XML транскрипта по списку дорожек с использованием кук
 */
async function fetchAndParseTranscriptXml(tracks: CaptionTrack[], videoId: string, cookieString: string): Promise<string> {
  const jaTrack = tracks.find(t => t.languageCode === 'ja' && t.kind !== 'asr') ||
                  tracks.find(t => t.languageCode === 'ja' || t.languageCode?.startsWith('ja') || t.vssId?.includes('.ja'));
                  
  if (!jaTrack || !jaTrack.baseUrl) {
    throw new Error('Японская дорожка субтитров (ja) не найдена для этого видео');
  }
  
  logger.info(`[YouTube Scraper] Запрос XML субтитров по ссылке для видео ${videoId}`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  };

  checkRateLimit();
  const xmlRes = await fetch(jaTrack.baseUrl, {
    headers: {
      ...headers,
      'Cookie': cookieString
    }
  });
  if (xmlRes.status === 429) {
    handle429Error(xmlRes.headers);
    throw new Error('Too Many Requests');
  }
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
 * Скачивает и парсит транскрипт с использованием кук (пытается JSON3 с пословными таймингами, при неудаче фолбэк на XML)
 */
async function fetchAndParseTranscriptToSegments(tracks: CaptionTrack[], videoId: string, cookieString: string): Promise<SubtitleSegment[]> {
  const jaTrack = tracks.find(t => t.languageCode === 'ja' && t.kind !== 'asr') ||
                  tracks.find(t => t.languageCode === 'ja' || t.languageCode?.startsWith('ja') || t.vssId?.includes('.ja'));
                  
  if (!jaTrack || !jaTrack.baseUrl) {
    throw new Error('Японская дорожка субтитров (ja) не найдена для этого видео');
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  };

  // 1. Пробуем получить JSON3 для извлечения пословных таймингов
  try {
    const timedtextParsed = new URL(jaTrack.baseUrl);
    timedtextParsed.searchParams.set('fmt', 'json3');
    const json3Url = timedtextParsed.toString();

    logger.info(`[YouTube Scraper] Попытка получения субтитров в формате JSON3 для видео ${videoId}`);
    checkRateLimit();
    const json3Res = await fetch(json3Url, {
      headers: {
        ...headers,
        'Cookie': cookieString
      }
    });
    if (json3Res.status === 429) {
      handle429Error(json3Res.headers);
      throw new Error('Too Many Requests');
    }
    if (json3Res.ok) {
      const jsonData = await json3Res.json();
      const segments = parseJson3ToSegments(jsonData);
      if (segments && segments.length > 0) {
        logger.info(`[YouTube Scraper] Успешно получено ${segments.length} сегментов в формате JSON3 для видео ${videoId}`);
        return segments;
      }
    }
    logger.warn(`[YouTube Scraper] Ответ JSON3 пустой или невалидный для видео ${videoId}, переключаемся на XML`);
  } catch (err) {
    logger.warn(`[YouTube Scraper] Ошибка загрузки JSON3 для видео ${videoId}: ${err instanceof Error ? err.message : String(err)}. Используем XML.`);
  }

  // 2. Фолбэк на XML-версию
  logger.info(`[YouTube Scraper] Запрос XML субтитров по ссылке для видео ${videoId} (сегменты)`);
  
  checkRateLimit();
  const xmlRes = await fetch(jaTrack.baseUrl, {
    headers: {
      ...headers,
      'Cookie': cookieString
    }
  });
  if (xmlRes.status === 429) {
    handle429Error(xmlRes.headers);
    throw new Error('Too Many Requests');
  }
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
  
  logger.info(`[YouTube Scraper] Успешно получено ${segments.length} сегментов в формате XML для видео ${videoId}`);
  return segments;
}

/**
 * Получает текстовые субтитры для видео YouTube по его ID
 */
export async function getYoutubeTranscript(videoId: string): Promise<string> {
  const { tracks, cookieString } = await getTracksAndCookies(videoId);
  return await fetchAndParseTranscriptXml(tracks, videoId, cookieString);
}

/**
 * Получает временные сегменты субтитров для видео YouTube по его ID
 */
export async function getYoutubeTranscriptSegments(videoId: string): Promise<SubtitleSegment[]> {
  const cached = getCachedTranscript(videoId);
  if (cached !== undefined) {
    logger.info(`[YouTube Cache] Субтитры получены из кэша для видео ${videoId}`);
    return cached;
  }
  const { tracks, cookieString } = await getTracksAndCookies(videoId);
  const segments = await fetchAndParseTranscriptToSegments(tracks, videoId, cookieString);
  setCachedTranscript(videoId, segments);
  return segments;
}

/**
 * Проверяет наличие японских субтитров у видео по его ID
 */
export async function hasJapaneseCaptions(videoId: string): Promise<boolean> {
  const cached = getCachedAvailability(videoId);
  if (cached !== undefined) {
    logger.info(`[YouTube Cache] Доступность субтитров получена из кэша для ${videoId}: ${cached}`);
    return cached;
  }
  try {
    const { tracks } = await getTracksAndCookies(videoId);
    const jaTrack = tracks.find(t => t.languageCode === 'ja' && t.kind !== 'asr') ||
                    tracks.find(t => t.languageCode === 'ja' || t.languageCode?.startsWith('ja') || t.vssId?.includes('.ja'));
    const result = !!jaTrack;
    setCachedAvailability(videoId, result);
    return result;
  } catch (e) {
    logger.warn(`[YouTube Captions Check] Ошибка проверки субтитров для ${videoId}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}


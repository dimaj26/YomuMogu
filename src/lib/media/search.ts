import { logger } from '../logger';
import { SubtitleSegment } from './parser';

export interface Candidate {
  videoId: string;
  title: string;
  channel: string;
  description?: string;
  durationSec?: number;
}

export interface SearchResult {
  candidates: Candidate[];
  continuation: string | null;
}

/**
 * Парсит объект JSON (из ytInitialData или InnerTube Search API) для извлечения кандидатов и continuation токена.
 */
export function parseSearchResults(data: any): SearchResult {
  const candidates: Candidate[] = [];
  let continuation: string | null = null;

  if (!data) {
    return { candidates, continuation };
  }

  try {
    // 1. Извлекаем список рендереров контента
    let contents: any[] = [];
    
    // Путь для ytInitialData или InnerTube API
    const sectionList = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer ||
                        data.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction?.continuationItems ||
                        data.continuationContents?.sectionListContinuation;

    const sections = sectionList?.contents || sectionList || [];

    for (const section of sections) {
      if (section.itemSectionRenderer) {
        const items = section.itemSectionRenderer.contents || [];
        for (const item of items) {
          if (item.videoRenderer) {
            const vr = item.videoRenderer;
            const videoId = vr.videoId;
            const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || '';
            const channel = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || '';
            const description = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text || 
                                vr.descriptionSnippet?.runs?.[0]?.text || '';
            const lengthText = vr.lengthText?.simpleText || '';

            // Парсим длительность в секунды
            let durationSec = 0;
            if (lengthText) {
              const parts = lengthText.split(':').map(Number);
              if (parts.length === 3) {
                durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              } else if (parts.length === 2) {
                durationSec = parts[0] * 60 + parts[1];
              } else if (parts.length === 1) {
                durationSec = parts[0];
              }
            }

            if (videoId && title) {
              candidates.push({ videoId, title, channel, description, durationSec });
            }
          }
        }
      } else if (section.continuationItemRenderer) {
        continuation = section.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token || null;
      }
    }

    // Если continuation не нашелся в секциях, проверим отдельный блок continuations
    if (!continuation && sectionList?.continuations) {
      continuation = sectionList.continuations[0]?.nextContinuationData?.continuation || null;
    }
  } catch (error: any) {
    logger.warn(`[YouTube Search] Ошибка при парсинге результатов поиска: ${error.message}`);
  }

  return { candidates, continuation };
}

/**
 * Выполняет запрос к YouTube Search.
 * Поддерживает пагинацию через continuation.
 */
export async function fetchYoutubeSearch(query: string, continuation?: string): Promise<SearchResult> {
  const apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // Стандартный ключ InnerTube
  const url = `https://www.youtube.com/youtubei/v1/search?key=${apiKey}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  };

  const body: any = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240308.00.00',
        hl: 'ja',
        gl: 'JP'
      }
    }
  };

  if (continuation) {
    body.continuation = continuation;
    logger.info(`[YouTube Search] Запрос следующей страницы результатов по токену: ${continuation.substring(0, 20)}...`);
  } else {
    body.query = query;
    logger.info(`[YouTube Search] Запрос первой страницы результатов по запросу: "${query}"`);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`InnerTube Search API returned status ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return parseSearchResults(json);
  } catch (error: any) {
    logger.error(`[YouTube Search] Ошибка при запросе к YouTube Search API: ${error.message}`);
    // Возвращаем пустой результат при ошибке, чтобы не ломать цепочку
    return { candidates: [], continuation: null };
  }
}

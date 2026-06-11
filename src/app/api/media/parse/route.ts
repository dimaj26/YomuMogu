import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCsrf } from '@/lib/csrf';
import { extractYoutubeVideoId, getYoutubeTranscriptSegments } from '@/lib/media/youtube';
import { parseSrtOrVtt, parseSubtitlesToSegments, normalizeSegments, type SubtitleSegment } from '@/lib/media/parser';
import { regroupIntoSentences } from '@/lib/media/sentences';
import mediaTranscripts from '@/resources/media_transcripts.json';

interface CacheEntry {
  lemmas: string[];
  segments: SubtitleSegment[];
}

// Простой серверный кэш в оперативной памяти (максимум 100 видео)
const MAX_CACHE_SIZE = 100;
const lemmasCache = new Map<string, CacheEntry>();

function addToCache(key: string, value: CacheEntry) {
  if (lemmasCache.size >= MAX_CACHE_SIZE) {
    // Удаляем первый вставленный элемент (простой FIFO клинап)
    const firstKey = lemmasCache.keys().next().value;
    if (firstKey !== undefined) {
      lemmasCache.delete(firstKey);
    }
  }
  lemmasCache.set(key, value);
}

export async function POST(request: NextRequest) {
  // Защита от CSRF
  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Заблокирован неавторизованный запрос к /api/media/parse');
    return NextResponse.json({ error: 'Доступ запрещен (CSRF)' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { url, srtText } = body;

    if (!url && !srtText) {
      logger.warn('[API] Невалидный запрос к /api/media/parse: отсутствуют и url, и srtText');
      return NextResponse.json(
        { error: 'Необходимо передать либо "url" (YouTube), либо "srtText" (субтитры)' },
        { status: 400 }
      );
    }

    const tokenizerUrl = process.env.TOKENIZER_URL || 'http://127.0.0.1:8000';
    const tokenizerApiKey = process.env.TOKENIZER_API_KEY || 'yomumogu-secret-token';
    let textToTokenize = '';
    let cacheKey = '';
    let segments: SubtitleSegment[] = [];

    if (url) {
      const videoId = extractYoutubeVideoId(url);
      if (!videoId) {
        logger.warn(`[API] Неверный формат URL YouTube: ${url}`);
        return NextResponse.json(
          { error: 'Поддерживаются только корректные ссылки на видео YouTube' },
          { status: 400 }
        );
      }

      cacheKey = `yt:${videoId}`;
      
      // Проверяем наличие в кэше
      if (lemmasCache.has(cacheKey)) {
        logger.info(`[API] Возврат лемм и сегментов из кэша для видео ${videoId}`);
        const cached = lemmasCache.get(cacheKey)!;
        return NextResponse.json({
          success: true,
          lemmas: cached.lemmas,
          segments: cached.segments,
          cached: true
        });
      }

      // Проверяем, есть ли предсгенерированные субтитры для этого видео в медиатеке
      const pregenerated = mediaTranscripts[videoId as keyof typeof mediaTranscripts];
      if (pregenerated) {
        logger.info(`[API] Использование предсгенерированных субтитров из JSON для видео ${videoId}`);
        segments = (pregenerated as SubtitleSegment[]).map(s => ({ ...s, source: 'pregenerated' }));
      } else {
        try {
          // Скачиваем транскрипт с YouTube в виде временных сегментов
          segments = await getYoutubeTranscriptSegments(videoId);
          segments = segments.map(s => ({ ...s, source: 'scraped' }));
        } catch (scrapingErr: any) {
          logger.error(`[API] Ошибка при получении субтитров YouTube для видео ${videoId}:`, scrapingErr);
          return NextResponse.json(
            { error: scrapingErr.message || 'Не удалось загрузить субтитры с YouTube' },
            { status: 502 }
          );
        }
      }
    } else if (srtText) {
      // Парсим пользовательские субтитры SRT/VTT
      segments = parseSubtitlesToSegments(srtText).map(s => ({ ...s, source: 'upload' }));
    }

    // Нормализуем сегменты и склеиваем в предложения
    segments = normalizeSegments(segments);
    segments = regroupIntoSentences(segments);
    textToTokenize = segments.map(s => s.text).join('\n');

    if (!textToTokenize) {
      return NextResponse.json(
        { error: 'Не удалось извлечь текст из переданных субтитров' },
        { status: 400 }
      );
    }

    if (srtText) {
      logger.info(`[API] Успешно распарсен загруженный файл субтитров длиной ${textToTokenize.length} символов`);
    }

    // Отправляем очищенный текст в микросервис MeCab
    logger.info(`[API] Отправка текста на токенизацию в микросервис MeCab: ${textToTokenize.length} символов`);
    
    try {
      const res = await fetch(`${tokenizerUrl}/tokenize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tokenizer-API-Key': tokenizerApiKey,
        },
        body: JSON.stringify({ text: textToTokenize }),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error(`[API] Ошибка токенизатора при парсинге медиа: ${errText}`);
        if (segments && segments.length > 0) {
          logger.warn('[API] Возврат сырых сегментов без токенизации из-за ошибки MeCab');
          return NextResponse.json({
            success: true,
            lemmas: [],
            segments,
            tokenizerDown: true
          });
        }
        return NextResponse.json(
          { error: 'Ошибка разбора японского текста в субтитрах' },
          { status: 502 }
        );
      }

      const data = await res.json();
      const lemmas: string[] = data.lemmas;

      // Кэшируем результат, если это было видео по ссылке
      if (cacheKey) {
        addToCache(cacheKey, { lemmas, segments });
      }

      return NextResponse.json({
        success: true,
        lemmas,
        segments,
        cached: false
      });
    } catch (tokenErr: any) {
      logger.error('[API] Ошибка подключения к микросервису токенизации', tokenErr);
      if (segments && segments.length > 0) {
        logger.warn('[API] Возврат сырых сегментов из-за недоступности токенизатора');
        return NextResponse.json({
          success: true,
          lemmas: [],
          segments,
          tokenizerDown: true
        });
      }
      return NextResponse.json(
        { error: 'Сервер токенизации временно недоступен' },
        { status: 503 }
      );
    }
  } catch (error: any) {
    logger.error('[API] Исключение во время работы API /api/media/parse', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера при обработке видео' },
      { status: 500 }
    );
  }
}

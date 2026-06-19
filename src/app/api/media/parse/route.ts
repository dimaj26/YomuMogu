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
    const { url, srtText, forceScrape } = body;

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
    let sourceUsed: 'cache' | 'scraped' | 'pregenerated' | 'upload' | null = null;

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
      
      // 1. Проверяем наличие в кэше (если не задан forceScrape)
      if (!forceScrape && lemmasCache.has(cacheKey)) {
        logger.info(`[API] [КЭШ] Возврат лемм и сегментов из кэша для видео ${videoId}`);
        const cached = lemmasCache.get(cacheKey)!;
        const hasWords = cached.segments.some(s => s.words && s.words.length > 0);
        return NextResponse.json({
          success: true,
          lemmas: cached.lemmas,
          segments: cached.segments,
          cached: true,
          source: 'cache',
          hasWords
        });
      }

      // 2. Пробуем скрейпить с YouTube в реальном времени
      try {
        logger.info(`[API] [СКРЕЙПИНГ] Попытка загрузки реальных субтитров с YouTube для видео ${videoId}`);
        segments = await getYoutubeTranscriptSegments(videoId);
        segments = segments.map(s => ({ ...s, source: 'scraped' }));
        sourceUsed = 'scraped';
      } catch (scrapingErr) {
        const scrapingErrMsg = scrapingErr instanceof Error ? scrapingErr.message : String(scrapingErr);
        logger.warn(`[API] Не удалось скрейпить субтитры с YouTube для видео ${videoId} (${scrapingErrMsg}). Пробуем предсгенерированный фолбэк.`);
        
        // 3. Фолбэк на предсгенерированные субтитры из JSON
        const pregenerated = mediaTranscripts[videoId as keyof typeof mediaTranscripts];
        if (pregenerated) {
          logger.info(`[API] [ФОЛБЭК] Использование предсгенерированных субтитров из JSON для видео ${videoId}`);
          const rawSegs = Array.isArray(pregenerated) ? pregenerated : (pregenerated as unknown as { segments: SubtitleSegment[] }).segments;
          segments = rawSegs.map((s: SubtitleSegment) => ({ ...s, source: 'pregenerated' }));
          sourceUsed = 'pregenerated';
        } else {
          // Если и скрейпинг, и предсгенерированные субтитры отсутствуют - возвращаем 502
          logger.error(`[API] [ОШИБКА] Субтитры отсутствуют в JSON-медиатеке и не удалось скрейпить с YouTube для видео ${videoId}`);
          return NextResponse.json(
            { error: `Не удалось загрузить субтитры с YouTube и они отсутствуют в медиатеке: ${scrapingErrMsg}` },
            { status: 502 }
          );
        }
      }
    } else if (srtText) {
      // Парсим пользовательские субтитры SRT/VTT
      segments = parseSubtitlesToSegments(srtText).map(s => ({ ...s, source: 'upload' }));
      sourceUsed = 'upload';
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
          const hasWords = segments.some(s => s.words && s.words.length > 0);
          return NextResponse.json({
            success: true,
            lemmas: [],
            segments,
            tokenizerDown: true,
            source: sourceUsed || 'upload',
            hasWords
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

      const hasWords = segments.some(s => s.words && s.words.length > 0);
      return NextResponse.json({
        success: true,
        lemmas,
        segments,
        cached: false,
        source: sourceUsed || 'upload',
        hasWords
      });
    } catch (tokenErr) {
      logger.error('[API] Ошибка подключения к микросервису токенизации', tokenErr);
      if (segments && segments.length > 0) {
        logger.warn('[API] Возврат сырых сегментов из-за недоступности токенизатора');
        const hasWords = segments.some(s => s.words && s.words.length > 0);
        return NextResponse.json({
          success: true,
          lemmas: [],
          segments,
          tokenizerDown: true,
          source: sourceUsed || 'upload',
          hasWords
        });
      }
      return NextResponse.json(
        { error: 'Сервер токенизации временно недоступен' },
        { status: 503 }
      );
    }
  } catch (error) {
    logger.error('[API] Исключение во время работы API /api/media/parse', error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : '') || 'Внутренняя ошибка сервера при обработке видео' },
      { status: 500 }
    );
  }
}

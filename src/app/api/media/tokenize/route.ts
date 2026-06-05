import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCsrf } from '@/lib/csrf';

// Ограничиваем время ожидания ответа от микросервиса MeCab (5 секунд)
const TIMEOUT_MS = 5000;

export async function POST(request: NextRequest) {
  // Проверяем CSRF-токен для защиты от межсайтовых атак
  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Заблокирован неавторизованный запрос к /api/media/tokenize');
    return NextResponse.json({ error: 'Доступ запрещен (CSRF)' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { text, mode } = body;

    if (!text || typeof text !== 'string') {
      logger.warn('[API] Невалидный запрос к /api/media/tokenize: отсутствует или некорректное поле text');
      return NextResponse.json(
        { error: 'Необходимо передать непустую строку в поле "text"' },
        { status: 400 }
      );
    }

    logger.info(`[API] Запрос на токенизацию текста длиной ${text.length} (режим: ${mode || 'lemmas'})`);

    const tokenizerUrl = process.env.TOKENIZER_URL || 'http://127.0.0.1:8000';
    const tokenizerApiKey = process.env.TOKENIZER_API_KEY || 'yomumogu-secret-token';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${tokenizerUrl}/tokenize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tokenizer-API-Key': tokenizerApiKey,
        },
        body: JSON.stringify({ text, mode: mode || 'lemmas' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        logger.error(`[API] Ошибка микросервиса MeCab (статус: ${res.status}): ${errText}`);
        return NextResponse.json(
          { error: `Микросервис токенизации вернул ошибку: ${res.status}` },
          { status: 502 }
        );
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        lemmas: data.lemmas || [],
        tokens: data.tokens || [],
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        logger.error('[API] Превышено время ожидания ответа от микросервиса MeCab');
        return NextResponse.json(
          { error: 'Превышено время ожидания ответа от сервера токенизации' },
          { status: 504 }
        );
      }
      throw fetchErr;
    }
  } catch (error: any) {
    logger.error('[API] Исключение во время токенизации на /api/media/tokenize', error);
    return NextResponse.json(
      { error: error.message || 'Произошла непредвиденная ошибка на сервере токенизации' },
      { status: 500 }
    );
  }
}

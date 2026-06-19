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
        return NextResponse.json({
          success: true,
          tokenizationSkipped: true,
          lemmas: [],
          tokens: [],
        });
      }

      const data = await res.json();
      return NextResponse.json({
        success: true,
        lemmas: data.lemmas || [],
        tokens: data.tokens || [],
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const fe = fetchErr as { name?: string; cause?: { code?: string } };
      const errCode = fe.cause?.code || 'код недоступен';
      if (fe.name === 'AbortError') {
        logger.error(`[API] Превышено время ожидания ответа от микросервиса MeCab (${tokenizerUrl})`);
      } else {
        logger.error(`[API] Ошибка подключения к микросервису токенизации MeCab (${tokenizerUrl}). Код ошибки: ${errCode}. Убедитесь, что запущен run-tokenizer.bat и проверьте logs\\tokenizer.log. Детали:`, fetchErr);
      }
      return NextResponse.json({
        success: true,
        tokenizationSkipped: true,
        lemmas: [],
        tokens: [],
      });
    }
  } catch (error) {
    logger.error('[API] Исключение во время токенизации на /api/media/tokenize', error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : '') || 'Произошла непредвиденная ошибка на сервере токенизации' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const tokenizerUrl = process.env.TOKENIZER_URL || 'http://127.0.0.1:8000';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${tokenizerUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        success: true,
        status: data.status || 'ok',
        tokenizerDown: false,
      });
    }

    logger.warn(`[API] Микросервис MeCab вернул ошибку при проверке здоровья: статус ${res.status}`);
    return NextResponse.json({
      success: false,
      tokenizerDown: true,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const errCode = (error as { cause?: { code?: string } }).cause?.code || 'код недоступен';
    logger.error(`[API] Ошибка подключения к микросервису токенизации MeCab при проверке здоровья (код: ${errCode}): ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({
      success: false,
      tokenizerDown: true,
    });
  }
}


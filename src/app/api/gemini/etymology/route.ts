import { NextRequest, NextResponse } from 'next/server';
import { geminiClient } from '@/lib/gemini/client';
import { logger } from '@/lib/logger';
import { geminiErrorResponse } from '@/lib/gemini/errors';

/**
 * POST /api/gemini/etymology
 * Генерирует этимологическую справку для японского слова.
 * Тело: { word: string }
 * Ответ: { components: string[], etymology: string }
 */
export async function POST(request: NextRequest) {
  logger.info('[API] POST /api/gemini/etymology — старт');

  // Проверка GEMINI_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    logger.error('[API] GEMINI_API_KEY отсутствует в переменных окружения');
    return NextResponse.json(
      { error: 'ИИ-сервис не настроен на сервере (нет ключа доступа).', reason: 'config', retryable: false },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { word } = body;

    // Валидация входных данных
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      logger.warn('[API] Невалидный запрос: отсутствует или пустое поле word');
      return NextResponse.json(
        { error: 'Обязательное поле "word" отсутствует или пустое' },
        { status: 400 }
      );
    }

    const result = await geminiClient.generateEtymology(word.trim());
    return NextResponse.json(result);
  } catch (error) {
    logger.error('[API] Ошибка генерации этимологии', error);
    return geminiErrorResponse(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { geminiClient } from '@/lib/gemini/client';
import { logger } from '@/lib/logger';

/**
 * POST /api/gemini/classify
 * Классифицирует японские слова по ситуационным тегам.
 * Тело запроса: { words: string[] }
 * Ответ: { classifications: { word: string; tags: string[] }[] }
 */
export async function POST(request: NextRequest) {
  logger.info('[API] POST /api/gemini/classify — старт');

  if (!process.env.GEMINI_API_KEY) {
    logger.error('[API] GEMINI_API_KEY отсутствует в переменных окружения');
    return NextResponse.json(
      { error: 'GEMINI_API_KEY не настроен на сервере' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { words } = body;

    if (!words || !Array.isArray(words) || words.length === 0) {
      logger.warn('[API] Невалидный запрос: отсутствует или пустое поле words');
      return NextResponse.json(
        { error: 'Обязательное поле "words" должно быть непустым массивом строк' },
        { status: 400 }
      );
    }

    // Очищаем и фильтруем слова
    const cleanWords = words
      .map((w: any) => (typeof w === 'string' ? w.trim() : ''))
      .filter((w: string) => w.length > 0);

    if (cleanWords.length === 0) {
      logger.warn('[API] Невалидный запрос: после очистки массив words пуст');
      return NextResponse.json(
        { error: 'Массив "words" не содержит валидных строк' },
        { status: 400 }
      );
    }

    const classifications = await geminiClient.classifyWords(cleanWords);
    return NextResponse.json({ classifications });
  } catch (error: any) {
    logger.error('[API] Ошибка классификации слов через Gemini', error);
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}

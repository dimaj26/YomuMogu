import { NextRequest, NextResponse } from 'next/server';
import { geminiClient } from '@/lib/gemini/client';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // 1. Проверяем наличие ключа в переменных окружения
  if (!process.env.GEMINI_API_KEY) {
    logger.error('Запрос к /api/gemini/sessions отклонен: GEMINI_API_KEY не задан в .env.local');
    return NextResponse.json(
      { 
        error: 'API-ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в файл .env.local в корне проекта и перезапустите сервер.' 
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { words } = body;

    if (!words || !Array.isArray(words)) {
      logger.warn('Запрос к /api/gemini/sessions с некорректным телом запроса');
      return NextResponse.json(
        { error: 'Необходимо передать массив слов в поле "words"' },
        { status: 400 }
      );
    }

    if (words.length === 0) {
      logger.warn('Запрос к /api/gemini/sessions с пустым массивом слов');
      return NextResponse.json({ sessions: [] });
    }

    logger.info(`Запрос на генерацию разговорных сессий для ${words.length} слов`);
    const sessions = await geminiClient.generateSessions(words);

    return NextResponse.json({ sessions });
  } catch (error: any) {
    logger.error('Исключение при обработке запроса в /api/gemini/sessions', error);
    return NextResponse.json(
      { error: 'ИИ-сервис временно недоступен. Попробуйте сгенерировать темы ещё раз позже — слова и повторение работают офлайн.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '@/lib/gemini/chat';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // 1. Проверяем наличие ключа в переменных окружения
  if (!process.env.GEMINI_API_KEY) {
    logger.error('Запрос к /api/chat/hint отклонен: GEMINI_API_KEY не задан в .env.local');
    return NextResponse.json(
      {
        error: 'API-ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в файл .env.local в корне проекта и перезапустите сервер.'
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { scenario, targetWords, history, level } = body;

    // 2. Валидация обязательных полей
    if (!scenario || typeof scenario !== 'string') {
      logger.warn('Запрос к /api/chat/hint с отсутствующим или некорректным полем scenario');
      return NextResponse.json(
        { error: 'Необходимо передать описание сценария в поле "scenario"' },
        { status: 400 }
      );
    }

    if (!targetWords || !Array.isArray(targetWords)) {
      logger.warn('Запрос к /api/chat/hint с отсутствующим или некорректным полем targetWords');
      return NextResponse.json(
        { error: 'Необходимо передать массив целевых слов в поле "targetWords"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(history)) {
      logger.warn('Запрос к /api/chat/hint с отсутствующим или некорректным полем history');
      return NextResponse.json(
        { error: 'Необходимо передать историю сообщений в поле "history"' },
        { status: 400 }
      );
    }

    const chatLevel = typeof level === 'number' && level >= 1 && level <= 5 ? level : 1;

    logger.info(`Запрос на генерацию подсказок (сложность: ${chatLevel}, история: ${history.length} сообщений)`);
    const hintResponse = await chatService.generateHints(scenario, targetWords, history, chatLevel);

    return NextResponse.json(hintResponse);
  } catch (error: any) {
    logger.error('Исключение при обработке запроса в /api/chat/hint', error);
    return NextResponse.json(
      { error: error.message || 'Произошла ошибка при генерации подсказок' },
      { status: 500 }
    );
  }
}

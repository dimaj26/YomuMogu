import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '@/lib/gemini/chat';
import { logger } from '@/lib/logger';
import { getGrammarScopeInstruction, validateUsedConstructions } from '@/lib/grammar/promptScope';

export async function POST(request: NextRequest) {
  // 1. Проверяем наличие ключа в переменных окружения
  if (!process.env.GEMINI_API_KEY) {
    logger.error('Запрос к /api/chat отклонен: GEMINI_API_KEY не задан в .env.local');
    return NextResponse.json(
      {
        error: 'API-ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в файл .env.local в корне проекта и перезапустите сервер.'
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { scenario, targetWords, history, message, level, grammarInJapanese, collectedWords, grammarFocus, grammarScope } = body;

    // 2. Валидация обязательных полей
    if (!scenario || typeof scenario !== 'string') {
      logger.warn('Запрос к /api/chat с отсутствующим или некорректным полем scenario');
      return NextResponse.json(
        { error: 'Необходимо передать описание сценария в поле "scenario"' },
        { status: 400 }
      );
    }

    if (!targetWords || !Array.isArray(targetWords)) {
      logger.warn('Запрос к /api/chat с отсутствующим или некорректным полем targetWords');
      return NextResponse.json(
        { error: 'Необходимо передать массив целевых слов в поле "targetWords"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(history)) {
      logger.warn('Запрос к /api/chat с отсутствующим или некорректным полем history');
      return NextResponse.json(
        { error: 'Необходимо передать историю сообщений в поле "history"' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      logger.warn('Запрос к /api/chat с отсутствующим или некорректным полем message');
      return NextResponse.json(
        { error: 'Необходимо передать текст сообщения в поле "message"' },
        { status: 400 }
      );
    }

    if (collectedWords !== undefined && !Array.isArray(collectedWords)) {
      logger.warn('Запрос к /api/chat с некорректным полем collectedWords');
      return NextResponse.json(
        { error: 'Необходимо передать массив строк в поле "collectedWords"' },
        { status: 400 }
      );
    }

    const chatLevel = typeof level === 'number' && level >= 1 && level <= 5 ? level : 1;
    const grammarInJa = typeof grammarInJapanese === 'boolean' ? grammarInJapanese : false;

    // Сгенерируем системную инструкцию ограничений грамматики, если передан скоуп
    let grammarScopeInstruction: string | undefined;
    if (grammarScope && Array.isArray(grammarScope.allowedConstructions)) {
      grammarScopeInstruction = getGrammarScopeInstruction(grammarScope);
    }

    logger.info(`Запрос на отправку сообщения в чат (сложность: ${chatLevel}, сообщение: "${message.substring(0, 50)}...")`);
    const chatResponse = await chatService.sendMessage(
      scenario,
      targetWords,
      history,
      message,
      chatLevel,
      grammarInJa,
      collectedWords,
      grammarFocus,
      grammarScopeInstruction
    );

    // Валидируем конструкции, использованные моделью
    if (grammarScope && Array.isArray(grammarScope.allowedConstructions) && chatResponse.usedConstructions) {
      const allowedIds = grammarScope.allowedConstructions.map((c: any) => c.id);
      const validation = validateUsedConstructions(chatResponse.usedConstructions, allowedIds);
      if (!validation.ok) {
        logger.warn(`[Grammar Scope Check] Нарушение ограничений грамматики ИИ: ${validation.violations.join(', ')}. Разрешенные ID: ${allowedIds.join(', ')}`);
      }
    }

    return NextResponse.json(chatResponse);
  } catch (error: any) {
    logger.error('Исключение при обработке запроса в /api/chat', error);
    return NextResponse.json(
      { error: error.message || 'Произошла ошибка при обработке сообщения в чате' },
      { status: 500 }
    );
  }
}

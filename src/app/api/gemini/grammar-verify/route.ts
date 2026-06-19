import { NextRequest, NextResponse } from 'next/server';
import { geminiClient } from '@/lib/gemini/client';
import { logger } from '@/lib/logger';
import { geminiErrorResponse } from '@/lib/gemini/errors';
import grammarRules from '@/resources/grammar_rules.json';

/**
 * Очищает японский текст от пробелов, пунктуации и HTML-тегов для точного сравнения.
 */
function cleanJapanese(text: string): string {
  return text
    .replace(/<rt>[\s\S]*?<\/rt>/gi, '') // удаляем фуригану
    .replace(/<\/?[^>]+(>|$)/g, '')      // удаляем теги ruby
    .replace(/[\s\t\r\n\u3000]/g, '')     // удаляем пробелы
    .replace(/[。、？！・.?!,]/g, '')     // удаляем знаки препинания
    .trim();
}

/**
 * POST /api/gemini/grammar-verify
 * Проверяет пользовательское предложение на соответствие грамматической конструкции N5.
 * Тело: { ruleId: string, userInput: string }
 * Ответ: { isCorrect: boolean, correction: string, explanation: string }
 */
export async function POST(request: NextRequest) {
  logger.info('[API] POST /api/gemini/grammar-verify — старт');

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
    const { ruleId, userInput } = body;

    // Валидация входных данных
    if (!ruleId || typeof ruleId !== 'string') {
      logger.warn('[API] Невалидный запрос: отсутствует или некорректное поле ruleId');
      return NextResponse.json(
        { error: 'Обязательное поле "ruleId" отсутствует или некорректно' },
        { status: 400 }
      );
    }

    if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
      logger.warn('[API] Невалидный запрос: отсутствует или пустое поле userInput');
      return NextResponse.json(
        { error: 'Обязательное поле "userInput" отсутствует или пустое' },
        { status: 400 }
      );
    }

    // Поиск правила в учебной программе
    const rule = grammarRules.find(r => r.id === ruleId);
    if (!rule) {
      logger.warn(`[API] Грамматическое правило с id "${ruleId}" не найдено`);
      return NextResponse.json(
        { error: `Грамматическое правило с id "${ruleId}" не существует в базе данных` },
        { status: 400 }
      );
    }

    // Быстрая проверка на точное совпадение с готовыми примерами
    const cleanedInput = cleanJapanese(userInput);
    const matchesSuggestion = (rule.suggestions || []).some(s => cleanJapanese(s.sampleAnswer) === cleanedInput);

    if (matchesSuggestion) {
      logger.info(`[API] Обнаружено точное совпадение с примером для "${ruleId}". Пропуск вызова Gemini.`);
      return NextResponse.json({
        isCorrect: true,
        correction: '',
        explanation: ''
      });
    }

    const result = await geminiClient.verifyGrammar(
      rule.construction || '',
      rule.topic || '',
      rule.explanation || '',
      rule.conjugationGuide || '',
      userInput.trim(),
      rule.suggestions || []
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[API] Ошибка верификации грамматики', error);
    return geminiErrorResponse(error);
  }
}

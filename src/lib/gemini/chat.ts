import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger';
import { withRetry, GeminiModel } from './retry';
import { getChatSystemInstruction, LEVEL_INSTRUCTIONS, getHintSystemInstruction } from './prompts';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TargetWord {
  word: string;
  translation: string;
}

export interface GrammarFeedback {
  isCorrect: boolean;
  correction: string;
  explanation: string;
  shortNote?: string;
}

export interface ChatResponse {
  reply: string;
  translation: string;
  grammarFeedback: GrammarFeedback;
  wordsDetected: string[];
  grammarRuleDetected: boolean;
  usedConstructions?: string[];
  _debug?: {
    systemInstruction: string;
    contents: any;
  };
}

export interface KeywordInfo {
  word: string;
  translation: string;
}

export interface HintVariant {
  level: 'easy' | 'medium' | 'advanced';
  keywords: KeywordInfo[];
  patternHint: string;
}

export interface HintResponse {
  hints: HintVariant[];
  _debug?: {
    systemInstruction: string;
    contents: any;
  };
}

/**
 * Сервис для ведения чат-диалога с Gemini в контексте практики японского языка.
 */
export class ChatService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Отправляет сообщение пользователя и получает ответ в рамках практического диалога.
   */
  async sendMessage(
    scenario: string,
    targetWords: TargetWord[],
    history: ChatMessage[],
    message: string,
    level: number = 1,
    grammarInJapanese: boolean = false,
    collectedWords?: string[],
    grammarFocus?: {
      construction: string;
      topic: string;
      explanation: string;
    },
    grammarScopeInstruction?: string
  ): Promise<ChatResponse> {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
      }
    }

    if (!this.ai) {
      logger.error('Инициализация ChatService завершилась ошибкой: отсутствует GEMINI_API_KEY');
      throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
    }

    const targetWordsList = targetWords
      .map(w => `${w.word} (${w.translation})`)
      .join(', ');

    // Вычисляем использованные и неиспользованные целевые слова
    let usedWords: TargetWord[];
    if (collectedWords && collectedWords.length > 0) {
      // Приоритетно используем реально собранные/распознанные слова
      usedWords = targetWords.filter(w => collectedWords.includes(w.word));
    } else {
      // Резервная эвристика по всей истории (для совместимости со старыми тестами)
      const usedWordsInHistory = history
        .filter(msg => msg.role === 'user')
        .map(msg => msg.text)
        .join(' ');
      usedWords = targetWords.filter(w => usedWordsInHistory.includes(w.word));
    }

    const usedWordsList = usedWords.length > 0
      ? usedWords.map(w => `${w.word} (${w.translation})`).join(', ')
      : 'no words used yet';

    const unusedWords = targetWords.filter(w => !usedWords.some(uw => uw.word === w.word));
    const unusedWordsList = unusedWords.length > 0
      ? unusedWords.map(w => `${w.word} (${w.translation})`).join(', ')
      : 'all words have been used';

    // Вычисляем номер текущего хода модели на основе полной истории диалога
    const modelTurnCount = history.filter(msg => msg.role === 'model').length + 1;

    const isStart = message === '__START__';

    const levelInstruction = LEVEL_INSTRUCTIONS[level] || LEVEL_INSTRUCTIONS[1];
    const grammarLang = grammarInJapanese ? 'Japanese' : 'Russian';

    const systemInstruction = getChatSystemInstruction({
      scenario,
      targetWordsList,
      unusedWordsList,
      usedWordsList,
      levelInstruction,
      grammarLang,
      isStart,
      modelTurnCount,
      grammarFocus,
      grammarScopeInstruction
    });

    // Ограничиваем историю диалога для Gemini до последних 20 сообщений для экономии токенов и сохранения контекста
    const slicedHistory = history.slice(-20);

    // Формируем историю диалога для Gemini
    const contents = [
      ...slicedHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }))
    ];

    // Если это не стартовое сообщение, добавляем текущее сообщение пользователя
    if (!isStart) {
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    } else {
      // Для стартового сообщения отправляем команду начать диалог
      contents.push({
        role: 'user',
        parts: [{ text: 'Start the dialogue, greet me.' }]
      });
    }

    try {
      logger.info(`Отправка сообщения в чат Gemini (история: ${history.length} сообщений, старт: ${isStart})`);

      const parsed = await withRetry(async (model: GeminiModel) => {
        logger.debug(`Чат: используется модель ${model}`);
        const response = await this.ai!.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                reply: { type: 'STRING', description: 'Ответ на японском языке' },
                translation: { type: 'STRING', description: 'Перевод ответа на русский язык' },
                grammarFeedback: {
                  type: 'OBJECT',
                  description: 'Результат проверки грамматики сообщения пользователя',
                  properties: {
                    isCorrect: { type: 'BOOLEAN', description: 'Корректна ли грамматика' },
                    correction: { type: 'STRING', description: 'Исправленное предложение (пустая строка если ошибок нет)' },
                    explanation: { type: 'STRING', description: 'Объяснение ошибки на русском (пустая строка если ошибок нет)' },
                    shortNote: { type: 'STRING', description: 'Короткая метаязыковая заметка об ошибке на русском, формат "категория: неверное → верное" (пустая строка если ошибок нет)' }
                  },
                  required: ['isCorrect', 'correction', 'explanation', 'shortNote']
                },
                wordsDetected: {
                  type: 'ARRAY',
                  description: 'Список целевых слов, использованных пользователем',
                  items: { type: 'STRING' }
                },
                grammarRuleDetected: {
                  type: 'BOOLEAN',
                  description: 'Использовал ли пользователь целевую грамматическую конструкцию'
                },
                usedConstructions: {
                  type: 'ARRAY',
                  description: 'Список грамматических конструкций (идентификаторов правил, например g_n5_s1_1, g_n5_s6), которые ИИ использовал в своем ответе (reply)',
                  items: { type: 'STRING' }
                }
              },
              required: ['reply', 'translation', 'grammarFeedback', 'wordsDetected', 'grammarRuleDetected', 'usedConstructions']
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API вернул пустой текст ответа в чате');
        }

        const parsed = JSON.parse(responseText) as ChatResponse;
        if (parsed.grammarFeedback) {
          parsed.grammarFeedback.shortNote = parsed.grammarFeedback.shortNote ?? '';
        }
        return parsed;
      });

      logger.info(`Ответ чата получен. Обнаружено целевых слов: ${parsed.wordsDetected?.length || 0}`);
      if (process.env.NODE_ENV === 'development') {
        parsed._debug = {
          systemInstruction,
          contents
        };
      }
      return parsed;
    } catch (error: any) {
      logger.error('Ошибка при отправке сообщения в чат Gemini', error);
      throw error;
    }
  }

  /**
   * Генерирует подсказки для пользователя — 3 варианта ответа разного уровня сложности.
   */
  async generateHints(
    scenario: string,
    targetWords: TargetWord[],
    history: ChatMessage[],
    level: number = 1
  ): Promise<HintResponse> {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
      }
    }

    if (!this.ai) {
      logger.error('Инициализация ChatService завершилась ошибкой: отсутствует GEMINI_API_KEY');
      throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
    }

    const targetWordsList = targetWords
      .map(w => `${w.word} (${w.translation})`)
      .join(', ');

    // Определяем уже использованные целевые слова из истории
    const usedWordsInHistory = history
      .filter(msg => msg.role === 'user')
      .map(msg => msg.text)
      .join(' ');

    const unusedWords = targetWords.filter(w => !usedWordsInHistory.includes(w.word));
    const unusedWordsList = unusedWords.length > 0
      ? unusedWords.map(w => `${w.word} (${w.translation})`).join(', ')
      : 'все слова уже использованы';

    let rubyInstruction = '';
    if (level <= 3) {
      rubyInstruction = `ОБЯЗАТЕЛЬНО снабжайте кандзи (иероглифы) фуриганой (чтением на хирагане) с помощью HTML-тегов ruby. Пример: <ruby>学校<rt>がっこう</rt></ruby>. Все кандзи в японском тексте вариантов должны быть размечены так.`;
    } else {
      rubyInstruction = `НЕ используйте теги ruby или фуригану, пишите стандартные кандзи.`;
    }

    const systemInstruction = getHintSystemInstruction({
      scenario,
      targetWordsList,
      unusedWordsList,
      rubyInstruction
    });

    // Формируем историю для контекста
    const historyText = history
      .map(msg => `${msg.role === 'user' ? 'Пользователь' : 'Собеседник'}: ${msg.text}`)
      .join('\n');

    const contents = [
      {
        role: 'user' as const,
        parts: [{ text: `История диалога:\n${historyText}\n\nПредложите 3 варианта ответа для пользователя.` }]
      }
    ];

    try {
      logger.info(`Генерация подсказок для чата (история: ${history.length} сообщений)`);

      const parsed = await withRetry(async (model: GeminiModel) => {
        logger.debug(`Подсказки: используется модель ${model}`);
        const response = await this.ai!.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                hints: {
                  type: 'ARRAY',
                  description: 'Подсказки для построения ответа разного уровня сложности',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      level: { type: 'STRING', description: 'Уровень сложности: easy, medium или advanced' },
                      keywords: {
                        type: 'ARRAY',
                        description: 'Ключевые слова для выражения мысли',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            word: { type: 'STRING', description: 'Ключевое слово на японском (с тегами ruby)' },
                            translation: { type: 'STRING', description: 'Перевод ключевого слова на русский' }
                          },
                          required: ['word', 'translation']
                        }
                      },
                      patternHint: { type: 'STRING', description: 'Шаблон/каркас предложения на русском с японскими частицами' }
                    },
                    required: ['level', 'keywords', 'patternHint']
                  }
                }
              },
              required: ['hints']
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API вернул пустой текст ответа при генерации подсказок');
        }

        return JSON.parse(responseText) as HintResponse;
      });

      logger.info(`Подсказки успешно сгенерированы: ${parsed.hints?.length || 0} вариантов`);
      if (process.env.NODE_ENV === 'development') {
        parsed._debug = {
          systemInstruction,
          contents
        };
      }
      return parsed;
    } catch (error: any) {
      logger.error('Ошибка при генерации подсказок в Gemini', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();

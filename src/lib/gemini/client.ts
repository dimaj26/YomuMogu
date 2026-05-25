import { GoogleGenAI } from '@google/genai';
import { AnkiWord } from '@/plugins/anki/filter';
import { logger } from '../logger';
import { withRetry, GeminiModel } from './retry';

export interface GeneratedSession {
  id: string;
  title: string;
  description: string;
  scenario: string;
  targetWords: {
    word: string;
    translation: string;
  }[];
}

export interface GeneratedSessionsResponse {
  sessions: GeneratedSession[];
}

export class GeminiClient {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Генерирует сессии на базе японских слов пользователя
   */
  async generateSessions(words: AnkiWord[]): Promise<GeneratedSession[]> {
    if (!this.ai) {
      logger.error('Инициализация Gemini завершилась ошибкой: отсутствует GEMINI_API_KEY');
      throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
    }

    if (words.length === 0) {
      logger.warn('Вызван метод generateSessions с пустым списком слов');
      return [];
    }

    // Фильтруем слова по приоритету: сначала те, что на изучении/повторении (new, learning, review)
    // mature слова используем только если не хватает для красивой группировки
    const priorityWords = words.filter(w => w.status !== 'mature');
    const matureWords = words.filter(w => w.status === 'mature');

    // Ограничиваем список слов для передачи в контекст ИИ, чтобы не перегружать prompt (выберем максимум 50 приоритетных и 30 mature)
    const wordsListForPrompt = [
      ...priorityWords.slice(0, 50),
      ...matureWords.slice(0, 30)
    ].map(w => ({
      word: w.word,
      translation: w.translation,
      status: w.status,
      interval: w.interval
    }));

    const systemInstruction = `Вы — преподаватель японского языка.
Ваша задача — проанализировать список японских слов и сгруппировать их в 3 различные разговорные темы (сценарии) для практического диалога.
В каждой теме пользователь будет вести диалог с ИИ на японском языке.

Правила составления тем:
1. Выберите для каждой темы от 4 до 6 целевых слов (targetWords) из переданного списка.
2. Старайтесь выбирать слова со статусами 'new', 'learning' или 'review'. Слова со статусом 'mature' используйте только при необходимости.
3. Темы должны быть естественными и полезными для повседневной практики (например: "В кафе", "Покупка билета на вокзале", "Разговор о погоде").
4. Не используйте одинаковые целевые слова в разных темах.
5. Для каждой темы составьте подробную инструкцию (поле 'scenario') на русском языке. Она должна описывать:
   - Кем является ИИ в этом диалоге (например: продавец, прохожий)
   - Кем является пользователь в этом диалоге (например: покупатель, турист)
   - Описание ситуации и цель общения для пользователя.
6. Названия (title) и описания (description) пишите на русском языке.

Верните строго структурированный JSON-ответ, содержащий массив 'sessions'.`;

    try {
      logger.info('Отправка запроса в Gemini API для генерации тем...');
      
      const result = await withRetry(async (model: GeminiModel) => {
        logger.debug(`Используется модель: ${model}`);
        const response = await this.ai!.models.generateContent({
          model,
          contents: `Вот список слов для группировки:\n${JSON.stringify(wordsListForPrompt, null, 2)}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                sessions: {
                  type: 'ARRAY',
                  description: 'Список сгенерированных сессий',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING', description: 'Уникальный ID темы (например: session-1)' },
                      title: { type: 'STRING', description: 'Краткое понятное название темы на русском' },
                      description: { type: 'STRING', description: 'Описание темы на русском (1-2 предложения)' },
                      scenario: { type: 'STRING', description: 'Инструкция для диалога с описанием ситуации и контекста' },
                      targetWords: {
                        type: 'ARRAY',
                        description: 'Список целевых слов для тренировки в этой сессии (4-6 слов)',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            word: { type: 'STRING', description: 'Японское слово' },
                            translation: { type: 'STRING', description: 'Перевод слова' }
                          },
                          required: ['word', 'translation']
                        }
                      }
                    },
                    required: ['id', 'title', 'description', 'scenario', 'targetWords']
                  }
                }
              },
              required: ['sessions']
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API вернул пустой текст ответа');
        }

        return JSON.parse(responseText) as GeneratedSessionsResponse;
      });

      logger.info(`Gemini успешно сгенерировал сессий: ${result.sessions?.length || 0}`);
      return result.sessions || [];
    } catch (error: any) {
      logger.error('Ошибка генерации сессий в GeminiClient', error);
      throw error;
    }
  }
}

export const geminiClient = new GeminiClient();

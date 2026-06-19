import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger';
import { withRetry } from './retry';
import { getProfileItem, setProfileItem } from '../profile';

export interface QueryExpansionResult {
  jaQueries: string[];
  theme: string | null;
}

const SITUATIONAL_THEMES = [
  'shopping',
  'restaurant',
  'travel',
  'home',
  'work',
  'hobbies',
  'social',
  'health',
  'weather',
  'education'
];

export class QueryExpansionService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Расширяет русский/смешанный поисковый запрос пользователя до японских поисковых фраз
   * и классифицирует по одной из 10 ситуационных тем.
   */
  async expandQuery(query: string): Promise<QueryExpansionResult> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return { jaQueries: [], theme: null };
    }

    // 1. Проверяем локальный кэш профиля
    try {
      const cacheKey = `query_expansion_${Buffer.from(normalizedQuery).toString('base64')}`;
      const cached = getProfileItem(cacheKey);
      if (cached) {
        logger.info(`[Query Expansion] Найден кэш для запроса: "${normalizedQuery}"`);
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[Query Expansion] Ошибка чтения кэша: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Деградационный результат по умолчанию при отказе API
    const fallbackResult: QueryExpansionResult = {
      jaQueries: [query],
      theme: null
    };

    if (!this.ai) {
      logger.warn('[Query Expansion] Инициализация Gemini не выполнена: отсутствует GEMINI_API_KEY');
      return fallbackResult;
    }

    const systemInstruction = `Вы — эксперт по японскому языку и ассистент по поиску обучающих видео.
Ваша задача — получить поисковый запрос пользователя на русском или смешанном языке и вернуть структурированный JSON:
1. "jaQueries": массив ровно из 3 точных японских поисковых запросов (например, содержащих ключевые слова на японском, такие как 会話, 練習, フレーズ, 日本語), которые помогут найти релевантные обучающие видео на YouTube.
2. "theme": подходящую ситуационную тему из списка: [shopping, restaurant, travel, home, work, hobbies, social, health, weather, education]. Если ни одна тема не подходит, верните null.

Пример:
Вход: 'хочу заказать еду'
Выход: {
  "jaQueries": ["日本語 レсторан 注文", "日本語 注文 練習", "レストラン 日本語 会話"],
  "theme": "restaurant"
}

Вход: 'японский для путешествий'
Выход: {
  "jaQueries": ["旅行 日本語 会話", "日本語 旅行 会話", "観光 日本語 フレーズ"],
  "theme": "travel"
}

Ответ должен строго содержать только JSON по указанной схеме.`;

    try {
      logger.info(`[Query Expansion] Вызов Gemini API для расширения запроса: "${normalizedQuery}"`);

      const result = await withRetry(
        async (model) => {
          const response = await this.ai!.models.generateContent({
            model,
            contents: `Запрос пользователя: "${normalizedQuery}"`,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  jaQueries: {
                    type: 'ARRAY',
                    description: 'Ровно 3 японских поисковых запроса на YouTube',
                    items: { type: 'STRING' }
                  },
                  theme: {
                    type: 'STRING',
                    description: 'Ситуационная тема (shopping, restaurant, travel, home, work, hobbies, social, health, weather, education) или null',
                    nullable: true
                  }
                },
                required: ['jaQueries', 'theme']
              }
            }
          });

          if (!response.text) {
            throw new Error('Пустой ответ от Gemini API');
          }

          const parsed = JSON.parse(response.text);
          
          // Проверяем валидность темы
          let theme = parsed.theme;
          if (theme && !SITUATIONAL_THEMES.includes(theme)) {
            theme = null;
          }

          // Убеждаемся, что jaQueries — массив строк
          const jaQueries = Array.isArray(parsed.jaQueries) 
            ? parsed.jaQueries.map(String).slice(0, 3) 
            : [query];

          return { jaQueries, theme };
        },
        { modelChain: ['gemini-2.5-flash-lite'] }
      );

      // Сохраняем в локальный кэш
      try {
        const cacheKey = `query_expansion_${Buffer.from(normalizedQuery).toString('base64')}`;
        setProfileItem(cacheKey, JSON.stringify(result));
      } catch (err) {
        logger.warn(`[Query Expansion] Не удалось сохранить результат в кэш: ${err instanceof Error ? err.message : String(err)}`);
      }

      return result;
    } catch (error) {
      logger.error(`[Query Expansion] Ошибка вызова Gemini API: ${error instanceof Error ? error.message : String(error)}. Применен откат к деградации.`);
      return fallbackResult;
    }
  }
}

export const queryExpansionService = new QueryExpansionService();

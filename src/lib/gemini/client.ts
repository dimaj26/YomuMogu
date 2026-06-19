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

export interface GroupedSessionInput {
  theme: string;
  words: { word: string; translation: string }[];
}

export const CHAT_WORDS_PER_THEME_MIN = 5;
export const CHAT_WORDS_PER_THEME_MAX = 8;

export function groupWordsIntoThemes(words: AnkiWord[]): GroupedSessionInput[] {
  // Исключаем дубликаты слов по полю word
  const uniqueWords = Array.from(new Map(words.map(w => [w.word, w])).values());

  const themes = ['shopping', 'restaurant', 'travel', 'home', 'work', 'hobbies', 'social', 'health', 'weather', 'education'];
  
  // Разделяем на ситуационные слова (у которых есть хотя бы один тег из themes) и универсальные слова (у которых только universal или нет тегов)
  const situationalWords = uniqueWords.filter(w => w.tags && w.tags.some(t => themes.includes(t)));
  const universalWords = uniqueWords.filter(w => !w.tags || w.tags.every(t => t === 'universal'));

  // Подсчитываем количество ситуационных слов для каждой темы
  const themeCounts: Record<string, number> = {};
  themes.forEach(t => {
    themeCounts[t] = situationalWords.filter(w => w.tags && w.tags.includes(t)).length;
  });

  // Сортируем темы по популярности (количеству слов)
  const sortedThemes = themes
    .map(t => ({ theme: t, count: themeCounts[t] }))
    .sort((a, b) => b.count - a.count);

  // Выбираем топ-3 темы. Если слов мало, дополняем дефолтными темами (social, home, shopping)
  const chosenThemes: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < sortedThemes.length && sortedThemes[i].count > 0) {
      chosenThemes.push(sortedThemes[i].theme);
    } else {
      const fallback = ['social', 'home', 'shopping'].find(t => !chosenThemes.includes(t));
      if (fallback) chosenThemes.push(fallback);
    }
  }

  // Наборы слов для каждой выбранной темы
  const result: GroupedSessionInput[] = [];
  const usedWords = new Set<string>();

  for (const theme of chosenThemes) {
    // 1. Сначала отбираем слова, которые содержат этот тег и еще не использованы
    const matchingNouns = situationalWords.filter(w => w.tags && w.tags.includes(theme) && !usedWords.has(w.word));
    
    // Сортируем matchingNouns: сначала трудные (isHard), затем те, у которых статус не mature (приоритетные)
    const sortedMatchingNouns = [...matchingNouns].sort((a, b) => {
      const aHard = !!a.isHard;
      const bHard = !!b.isHard;
      if (aHard && !bHard) return -1;
      if (!aHard && bHard) return 1;
      
      const aPriority = a.status !== 'mature';
      const bPriority = b.status !== 'mature';
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      
      return 0;
    });

    // Берем до 6 существительных для этой темы (noun cap raised)
    const selectedNouns = sortedMatchingNouns.slice(0, 6);
    selectedNouns.forEach(w => usedWords.add(w.word));

    // 2. Добираем универсальные слова (глаголы/прилагательные) до MAX (8)
    const needed = CHAT_WORDS_PER_THEME_MAX - selectedNouns.length;
    const selectedUniversal: AnkiWord[] = [];
    if (needed > 0) {
      const availableUniversal = universalWords.filter(w => !usedWords.has(w.word));
      // Сортируем универсальные: сначала трудные (isHard), затем приоритетные
      const sortedUniv = [...availableUniversal].sort((a, b) => {
        const aHard = !!a.isHard;
        const bHard = !!b.isHard;
        if (aHard && !bHard) return -1;
        if (!aHard && bHard) return 1;
        
        const aPriority = a.status !== 'mature';
        const bPriority = b.status !== 'mature';
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        
        return 0;
      });

      const chosenUniv = sortedUniv.slice(0, needed);
      chosenUniv.forEach(w => usedWords.add(w.word));
      selectedUniversal.push(...chosenUniv);
    }

    const sessionWords = [...selectedNouns, ...selectedUniversal].map(w => ({
      word: w.word,
      translation: w.translation
    }));

    // Если слов всё ещё меньше CHAT_WORDS_PER_THEME_MIN (5) (например, в пуле совсем мало слов),
    // то пытаемся добрать уже использованные универсальные слова, чтобы набрать хотя бы MIN (5)
    if (sessionWords.length < CHAT_WORDS_PER_THEME_MIN) {
      const neededMore = CHAT_WORDS_PER_THEME_MIN - sessionWords.length;
      const extraUniv = universalWords
        .filter(w => !sessionWords.some(sw => sw.word === w.word))
        .slice(0, neededMore)
        .map(w => ({
          word: w.word,
          translation: w.translation
        }));
      sessionWords.push(...extraUniv);
    }

    result.push({
      theme,
      words: sessionWords
    });
  }

  return result;
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

    // Группируем слова по ситуационным темам программно
    const groupedGroups = groupWordsIntoThemes(words);

    const systemInstruction = `Вы — преподаватель японского языка.
Ваша задача — составить 3 разговорных сценария (сессии) на основе переданных групп слов и их тем.
Для каждой группы слов вам предоставлена тема (например, "restaurant", "shopping", "travel").

Правила составления:
1. Для каждой группы составьте естественную и полезную ситуацию для диалога на русском языке.
2. Ситуация должна соответствовать указанной теме группы и логично задействовать все переданные целевые слова этой группы.
3. Опишите сценарий диалога (поле 'scenario') на русском языке:
   - Кем является ИИ (например: официант, продавец, коллега)
   - Кем является пользователь (например: клиент, покупатель)
   - Описание ситуации и цель общения для пользователя.
4. Напишите название темы (title) и короткое описание (description) на русском языке.
5. Верните строго структурированный JSON-ответ, содержащий массив 'sessions'.`;

    try {
      logger.info('Отправка запроса в Gemini API для генерации тем по группам...');
      
      const result = await withRetry(async (model: GeminiModel) => {
        logger.debug(`Используется модель: ${model}`);
        const response = await this.ai!.models.generateContent({
          model,
          contents: `Вот 3 группы слов с их ситуационными темами:\n${JSON.stringify(groupedGroups, null, 2)}`,
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

  /**
   * Генерирует этимологическую справку для японского слова/кандзи.
   * Возвращает разбор на компоненты и историческое происхождение на русском.
   */
  async generateEtymology(word: string): Promise<EtymologyResponse> {
    if (!this.ai) {
      logger.error('Инициализация Gemini: отсутствует GEMINI_API_KEY');
      throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
    }

    const systemInstruction = `Вы — эксперт по японской этимологии и структуре иероглифов.
Для переданного японского слова или кандзи:
1. Разложите каждый иероглиф на составные радикалы (компоненты). Укажите значение каждого радикала.
2. Объясните происхождение слова и его иероглифов: как исторически сложилось значение из компонентов.
3. Если уместно, дайте мнемоническую ассоциацию для запоминания.
Ответ должен быть на русском языке, лаконичный (2-4 предложения).`;

    try {
      logger.info(`Запрос этимологии для слова: ${word}`);

      const result = await withRetry(async (model: GeminiModel) => {
        const response = await this.ai!.models.generateContent({
          model,
          contents: `Слово: ${word}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                components: {
                  type: 'ARRAY',
                  description: 'Список компонентов/радикалов с их значениями',
                  items: { type: 'STRING' }
                },
                etymology: {
                  type: 'STRING',
                  description: 'Этимологическая справка и мнемоника на русском'
                }
              },
              required: ['components', 'etymology']
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API вернул пустой ответ для этимологии');
        }

        return JSON.parse(responseText) as EtymologyResponse;
      });

      logger.info(`Этимология для "${word}" успешно сгенерирована`);
      return result;
    } catch (error: any) {
      logger.error(`Ошибка генерации этимологии для "${word}"`, error);
      throw error;
    }
  }

  /**
   * Проверяет предложение пользователя на соответствие грамматической конструкции N5.
   * Возвращает результат проверки, исправление (с фуриганой) и объяснение на русском.
   */
  async verifyGrammar(
    construction: string,
    topic: string,
    explanation: string,
    conjugationGuide: string,
    userInput: string,
    suggestions: { hint: string; baseWords: string; sampleAnswer: string }[]
  ): Promise<GrammarVerifyResponse> {
    if (!this.ai) {
      logger.error('Инициализация Gemini: отсутствует GEMINI_API_KEY');
      throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
    }

    const systemInstruction = `Вы — ассистент по проверке японской грамматики для русскоязычных студентов.
Проверьте, правильно ли пользователь составил предложение на японском языке с использованием следующего грамматического правила:
Конструкция: ${construction}
Тема: ${topic}
Описание: ${explanation}
Инструкция по спряжению: ${conjugationGuide}
Примеры правильных ответов: ${suggestions.map(s => `"${s.sampleAnswer}" (подсказка: ${s.hint})`).join(', ')}

Ваши правила проверки:
1. Проверьте предложение пользователя (${userInput}) на предмет правильного использования указанной грамматической конструкции и общей грамматической корректности японского языка.
2. ВЕРНИТЕ JSON-ответ со следующими полями:
   - isCorrect: boolean (true, если предложение грамматически корректно, нет опечаток и полностью написано на японском; false в противном случае).
   - correction: string (исправленный вариант предложения на японском языке. Если предложение правильное, оставьте это поле пустым "").
   - explanation: string (объяснение ошибок на русском языке. Укажите, что именно не так со спряжением, частицами или порядком слов. Если предложение правильное, оставьте пустым "").

3. Специфические правила для ошибок ввода:
   - Смешанный ввод (кириллические плейсхолдеры): Если пользователь вставил русские слова в японское предложение вместо забытых слов (например, "Стулの座って" или "Стулは座ります"), установите isCorrect = false. В поле correction вставьте ПОЛНОСТЬЮ исправленное предложение на японском языке, переведя русское слово (например, "椅子に座いて" или "椅子に座って"). Объясните перевод в поле explanation на русском.
   - Полностью русский ввод: Если пользователь написал сообщение полностью на русском (например, "я хочу прочитать книгу"), установите isCorrect = false. В поле correction верните полный корректный перевод предложения на японский язык. В поле explanation объясните на русском языке, что нужно писать на японском, и разберите перевод.
   
4. ПРАВИЛО ФУРИГАНЫ (КРИТИЧЕСКИ ВАЖНО):
   - Так как мы изучаем базовые правила уровня N5, в поле "correction" ВСЕ иероглифы (kanji) без исключения должны быть обернуты в HTML-теги ruby с хираганой. Пример: <ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>んでください。
   - Никогда не оставляйте кандзи без фуриганы в исправленном предложении correction.`;

    try {
      logger.info(`Запрос на проверку грамматики конструкции "${construction}" для ввода: "${userInput}"`);

      const result = await withRetry(async (model: GeminiModel) => {
        const response = await this.ai!.models.generateContent({
          model,
          contents: `Пользовательский ввод: ${userInput}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                isCorrect: {
                  type: 'BOOLEAN',
                  description: 'Соответствует ли ввод правилам грамматики и контексту'
                },
                correction: {
                  type: 'STRING',
                  description: 'Исправленный вариант предложения на японском языке с HTML ruby-тегами для кандзи'
                },
                explanation: {
                  type: 'STRING',
                  description: 'Подробное объяснение ошибок на русском языке'
                }
              },
              required: ['isCorrect', 'correction', 'explanation']
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API вернул пустой ответ при проверке грамматики');
        }

        return JSON.parse(responseText) as GrammarVerifyResponse;
      }, {
        models: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']
      });

      logger.info(`Проверка грамматики завершена. Результат корректности: ${result.isCorrect}`);
      return result;
    } catch (error: any) {
      logger.error(`Ошибка проверки грамматики для ввода "${userInput}"`, error);
      throw error;
    }
  }

  /**
   * Классифицирует японские слова по ситуационным категориям с помощью Gemini.
   */
  async classifyWords(words: string[]): Promise<{ word: string; tags: string[] }[]> {
    if (!this.ai) {
      logger.error('Инициализация Gemini: отсутствует GEMINI_API_KEY');
      throw new Error('Ключ GEMINI_API_KEY не задан в переменных окружения.');
    }

    if (words.length === 0) {
      return [];
    }

    const systemInstruction = `Вы — лингвистический классификатор для японского языка.
Ваша задача — классифицировать список японских слов по ситуационным темам.

Доступные теги:
- 'shopping': Покупки, магазины, одежда, деньги, транзакции.
- 'restaurant': Рестораны, кафе, еда, напитки, заказ еды.
- 'travel': Путешествия, транспорт, гостиницы, направления, природа (море, горы).
- 'home': Дом, быт, семья, мебель, ежедневные домашние дела.
- 'work': Работа, офис, бизнес, профессии, совещания.
- 'hobbies': Хобби, спорт, развлечения, искусство, игры, музыка, книги.
- 'social': Общение, друзья, встречи, звонки, переписка, социальные взаимодействия.
- 'health': Здоровье, медицина, больницы, болезни, самочувствие, несчастные случаи.
- 'weather': Погода, дождь, снег, природные катастрофы (тайфун, землетрясение).
- 'education': Учеба, школа, университет, языки, экзамены, грамматика.
- 'universal': Общие действия, местоимения, базовые наречия, предлоги, а также абстрактные/общие глаголы и прилагательные (например: делать, идти, быть, большой, хороший).

Правила классификации:
1. Для каждого слова определите один или несколько подходящих тегов из списка выше.
2. Существительные классифицируйте в ситуационные теги в зависимости от их значения (например, "книга" -> ["education", "hobbies"], "автомобиль" -> ["travel"]).
3. Общие глаголы и прилагательные (например: делать, идти, большой, красивый) ОБЯЗАТЕЛЬНО должны содержать тег "universal". Вы можете добавить ситуационные теги к глаголам/прилагательным, только если они узкоспециализированные (например, "обедать" -> ["universal", "restaurant"], "покупать" -> ["universal", "shopping"]).
4. Каждое слово в ответе должно иметь хотя бы один тег.`;

    try {
      logger.info(`Классификация ${words.length} слов через Gemini API`);
      
      const result = await withRetry(async (model: GeminiModel) => {
        const response = await this.ai!.models.generateContent({
          model,
          contents: `Классифицируй следующие слова:\n${JSON.stringify(words)}`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                classifications: {
                  type: 'ARRAY',
                  description: 'Список классификаций для каждого слова',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      word: { type: 'STRING', description: 'Исходное слово' },
                      tags: {
                        type: 'ARRAY',
                        description: 'Теги, подходящие к слову (минимум один). Общие глаголы/прилагательные должны получать "universal".',
                        items: {
                          type: 'STRING',
                          enum: ['shopping', 'restaurant', 'travel', 'home', 'work', 'hobbies', 'social', 'health', 'weather', 'education', 'universal']
                        }
                      }
                    },
                    required: ['word', 'tags']
                  }
                }
              },
              required: ['classifications']
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Gemini API вернул пустой ответ при классификации');
        }

        return JSON.parse(responseText) as { classifications: { word: string; tags: string[] }[] };
      });

      return result.classifications || [];
    } catch (error: any) {
      logger.error('Ошибка классификации слов в GeminiClient', error);
      throw error;
    }
  }
}

// Интерфейс ответа этимологии
export interface EtymologyResponse {
  components: string[];
  etymology: string;
}

// Интерфейс ответа проверки грамматики
export interface GrammarVerifyResponse {
  isCorrect: boolean;
  correction: string;
  explanation: string;
}

export const geminiClient = new GeminiClient();

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withRetry, GeminiModel } from '@/lib/gemini/retry';
import { logger } from '@/lib/logger';
import { lookupWord } from '@/lib/dict/jitendex';
import { getActiveWordSource } from '@/core/pluginRegistry';
import { getLocalWords } from '@/core/db';
import '@/plugins/anki/index';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    logger.error('Запрос к /api/chat/analyze отклонен: GEMINI_API_KEY не задан в .env.local');
    return NextResponse.json(
      { error: 'API-ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в файл .env.local.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { history, deckName, frontField, backField, deckMappings } = body;

    if (!history || !Array.isArray(history)) {
      logger.warn('Запрос к /api/chat/analyze с отсутствующим или некорректным полем history');
      return NextResponse.json(
        { error: 'Необходимо передать историю сообщений в поле "history"' },
        { status: 400 }
      );
    }

    if (!deckName || typeof deckName !== 'string') {
      logger.warn('Запрос к /api/chat/analyze с отсутствующим или некорректным полем deckName');
      return NextResponse.json(
        { error: 'Необходимо передать имя колоды в поле "deckName"' },
        { status: 400 }
      );
    }

    const fField = typeof frontField === 'string' && frontField ? frontField : 'Front';
    const bField = typeof backField === 'string' && backField ? backField : 'Back';

    logger.info(`Запрос на анализ диалога (сообщений: ${history.length}, колода: ${deckName})`);

    const transcript = history
      .map(msg => `${msg.role === 'user' ? 'Пользователь' : 'Собеседник'}: ${msg.text}`)
      .join('\n');

    const systemInstruction = `Вы — экспертный лингвистический анализатор японского языка.
Ваша задача — проанализировать предоставленный транскрипт диалога и выделить от 5 до 10 ключевых и интересных японских слов (имена существительные, глаголы или прилагательные), которые использовались в беседе.
Не выбирайте сверхбазовые слова и служебные частицы вроде 私, これ, です, ます, いる, ある, する, いく, くる, は, を, が, に, で, と, も, の и т.д.
Для каждого слова верните его написание (словарную форму), чтение (хирагану) и русский перевод.

Ответ должен строго соответствовать предоставленной JSON-схеме. НЕ используйте запрещенные слова: ролевая игра, Роль ИИ, Роль пользователя.`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. Извлекаем слова с помощью Gemini
    const geminiResult = await withRetry(async (model: GeminiModel) => {
      logger.debug(`Анализ диалога: используется модель ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: `Вот транскрипт диалога для анализа:\n${transcript}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              words: {
                type: 'ARRAY',
                description: 'Список интересных японских слов',
                items: {
                  type: 'OBJECT',
                  properties: {
                    word: { type: 'STRING', description: 'Слово в словарной форме (кандзи/хирагана)' },
                    reading: { type: 'STRING', description: 'Чтение слова (хирагана)' },
                    translation: { type: 'STRING', description: 'Перевод на русский язык' }
                  },
                  required: ['word', 'reading', 'translation']
                }
              }
            },
            required: ['words']
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini API вернул пустой текст при анализе диалога');
      }
      return JSON.parse(text) as { words: Array<{ word: string; reading: string; translation: string }> };
    });

    const extractedWords = geminiResult.words || [];
    logger.info(`Извлечено слов из диалога: ${extractedWords.length}`);

    // 2. Для каждого слова проверяем его в словаре JitenDex и в Anki
    const analyzedWords = [];

    let deckWords: Array<{ id: number; word: string; status: 'new' | 'learning' | 'review' | 'mature'; cardIds?: number[] }> = [];
    let ankiConnected = false;
    try {
      const activeSource = getActiveWordSource();
      const profileId = body.profileId || 'default';
      
      if (activeSource) {
        deckWords = await activeSource.getWords(profileId, deckName);
        ankiConnected = true;
      } else {
        const localWords = await getLocalWords(profileId, deckName);
        deckWords = localWords.map(w => ({
          id: w.id,
          word: w.word,
          status: w.active.status,
          cardIds: [w.id]
        }));
        ankiConnected = true;
      }
      logger.info(`Загружено карточек для сопоставления в памяти: ${deckWords.length}`);
    } catch (err) {
      logger.warn('Не удалось получить список карточек из активного источника');
    }

    for (const item of extractedWords) {
      // Ищем определение в JitenDex
      let definitionHtml = '';
      try {
        const dictResult = await lookupWord(item.word);
        if (dictResult && dictResult.definition && !dictResult.error) {
          definitionHtml = dictResult.definition;
        }
      } catch (err) {
        logger.error(`Ошибка поиска слова "${item.word}" в словаре JitenDex`, err);
      }

      // Проверяем наличие в Anki по очищенному в памяти слову
      let inAnki = false;
      let cardId: number | undefined;
      let cardIds: number[] | undefined;
      let status: 'new' | 'learning' | 'review' | 'mature' | undefined;
      let isDue = false;

      if (ankiConnected) {
        const matched = deckWords.find(
          (w) => w.word === item.word || w.word.toLowerCase() === item.word.toLowerCase()
        );
        if (matched) {
          inAnki = true;
          cardId = matched.id;
          cardIds = matched.cardIds;
          status = matched.status;
          isDue = matched.status === 'learning' || matched.status === 'review';
        }
      }

      analyzedWords.push({
        word: item.word,
        reading: item.reading,
        translation: item.translation,
        definitionHtml,
        inAnki,
        cardId,
        cardIds,
        status,
        isDue
      });
    }

    return NextResponse.json({ words: analyzedWords });
  } catch (error) {
    logger.error('Исключение в API /api/chat/analyze', error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : '') || 'Произошла ошибка при анализе диалога' },
      { status: 500 }
    );
  }
}

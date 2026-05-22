import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withRetry, GeminiModel } from '@/lib/gemini/retry';
import { logger } from '@/lib/logger';
import { lookupWord } from '@/lib/dict/jitendex';
import { ankiClient } from '@/lib/anki/client';
import { parseAndFilterCards, AnkiWord } from '@/lib/anki/filter';

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
Слова должны соответствовать уровню N4 и выше. Не выбирайте сверхбазовые слова вроде 私, これ, です, ます, いる, ある, する, いく, くる и т.д.
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
                description: 'Список интересных японских слов уровня N4+',
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

    const isAllDecks = deckName === '__all__';
    // Получаем список всех due карточек и все карточки колоды из Anki для проверки в памяти
    let dueCardIds: number[] = [];
    let deckWords: AnkiWord[] = [];
    let ankiConnected = false;
    try {
      // Находим ID всех карточек
      const allCardIds = isAllDecks
        ? await ankiClient.findCardsByQuery('deck:*')
        : await ankiClient.findCards(deckName);
      
      try {
        dueCardIds = isAllDecks
          ? await ankiClient.findCardsByQuery('is:due')
          : await ankiClient.findCardsByQuery(`deck:"${deckName}" is:due`);
      } catch (dueErr) {
        logger.warn(`Не удалось получить список due карт для ${isAllDecks ? 'всех колод' : `колоды ${deckName}`}`, dueErr);
      }

      if (allCardIds.length > 0) {
        // Загружаем подробную информацию пачками по 1000
        const batchSize = 1000;
        const cardsInfo = [];
        for (let i = 0; i < allCardIds.length; i += batchSize) {
          const batchIds = allCardIds.slice(i, i + batchSize);
          const batchInfo = await ankiClient.getCardsInfo(batchIds);
          cardsInfo.push(...batchInfo);
        }
        deckWords = parseAndFilterCards(cardsInfo, fField, bField, dueCardIds, deckMappings);
      }
      
      ankiConnected = true;
      logger.info(`Загружено карточек для сопоставления в памяти: ${deckWords.length}, из них due: ${dueCardIds.length}`);
    } catch (err) {
      logger.warn('Не удалось получить список карточек из Anki (Anki не запущен или недоступен)');
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
          isDue = matched.cardIds
            ? matched.cardIds.some((id) => dueCardIds.includes(id))
            : dueCardIds.includes(matched.id);
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
  } catch (error: any) {
    logger.error('Исключение в API /api/chat/analyze', error);
    return NextResponse.json(
      { error: error.message || 'Произошла ошибка при анализе диалога' },
      { status: 500 }
    );
  }
}

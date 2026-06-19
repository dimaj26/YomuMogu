import { NextRequest, NextResponse } from 'next/server';
import { ankiClient } from '@/plugins/anki/client';
import { parseAndFilterCards } from '@/plugins/anki/filter';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  if (process.env.ANKI_ENABLED === 'false') {
    return NextResponse.json({ error: 'Anki integration is disabled' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const deck = searchParams.get('deck');
  const frontField = searchParams.get('frontField') || 'Front';
  const backField = searchParams.get('backField') || 'Back';
  const mappingsParam = searchParams.get('mappings');
  
  let deckMappings = undefined;
  if (mappingsParam) {
    try {
      deckMappings = JSON.parse(mappingsParam);
    } catch (e) {
      logger.warn('Не удалось распарсить mappings в GET /anki/words', e);
    }
  }

  if (!deck) {
    logger.warn('Запрос API /anki/words без параметра deck');
    return NextResponse.json({ error: 'Параметр deck обязателен' }, { status: 400 });
  }

  try {
    const isAllDecks = deck === '__all__';
    logger.info(`Запрос API /anki/words для ${isAllDecks ? 'всех колод' : `колоды: ${deck}`}`);
    
    // 1. Находим ID всех карточек
    const cardIds = isAllDecks
      ? await ankiClient.findCardsByQuery('deck:*')
      : await ankiClient.findCards(deck);
    
    if (cardIds.length === 0) {
      logger.info(isAllDecks ? 'В Anki не найдено карточек' : `Колода ${deck} пуста`);
      return NextResponse.json({ words: [] });
    }

    logger.debug(`Найдено ${cardIds.length} карт ${isAllDecks ? 'всего в Anki' : `в колоде ${deck}`}`);

    // Получаем список ID карточек, которые требуют повторения (due)
    let dueCardIds: number[] = [];
    try {
      dueCardIds = isAllDecks
        ? await ankiClient.findCardsByQuery('is:due')
        : await ankiClient.findCardsByQuery(`deck:"${deck}" is:due`);
      logger.info(`Найдено ${dueCardIds.length} due карт ${isAllDecks ? 'во всех колодах' : `в колоде ${deck}`}`);
    } catch (err) {
      logger.warn(`Не удалось получить список due карт для ${isAllDecks ? 'всех колод' : `колоды ${deck}`}`, err);
    }

    // 2. Загружаем информацию пачками (батчами) по 1000 штук, чтобы избежать перегрузки запроса
    const batchSize = 1000;
    const cardsInfo = [];
    
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batchIds = cardIds.slice(i, i + batchSize);
      logger.debug(`Загрузка батча карт с ${i} по ${i + batchIds.length}`);
      const batchInfo = await ankiClient.getCardsInfo(batchIds);
      cardsInfo.push(...batchInfo);
    }

    // 3. Парсим и классифицируем карточки
    const words = parseAndFilterCards(cardsInfo, frontField, backField, dueCardIds, deckMappings);
    logger.info(`Успешно обработано слов: ${words.length}`);

    return NextResponse.json({ words });
  } catch (error) {
    logger.error(`Исключение в API /anki/words для колоды ${deck}`, error);
    return NextResponse.json({ 
      error: (error instanceof Error ? error.message : '') || 'Ошибка при загрузке слов из Anki'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ankiClient } from '@/lib/anki/client';
import { parseAndFilterCards } from '@/lib/anki/filter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      profileId, 
      deckName, 
      frontField = 'Front', 
      backField = 'Back', 
      localReviews = [], 
      localWords = [] 
    } = body;

    if (!profileId || !deckName) {
      return NextResponse.json(
        { error: 'Параметры profileId и deckName обязательны' },
        { status: 400 }
      );
    }

    logger.info(`Начало двусторонней синхронизации для колоды "${deckName}" (профиль: ${profileId})`);

    // 1. Записываем несинхронизированные локальные отзывы в Anki
    if (localReviews.length > 0) {
      logger.info(`Синхронизация локальных отзывов с Anki: отправка ${localReviews.length} записей`);
      
      // Получаем уже существующие отзывы в Anki для этих карт, чтобы избежать дублирования
      const localCardIds = Array.from(new Set(localReviews.map((r: any) => r.cardId)));
      const existingTimestamps = new Set<number>();
      try {
        const existingReviews = await ankiClient.getReviewsOfCards(localCardIds);
        for (const cid of localCardIds) {
          const revs = existingReviews[cid] || [];
          for (const r of revs) {
            existingTimestamps.add(r.id);
          }
        }
      } catch (err) {
        logger.warn('Не удалось получить историю повторений для дедупликации', err);
      }

      const reviewsToInsert: Array<[number, number, number, number, number, number, number, number, number]> = [];
      const relearnCardIds: number[] = [];
      const intervalGroups: Record<number, number[]> = {};

      for (const rev of localReviews) {
        // Пропускаем отзывы, которые уже есть в Anki
        if (existingTimestamps.has(rev.timestamp)) {
          logger.info(`Отзыв с таймстемпом ${rev.timestamp} для карты ${rev.cardId} уже есть в Anki, пропускаем`);
          continue;
        }

        if (rev.ease === 1) {
          relearnCardIds.push(rev.cardId);
        } else {
          if (!intervalGroups[rev.interval]) {
            intervalGroups[rev.interval] = [];
          }
          intervalGroups[rev.interval].push(rev.cardId);
        }

        // Определение типа повторения в Anki (0=learn, 1=review, 2=relearn)
        let reviewType = 1;
        if (rev.lastInterval === 0) {
          reviewType = 0;
        } else if (rev.ease === 1) {
          reviewType = 2;
        }

        reviewsToInsert.push([
          rev.timestamp,
          rev.cardId,
          -1, // usn
          rev.ease,
          rev.interval,
          rev.lastInterval,
          0, // factor (0 для FSRS)
          rev.duration || 5000,
          reviewType
        ]);
      }

      try {
        if (relearnCardIds.length > 0) {
          await ankiClient.relearnCards(relearnCardIds);
        }

        for (const [interval, ids] of Object.entries(intervalGroups)) {
          await ankiClient.setDueDate(ids, `${interval}!`);
        }

        if (reviewsToInsert.length > 0) {
          await ankiClient.insertReviews(reviewsToInsert);
        }
        logger.info(`Локальные отзывы успешно синхронизированы с Anki`);
      } catch (err) {
        logger.error(`Ошибка при отправке локальных отзывов в AnkiConnect`, err);
        return NextResponse.json(
          { error: 'Не удалось синхронизировать локальные отзывы с Anki. Проверьте подключение.' },
          { status: 500 }
        );
      }
    }

    // 2. Получаем актуальный список карт из Anki для этой колоды
    let remoteCardsInfo: any[] = [];
    try {
      const remoteCardIds = await ankiClient.findCards(deckName);
      if (remoteCardIds.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < remoteCardIds.length; i += batchSize) {
          const batchIds = remoteCardIds.slice(i, i + batchSize);
          const batchInfo = await ankiClient.getCardsInfo(batchIds);
          remoteCardsInfo.push(...batchInfo);
        }
      }
    } catch (err) {
      logger.error(`Не удалось получить информацию о картах из Anki`, err);
      return NextResponse.json(
        { error: 'Не удалось загрузить карты из Anki для синхронизации.' },
        { status: 500 }
      );
    }

    // 3. Выявляем карты с расхождениями для получения их истории отзывов (revlog)
    const cardsToFetchReviews: number[] = [];
    for (const remoteCard of remoteCardsInfo) {
      const lw = localWords.find((w: any) => w.id === remoteCard.cardId);
      
      if (!lw) {
        // Карта есть в Anki, но нет локально. 
        // Запрашиваем историю только если карта уже проходилась (интервал > 0)
        if (remoteCard.interval > 0 || remoteCard.queue === 2) {
          cardsToFetchReviews.push(remoteCard.cardId);
        }
      } else {
        const remoteQueue = remoteCard.queue < 0 ? remoteCard.type : remoteCard.queue;
        let localQueue = 0;
        if (lw.status === 'learning') localQueue = 1;
        else if (lw.status === 'review' || lw.status === 'mature') localQueue = 2;

        if (lw.interval !== remoteCard.interval || localQueue !== remoteQueue) {
          cardsToFetchReviews.push(remoteCard.cardId);
        }
      }
    }

    // 4. Запрашиваем историю отзывов (revlog) из Anki для изменившихся карт пакетом (bulk)
    let remoteReviews: Record<number, any[]> = {};
    if (cardsToFetchReviews.length > 0) {
      logger.info(`Запрос истории повторений из Anki для ${cardsToFetchReviews.length} измененных карт пакетом`);
      try {
        remoteReviews = await ankiClient.getReviewsOfCards(cardsToFetchReviews);
      } catch (err) {
        logger.error(`Не удалось получить логи повторений пакетом для измененных карт`, err);
      }
    }

    // 5. Парсим и классифицируем карточки для возврата на клиент
    const parsedWords = parseAndFilterCards(remoteCardsInfo, frontField, backField);

    return NextResponse.json({
      success: true,
      remoteCards: parsedWords,
      remoteReviews
    });
  } catch (error: any) {
    logger.error('Исключение в API /api/anki/sync-db', error);
    return NextResponse.json(
      { error: error.message || 'Произошла непредвиденная ошибка при синхронизации' },
      { status: 500 }
    );
  }
}

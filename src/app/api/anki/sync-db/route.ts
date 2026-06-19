import { NextRequest, NextResponse } from 'next/server';
import { ankiClient } from '@/plugins/anki/client';
import { parseAndFilterCards } from '@/plugins/anki/filter';
import { logger } from '@/lib/logger';
import { verifyCsrf } from '@/lib/csrf';
import { cleanTranslationJunk } from '@/core/localDeckService';

export async function POST(request: NextRequest) {
  if (process.env.ANKI_ENABLED === 'false') {
    return NextResponse.json({ error: 'Anki integration is disabled' }, { status: 403 });
  }

  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Blocked unauthorized request to /api/anki/sync-db');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      profileId, 
      deckName, 
      frontField = 'Front', 
      backField = 'Back', 
      deckMappings,
      localReviews = [], 
      localWords = [] 
    } = body;

    const sessionId = body.sessionId;
    const logPrefix = sessionId ? `[Session: ${sessionId}] ` : '';

    if (!profileId || !deckName) {
      logger.warn(`${logPrefix}[Step: Validation] Пропущена синхронизация: отсутствуют profileId или deckName`);
      return NextResponse.json(
        { error: 'Параметры profileId и deckName обязательны' },
        { status: 400 }
      );
    }

    logger.info(`${logPrefix}[Step: Start] Начало двусторонней синхронизации для колоды "${deckName}" (профиль: ${profileId})`);

    // 1. Записываем несинхронизированные локальные отзывы в Anki
    if (localReviews.length > 0) {
      logger.info(`${logPrefix}[Step: ReviewsSync] Синхронизация локальных отзывов с Anki: отправка ${localReviews.length} записей`);
      
      // Получаем уже существующие отзывы в Anki для этих карт, чтобы избежать дублирования
      const localCardIds: number[] = Array.from(new Set(localReviews.map((r: { cardId: number | string }) => Number(r.cardId))));
      const existingTimestamps = new Set<number>();
      
      // Получаем информацию о картах из Anki для определения правильного reviewType
      const ankiCardsMap: Map<number, { interval: number; queue: number; type: number }> = new Map();
      try {
        const existingReviews = await ankiClient.getReviewsOfCards(localCardIds);
        for (const cid of localCardIds) {
          const revs = existingReviews[cid] || [];
          for (const r of revs) {
            existingTimestamps.add(r.id);
          }
        }
        
        // Запрашиваем cardsInfo для определения текущего состояния каждой карты в Anki
        const cardsInfoForType = await ankiClient.getCardsInfo(localCardIds);
        for (const ci of cardsInfoForType) {
          ankiCardsMap.set(ci.cardId, { interval: ci.interval, queue: ci.queue, type: ci.type });
        }
      } catch (err) {
        logger.warn(`${logPrefix}[Step: ReviewsSync] Не удалось получить историю/информацию о картах для дедупликации`, err);
      }

      const reviewsToInsert: Array<[number, number, number, number, number, number, number, number, number]> = [];
      const relearnCardIds: number[] = [];

      for (const rev of localReviews) {
        // Пропускаем отзывы, которые уже есть в Anki
        if (existingTimestamps.has(rev.timestamp)) {
          logger.info(`${logPrefix}[Step: ReviewsSync] Отзыв с таймстемпом ${rev.timestamp} для карты ${rev.cardId} уже есть в Anki, пропускаем`);
          continue;
        }

        if (rev.ease === 1) {
          relearnCardIds.push(rev.cardId);
        }

        // Определяем тип повторения на основе реального состояния карты в Anki
        // 0=learn (новая карта, первый раз), 1=review (повторение), 2=relearn (после ошибки)
        const ankiCard = ankiCardsMap.get(rev.cardId);
        let reviewType = 1; // По умолчанию — review
        
        if (rev.ease === 1) {
          reviewType = 2; // Again всегда relearn
        } else if (ankiCard) {
          // Если карта в Anki уже проходила обучение (interval > 0 или queue >= 1), это review
          if (ankiCard.interval > 0 || ankiCard.queue >= 1) {
            reviewType = 1; // Review
          } else {
            reviewType = 0; // Действительно новая карта в Anki
          }
        } else if (rev.lastInterval > 0) {
          reviewType = 1; // Есть предыдущий интервал — review
        }
        
        // Для lastInterval используем реальный Anki interval если локальный = 0
        let lastIvl = rev.lastInterval;
        if (lastIvl === 0 && ankiCard && ankiCard.interval > 0) {
          lastIvl = ankiCard.interval;
          logger.info(`${logPrefix}[Step: ReviewsSync] Скорректирован lastInterval для карты ${rev.cardId}: 0 → ${lastIvl} (из Anki)`);
        }

        reviewsToInsert.push([
          rev.timestamp,
          rev.cardId,
          -1, // usn
          rev.ease,
          rev.interval,
          lastIvl,
          0, // factor (0 для FSRS)
          rev.duration || 5000,
          reviewType
        ]);
      }

      try {
        if (relearnCardIds.length > 0) {
          await ankiClient.relearnCards(relearnCardIds);
        }

        // Обновляем дату повторения карты в Anki для корректного планирования
        const intervalGroups: Record<number, number[]> = {};
        for (const rev of localReviews) {
          if (existingTimestamps.has(rev.timestamp)) continue;
          if (rev.ease !== 1 && rev.interval > 0) {
            if (!intervalGroups[rev.interval]) {
              intervalGroups[rev.interval] = [];
            }
            intervalGroups[rev.interval].push(rev.cardId);
          }
        }
        for (const [interval, ids] of Object.entries(intervalGroups)) {
          await ankiClient.setDueDate(ids, `${interval}!`);
        }

        if (reviewsToInsert.length > 0) {
          await ankiClient.insertReviews(reviewsToInsert);
        }
        logger.info(`${logPrefix}[Step: ReviewsSync] Локальные отзывы успешно синхронизированы с Anki`);
      } catch (err) {
        logger.error(`${logPrefix}[Step: ReviewsSync] Ошибка при отправке локальных отзывов в AnkiConnect`, err);
        return NextResponse.json(
          { error: 'Не удалось синхронизировать локальные отзывы с Anki. Проверьте подключение.' },
          { status: 500 }
        );
      }
    }


    // 2. Получаем актуальный список карт из Anki для этой колоды
    const remoteCardsInfo: Awaited<ReturnType<typeof ankiClient.getCardsInfo>> = [];
    logger.info(`${logPrefix}[Step: QueryAnki] Получение актуального списка карт из Anki для колоды "${deckName}"`);
    try {
      const isAllDecks = deckName === '__all__';
      const remoteCardIds = isAllDecks
        ? await ankiClient.findCardsByQuery('deck:*')
        : await ankiClient.findCards(deckName);
      if (remoteCardIds.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < remoteCardIds.length; i += batchSize) {
          const batchIds = remoteCardIds.slice(i, i + batchSize);
          const batchInfo = await ankiClient.getCardsInfo(batchIds);
          remoteCardsInfo.push(...batchInfo);
        }
      }
      logger.info(`${logPrefix}[Step: QueryAnki] Получено ${remoteCardsInfo.length} карт из Anki`);
    } catch (err) {
      logger.error(`${logPrefix}[Step: QueryAnki] Не удалось получить информацию о картах из Anki`, err);
      return NextResponse.json(
        { error: 'Не удалось загрузить карты из Anki для синхронизации.' },
        { status: 500 }
      );
    }

    // 3. Выявляем карты с расхождениями для получения их истории отзывов (revlog)
    const cardsToFetchReviews: number[] = [];
    for (const remoteCard of remoteCardsInfo) {
      const lw = localWords.find((w: { id: number; status?: string; interval?: number }) => w.id === remoteCard.cardId);
      
      if (!lw) {
        // Карта есть в Anki, но нет локально — всегда запрашиваем историю.
        // Нельзя полагаться только на interval/queue, т.к. insertReviews
        // пишет в revlog, не обновляя поля самой карты.
        cardsToFetchReviews.push(remoteCard.cardId);
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
    let remoteReviews: Awaited<ReturnType<typeof ankiClient.getReviewsOfCards>> = {};
    if (cardsToFetchReviews.length > 0) {
      logger.info(`${logPrefix}[Step: FetchHistory] Запрос истории повторений из Anki для ${cardsToFetchReviews.length} измененных карт пакетом`);
      try {
        remoteReviews = await ankiClient.getReviewsOfCards(cardsToFetchReviews);
      } catch (err) {
        logger.error(`${logPrefix}[Step: FetchHistory] Не удалось получить логи повторений пакетом для измененных карт`, err);
      }
    }

    // 5. Парсим и классифицируем карточки для возврата на клиент
    const parsedWords = parseAndFilterCards(remoteCardsInfo, frontField, backField, undefined, deckMappings);

    // Очищаем переводы от HTML тегов и ограничиваем размер
    for (const card of parsedWords) {
      if (card.translation) {
        card.translation = cleanTranslationJunk(card.translation)
          .substring(0, 150);     // Лимитируем длину
      }
    }

    logger.info(`${logPrefix}[Step: Success] Двусторонняя синхронизация успешно завершена для колоды "${deckName}". Передано ${parsedWords.length} слов.`);

    return NextResponse.json({
      success: true,
      remoteCards: parsedWords,
      remoteReviews
    });
  } catch (error) {
    const body = await request.clone().json().catch(() => ({}));
    const logPrefix = body.sessionId ? `[Session: ${body.sessionId}] ` : '';
    logger.error(`${logPrefix}[Step: Error] Исключение в API /api/anki/sync-db`, error);
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : '') || 'Произошла непредвиденная ошибка при синхронизации' },
      { status: 500 }
    );
  }
}

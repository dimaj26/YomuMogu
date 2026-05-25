import { NextRequest, NextResponse } from 'next/server';
import { ankiClient } from '@/plugins/anki/client';
import { logger } from '@/lib/logger';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (process.env.ANKI_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Anki integration is disabled' }, { status: 403 });
  }

  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Blocked unauthorized request to /api/anki/sync');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { cardIds, cards } = body;

    let answers: Array<{ cardId: number; ease: number }> = [];

    if (cards && Array.isArray(cards)) {
      answers = cards.map(c => ({
        cardId: Number(c.cardId),
        ease: typeof c.ease === 'number' ? c.ease : 3
      }));
    } else if (cardIds && Array.isArray(cardIds)) {
      answers = cardIds.map(id => ({
        cardId: Number(id),
        ease: 3
      }));
    } else {
      logger.warn('Запрос к /api/anki/sync с некорректными параметрами (отсутствуют cardIds или cards)');
      return NextResponse.json(
        { error: 'Необходимо передать массив "cards" или "cardIds"' },
        { status: 400 }
      );
    }

    if (answers.length === 0) {
      return NextResponse.json({ success: true, message: 'Нет карточек для синхронизации' });
    }

    logger.info(`Запрос на синхронизацию карточек в Anki (количество: ${answers.length})`);
    
    let dueCardIds: number[] = [];
    try {
      dueCardIds = await ankiClient.findCardsByQuery('is:due');
    } catch (err) {
      logger.warn('Не удалось получить список due карт при синхронизации', err);
    }

    let filteredAnswers = answers;
    try {
      const cardsInfo = await ankiClient.getCardsInfo(answers.map(a => a.cardId));
      filteredAnswers = answers.filter(ans => {
        const card = cardsInfo.find(c => c.cardId === ans.cardId);
        if (!card) return false;

        const queue = card.queue;
        const type = card.type;
        const effectiveQueue = queue < 0 ? type : queue;

        if (effectiveQueue === 2) {
          return dueCardIds.includes(card.cardId);
        }
        return true;
      });
    } catch (err) {
      logger.error('Не удалось загрузить информацию о карточках при синхронизации, отправляем все', err);
    }

    const skippedCount = answers.length - filteredAnswers.length;
    if (skippedCount > 0) {
      logger.info(`Пропущено карточек (зрелые, не требующие повторения): ${skippedCount}`);
    }

    if (filteredAnswers.length > 0) {
      try {
        await ankiClient.answerCards(filteredAnswers);
        logger.info(`Карточки успешно синхронизированы: ${filteredAnswers.map(a => `${a.cardId} (ease: ${a.ease})`).join(', ')}`);
      } catch (err: any) {
        const errMsg = err.message || '';
        if (errMsg.includes('not at top of queue') || errMsg.includes('reviewer') || errMsg.includes('Invalid input')) {
          logger.warn('Обнаружена ошибка очереди планировщика Anki V3, запускаем резервную симуляцию повторения', err);
          await runFallbackSync(filteredAnswers);
        } else {
          throw err;
        }
      }
    } else {
      logger.info('Нет карточек для отправки в Anki (все пропущены)');
    }
    
    return NextResponse.json({ success: true, syncedCount: filteredAnswers.length, skippedCount });
  } catch (error: any) {
    logger.error('Исключение в API /api/anki/sync', error);
    return NextResponse.json(
      { error: error.message || 'Произошла ошибка при синхронизации карточек с Anki' },
      { status: 500 }
    );
  }
}

/**
 * Резервная симуляция прохождения карточек при ошибке очереди планировщика V3.
 * Напрямую обновляет интервалы (setDueDate/relearnCards) и вставляет записи в лог (insertReviews).
 */
async function runFallbackSync(answers: Array<{ cardId: number; ease: number }>) {
  const cardIds = answers.map(a => a.cardId);
  const cardsInfo = await ankiClient.getCardsInfo(cardIds);
  
  const relearnCardIds: number[] = [];
  const reviewsToInsert: Array<[number, number, number, number, number, number, number, number, number]> = [];
  const now = Date.now();

  for (const answer of answers) {
    const card = cardsInfo.find(c => c.cardId === answer.cardId);
    if (!card) {
      logger.warn(`Карточка ${answer.cardId} не найдена в Anki при резервной синхронизации`);
      continue;
    }

    const currentIvl = card.interval || 0;
    // Очереди 0=new, 1=learning, 3=relearning. Типы 0=new, 1=learning.
    const isNewOrLearning = card.queue === 0 || card.queue === 1 || card.queue === 3 || card.type === 0 || card.type === 1;

    let newIvl = 0;
    const prevIvl = currentIvl;
    
    // Типы лога в revlog: 0=learn, 1=review, 2=relearn
    let reviewType = 1;
    if (card.type === 0 || card.type === 1) reviewType = 0;
    else if (card.type === 3) reviewType = 2;

    if (answer.ease === 1) {
      // Again: отправляем в relearnCards
      relearnCardIds.push(answer.cardId);
      newIvl = -60; // Отрицательное число секунд (1 минута) в логе обучения
      reviewType = 2; // Relearn
    } else {
      // Hard / Good / Easy: рассчитываем новый интервал в днях
      if (answer.ease === 2) {
        newIvl = isNewOrLearning ? 1 : Math.max(1, Math.round(currentIvl * 1.2));
      } else if (answer.ease === 3) {
        newIvl = isNewOrLearning ? 2 : Math.max(2, Math.round(currentIvl * 2.5));
      } else if (answer.ease === 4) {
        newIvl = isNewOrLearning ? 4 : Math.max(4, Math.round(currentIvl * 3.5));
      }
      
      // Устанавливаем интервал и due date через setDueDate с модификатором '!'
      await ankiClient.setDueDate([answer.cardId], `${newIvl}!`);
    }

    // Запись в revlog
    reviewsToInsert.push([
      now,
      answer.cardId,
      -1, // usn (-1 для локальных правок)
      answer.ease,
      newIvl,
      prevIvl,
      0, // newFactor (0 для FSRS)
      5000, // duration (5000мс)
      reviewType
    ]);
  }

  if (relearnCardIds.length > 0) {
    await ankiClient.relearnCards(relearnCardIds);
  }

  if (reviewsToInsert.length > 0) {
    await ankiClient.insertReviews(reviewsToInsert);
    logger.info(`Резервная синхронизация: записано ${reviewsToInsert.length} ответов напрямую в историю повторений Anki`);
  }
}

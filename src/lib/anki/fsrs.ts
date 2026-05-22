import { fsrs, Card, State, Rating } from 'ts-fsrs';
import type { LocalWord } from '../db';

// Инициализируем стандартный FSRS-планировщик с дефолтными параметрами
const scheduler = fsrs();

/**
 * Сбрасывает время до начала дня (00:00:00) по местному времени устройства.
 * Это необходимо, чтобы избежать блокировки карточки на полные 24 часа
 * и сблизить поведение с границами дня в Anki (где новые сутки начинаются рано утром).
 */
export function alignToDayBoundary(date: Date): Date {
  const aligned = new Date(date);
  aligned.setHours(4, 0, 0, 0);
  return aligned;
}

/**
 * Конвертирует локальное слово из БД в структуру карточки для ts-fsrs
 */
export function mapLocalToFsrsCard(word: LocalWord): Card {
  let state = State.New;
  
  if (word.status === 'learning') {
    state = State.Learning;
  } else if (word.status === 'review' || word.status === 'mature') {
    state = State.Review;
  }

  const now = Date.now();
  const lastReviewDate = word.lastReview ? new Date(word.lastReview) : undefined;
  
  // Вычисляем количество дней, прошедших с последнего повторения
  let elapsedDays = 0;
  if (lastReviewDate) {
    const diffTime = Math.abs(now - lastReviewDate.getTime());
    elapsedDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  return {
    due: new Date(word.due || now),
    stability: word.stability || 0,
    difficulty: word.difficulty || 0,
    elapsed_days: elapsedDays,
    scheduled_days: word.interval || 0,
    learning_steps: 0, // Необходимое поле для новой версии ts-fsrs
    reps: word.reps || 0,
    lapses: word.lapses || 0,
    state,
    last_review: lastReviewDate
  };
}

/**
 * Конвертирует карту ts-fsrs обратно в поля локального слова для сохранения в БД
 */
export function mapFsrsToLocalWord(word: LocalWord, card: Card): LocalWord {
  let status: 'new' | 'learning' | 'review' | 'mature' = 'new';
  
  if (card.state === State.New) {
    status = 'new';
  } else if (card.state === State.Learning || card.state === State.Relearning) {
    status = 'learning';
  } else if (card.state === State.Review) {
    // В Anki зрелыми (mature) считаются карты с интервалом от 21 дня
    status = card.scheduled_days >= 21 ? 'mature' : 'review';
  }

  // Выравниваем due date до начала дня для локального планирования только для интервалов >= 1 дня
  const alignedDue = card.scheduled_days >= 1 ? alignToDayBoundary(card.due) : card.due;

  return {
    ...word,
    stability: card.stability,
    difficulty: card.difficulty,
    interval: card.scheduled_days,
    due: alignedDue.getTime(),
    lastReview: card.last_review ? card.last_review.getTime() : Date.now(),
    status,
    reps: card.reps,
    lapses: card.lapses
  };
}

/**
 * Расчет следующего FSRS-состояния карточки на основе оценки пользователя
 * @param word Локальное слово из БД
 * @param ease Оценка (1 = Again, 2 = Hard, 3 = Good, 4 = Easy)
 * @param now Время повторения (по умолчанию текущее)
 */
export function calculateNextFsrsState(
  word: LocalWord,
  ease: number,
  now: Date = new Date()
): { updatedWord: LocalWord; newInterval: number; lastInterval: number } {
  const card = mapLocalToFsrsCard(word);
  
  // Мапим оценки YomuMogu (1-4) на Rating из ts-fsrs
  let rating = Rating.Good;
  if (ease === 1) rating = Rating.Again;
  else if (ease === 2) rating = Rating.Hard;
  else if (ease === 3) rating = Rating.Good;
  else if (ease === 4) rating = Rating.Easy;

  // Рассчитываем следующее состояние
  const schedulingInfo = scheduler.repeat(card, now);
  const nextStep = schedulingInfo[rating];
  
  const updatedWord = mapFsrsToLocalWord(word, nextStep.card);
  
  return {
    updatedWord,
    newInterval: nextStep.card.scheduled_days,
    lastInterval: card.scheduled_days
  };
}

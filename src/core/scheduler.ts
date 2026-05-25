import { fsrs, Card, State, Rating } from 'ts-fsrs';
import type { LocalWord, FsrsState } from './types';

// Инициализируем стандартный FSRS-планировщик с отключенными краткосрочными шагами обучения
const scheduler = fsrs({
  enable_short_term: false
});


/**
 * Сбрасывает время до начала дня (04:00:00) по местному времени устройства.
 * Это необходимо, чтобы избежать блокировки карточки на полные 24 часа
 * и сблизить поведение с границами дня в Anki (где новые сутки начинаются рано утром).
 */
export function alignToDayBoundary(date: Date): Date {
  const aligned = new Date(date);
  aligned.setHours(4, 0, 0, 0);
  return aligned;
}

/**
 * Создает пустое/новое состояние FSRS
 */
export function createDefaultFsrsState(initialDue: number = Date.now()): FsrsState {
  return {
    stability: 0,
    difficulty: 0,
    interval: 0,
    due: initialDue,
    reps: 0,
    lapses: 0,
    status: 'new'
  };
}

/**
 * Конвертирует состояние FSRS в структуру карточки для ts-fsrs
 */
export function mapFsrsStateToCard(state: FsrsState, now?: Date): Card {
  let fsrsState = State.New;
  
  if (state.status === 'learning') {
    fsrsState = State.Learning;
  } else if (state.status === 'review' || state.status === 'mature') {
    fsrsState = State.Review;
  }

  const referenceTime = now ? now.getTime() : Date.now();
  const lastReviewDate = state.lastReview ? new Date(state.lastReview) : undefined;
  
  // Вычисляем количество дней, прошедших с последнего повторения
  let elapsedDays = 0;
  if (lastReviewDate) {
    const diffTime = Math.abs(referenceTime - lastReviewDate.getTime());
    elapsedDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  return {
    due: new Date(state.due || referenceTime),
    stability: state.stability || 0,
    difficulty: state.difficulty || 0,
    elapsed_days: elapsedDays,
    scheduled_days: state.interval || 0,
    learning_steps: 0,
    reps: state.reps || 0,
    lapses: state.lapses || 0,
    state: fsrsState,
    last_review: lastReviewDate
  };
}

/**
 * Конвертирует карту ts-fsrs обратно в поля FsrsState
 */
export function mapFsrsToSubState(state: FsrsState, card: Card): FsrsState {
  let status: 'new' | 'learning' | 'review' | 'mature' = 'new';
  
  if (card.state === State.New) {
    status = 'new';
  } else if (card.state === State.Learning || card.state === State.Relearning) {
    status = 'learning';
  } else if (card.state === State.Review) {
    status = card.scheduled_days >= 21 ? 'mature' : 'review';
  }

  const alignedDue = card.scheduled_days >= 1 ? alignToDayBoundary(card.due) : card.due;

  return {
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
 * Конвертирует локальное слово из БД в структуру карточки для ts-fsrs (legacy)
 */
export function mapLocalToFsrsCard(word: LocalWord, now?: Date): Card {
  // Для обратной совместимости, если у слова плоская структура
  const flatState = (word as any).passive || {
    stability: (word as any).stability,
    difficulty: (word as any).difficulty,
    interval: (word as any).interval,
    due: (word as any).due,
    lastReview: (word as any).lastReview,
    reps: (word as any).reps,
    lapses: (word as any).lapses,
    status: (word as any).status
  };
  return mapFsrsStateToCard(flatState, now);
}

/**
 * Конвертирует карту ts-fsrs обратно в поля локального слова для сохранения в БД (legacy)
 */
export function mapFsrsToLocalWord(word: LocalWord, card: Card): LocalWord {
  // Для обратной совместимости, если у слова плоская структура
  if (!(word as any).passive) {
    const subState = mapFsrsToSubState({} as FsrsState, card);
    return {
      ...word,
      stability: subState.stability,
      difficulty: subState.difficulty,
      interval: subState.interval,
      due: subState.due,
      lastReview: subState.lastReview,
      status: subState.status,
      reps: subState.reps,
      lapses: subState.lapses
    } as any;
  }
  
  const passive = mapFsrsToSubState(word.passive, card);
  return {
    ...word,
    passive
  };
}

/**
 * Расчет следующего FSRS-состояния на основе плоского стейта FsrsState
 */
export function calculateNextFsrsStateForState(
  state: FsrsState,
  ease: number,
  now: Date = new Date()
): { updatedState: FsrsState; newInterval: number; lastInterval: number } {
  const card = mapFsrsStateToCard(state, now);
  
  let rating = Rating.Good;
  if (ease === 1) rating = Rating.Again;
  else if (ease === 2) rating = Rating.Hard;
  else if (ease === 3) rating = Rating.Good;
  else if (ease === 4) rating = Rating.Easy;

  const schedulingInfo = scheduler.repeat(card, now);
  const nextStep = schedulingInfo[rating];
  
  const updatedState = mapFsrsToSubState(state, nextStep.card);
  
  return {
    updatedState,
    newInterval: nextStep.card.scheduled_days,
    lastInterval: card.scheduled_days
  };
}

/**
 * Расчет следующего FSRS-состояния карточки на основе оценки пользователя.
 * Поддерживает полиморфный вызов: для плоских объектов (UiWord) или вложенных (LocalWord).
 * 
 * @param word Локальное слово из БД или плоский FSRS объект
 * @param ease Оценка (1 = Again, 2 = Hard, 3 = Good, 4 = Easy)
 * @param typeOrNow Тип повторения ('passive' | 'active') ИЛИ дата повторения (для совместимости)
 * @param nowArg Время повторения (используется, если третьим параметром передан тип)
 */
export function calculateNextFsrsState(
  word: any,
  ease: number,
  typeOrNow?: 'passive' | 'active' | Date,
  nowArg?: Date
): { updatedWord: any; newInterval: number; lastInterval: number } {
  let type: 'passive' | 'active' | undefined = undefined;
  let now = new Date();

  if (typeOrNow instanceof Date) {
    now = typeOrNow;
  } else if (typeof typeOrNow === 'string') {
    type = typeOrNow as 'passive' | 'active';
    if (nowArg) {
      now = nowArg;
    }
  } else if (nowArg) {
    now = nowArg;
  }

  if (type && (word.passive || word.active)) {
    // Вложенная структура LocalWord
    const state = word[type] || createDefaultFsrsState(now.getTime());
    const { updatedState, newInterval, lastInterval } = calculateNextFsrsStateForState(state, ease, now);
    return {
      updatedWord: {
        ...word,
        [type]: updatedState
      },
      newInterval,
      lastInterval
    };
  } else {
    // Плоская структура (UiWord, legacy-костыли или тесты)
    const state: FsrsState = {
      stability: word.stability ?? 0,
      difficulty: word.difficulty ?? 0,
      interval: word.interval ?? 0,
      due: word.due ?? now.getTime(),
      lastReview: word.lastReview,
      reps: word.reps ?? 0,
      lapses: word.lapses ?? 0,
      status: word.status ?? 'new'
    };
    
    const { updatedState, newInterval, lastInterval } = calculateNextFsrsStateForState(state, ease, now);
    
    return {
      updatedWord: {
        ...word,
        stability: updatedState.stability,
        difficulty: updatedState.difficulty,
        interval: updatedState.interval,
        due: updatedState.due,
        lastReview: updatedState.lastReview,
        reps: updatedState.reps,
        lapses: updatedState.lapses,
        status: updatedState.status
      },
      newInterval,
      lastInterval
    };
  }
}



import { fsrs, Card, State, Rating } from 'ts-fsrs';
import type { LocalWord, FsrsState } from './types';
import { QUEST_RESET_HOUR } from './intervals';

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
  aligned.setHours(QUEST_RESET_HOUR, 0, 0, 0);
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
    if (type === 'active') {
      const state = word.active || createDefaultFsrsState(now.getTime());
      const { updatedState, newInterval, lastInterval } = calculateNextFsrsStateForState(state, ease, now);
      
      // Вычисляем параметры пассивного состояния на основе обновленного активного (коэффициент 2.5x)
      const passiveInterval = Math.round(newInterval * 2.5);
      const passiveStability = updatedState.stability * 2.5;
      const lastReview = updatedState.lastReview || now.getTime();
      const alignedPassiveDue = passiveInterval >= 1
        ? alignToDayBoundary(new Date(lastReview + passiveInterval * 24 * 3600 * 1000))
        : new Date(lastReview);
        
      const passiveState: FsrsState = {
        stability: passiveStability,
        difficulty: updatedState.difficulty,
        interval: passiveInterval,
        due: alignedPassiveDue.getTime(),
        lastReview,
        status: updatedState.status,
        reps: updatedState.reps,
        lapses: updatedState.lapses
      };

      return {
        updatedWord: {
          ...word,
          active: updatedState,
          passive: passiveState
        },
        newInterval,
        lastInterval
      };
    } else {
      // Пассивный обзор: не запускаем FSRS-математику, просто сдвигаем passive.due на величину passive.interval
      const state = word.passive || createDefaultFsrsState(now.getTime());
      const passiveInterval = state.interval || 0;
      const nextDue = now.getTime() + passiveInterval * 24 * 3600 * 1000;
      const alignedPassiveDue = passiveInterval >= 1
        ? alignToDayBoundary(new Date(nextDue))
        : new Date(nextDue);
        
      const passiveState: FsrsState = {
        ...state,
        due: alignedPassiveDue.getTime(),
        lastReview: now.getTime()
      };

      return {
        updatedWord: {
          ...word,
          passive: passiveState
        },
        newInterval: passiveInterval,
        lastInterval: passiveInterval
      };
    }
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

/**
 * Выравнивает пассивное состояние на основе активного, если пассивное отстает
 * (т.е. интервал меньше или дата due наступит раньше).
 * Все комментарии в коде пишутся на русском языке.
 */
export function alignPassiveToActiveState(word: LocalWord): LocalWord {
  if (!word.passive || !word.active) return word;

  const targetPassiveInterval = Math.round(word.active.interval * 2.5);
  const passiveIsWorse =
    word.passive.interval < targetPassiveInterval ||
    word.passive.due < word.active.due;

  if (passiveIsWorse) {
    const passiveStability = word.active.stability * 2.5;
    const lastReview = word.active.lastReview || Date.now();
    const alignedPassiveDue = targetPassiveInterval >= 1
      ? alignToDayBoundary(new Date(lastReview + targetPassiveInterval * 24 * 3600 * 1000))
      : new Date(lastReview);

    return {
      ...word,
      passive: {
        stability: passiveStability,
        difficulty: word.active.difficulty,
        interval: targetPassiveInterval,
        due: alignedPassiveDue.getTime(),
        status: word.active.status,
        reps: word.active.reps,
        lapses: word.active.lapses,
        lastReview
      }
    };
  }

  return word;
}

/**
 * Проверяет, подходит ли предложение пользователя в качестве качественного примера
 * контекста (contextExamples) для последующего использования в Cloze Deletion квизах.
 * 
 * Правила:
 * 1. Длина предложения не менее 8 символов.
 * 2. Содержит целевое японское слово.
 * 3. Содержит хотя бы один падежный показатель (を/が/に/で) или кандзи вне целевого слова.
 * 4. Исключает тривиальные шаблоны объявления слова (типа "словоです", "словоがあります").
 */
export function isGoodContextExample(sentence: string, targetWord: string): boolean {
  const cleaned = sentence.trim();
  
  if (cleaned.length < 6) return false;
  if (!cleaned.includes(targetWord)) return false;

  // Проверка наличия падежных/грамматических частиц (を, が, に, で, は, も, と, へ)
  const hasParticle = /[をがにではもとへ]/.test(cleaned);
  if (!hasParticle) return false;

  const sentenceWithoutTarget = cleaned.replace(targetWord, '');

  // Исключаем простейшие предложения
  const isSimplePattern =
    cleaned === `${targetWord}です` ||
    cleaned === `${targetWord}だ` ||
    cleaned === `${targetWord}がある` ||
    cleaned === `${targetWord}があります` ||
    cleaned === `${targetWord}がいる` ||
    cleaned === `${targetWord}がいます` ||
    cleaned === `${targetWord}はなんですか` ||
    /^[はが]$/.test(sentenceWithoutTarget.trim());

  if (isSimplePattern) return false;

  return true;
}

/**
 * Проверяет, должно ли слово быть направлено в чат (активная стабильность < 3 дней или количество ошибок lapses >= 2).
 */
export function shouldRouteToChat(word: LocalWord): boolean {
  if (!word || !word.active) return false;
  if (word.active.status === 'new') return false;
  return word.active.stability < 3 || word.active.lapses >= 2;
}



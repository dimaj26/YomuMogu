export interface CardWord {
  id: number;
  word: string;
  translation: string;
  interval: number;
  status: 'new' | 'learning' | 'review' | 'mature';
  deckName: string;
  rawFront: string;
  rawBack: string;
  cardIds?: number[];
  tags?: string[];
}

export interface FsrsState {
  stability: number;
  difficulty: number;
  interval: number; // интервал повторения в днях
  due: number; // timestamp (ms) даты следующего повторения
  lastReview?: number; // timestamp последнего повторения
  reps: number; // количество повторений
  lapses: number; // количество ошибок (Again)
  status: 'new' | 'learning' | 'review' | 'mature';
}

export interface WordContextExample {
  sentence: string;
  translation?: string;
  timestamp: number;
}

export interface LocalWord {
  profileId: string;
  id: number; // cardId
  word: string;
  reading: string;
  translation: string;
  category: string; // Заменяет deckName
  source: 'anki' | 'starter' | 'manual';
  passive: FsrsState;
  active: FsrsState;
  contextExamples?: WordContextExample[];
  mnemonic?: string; // Пользовательская мнемоника / ИИ-этимология
  tags?: string[]; // Ситуационные теги разметки
}

export interface LocalReview {
  id?: number; // локальный автоинкрементный ID
  profileId: string;
  cardId: number; // cardId
  ease: number; // оценка (1-4)
  interval: number; // новый интервал в днях
  lastInterval: number; // предыдущий интервал в днях
  duration: number; // время ответа в мс
  timestamp: number; // точное время ответа (ms)
  synced: number; // 0 = не синхронизировано, 1 = синхронизировано
  reviewType?: 'passive' | 'active'; // тип отзыва: пассивный или активный
}

export interface UiWord {
  profileId: string;
  id: string; // Строковый ID элемента интерфейса
  word: string; // Японское написание
  reading: string; // Хирагана чтение (опционально)
  translation: string; // Русский перевод
  status: 'new' | 'learning' | 'review' | 'mature';
  stability: number;
  difficulty: number;
  interval: number; // Интервал в днях
  due: number; // Timestamp следующего повторения (ms)
  lastReview?: number;
  reps: number;
  lapses: number;
}

export interface GrammarProgress {
  profileId: string;
  ruleId: string;
  stepIndex: number; // индекс шага в интервалах Leitner: 0-4 (интервалы: 1, 3, 7, 14, 30 дней)
  lastReviewed?: number; // timestamp последнего повторения
  due: number; // timestamp даты следующего повторения (ms)
  status: 'new' | 'learning' | 'review' | 'mature';
}


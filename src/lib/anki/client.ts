import { logger } from '../logger';

export interface AnkiCardField {
  value: string;
  order: number;
}

export interface AnkiCardInfo {
  cardId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, AnkiCardField>;
  interval: number;
  note: number;
  queue: number;
  due: number;
  type: number;
}

export class AnkiConnectClient {
  private url: string;

  constructor(url: string = 'http://127.0.0.1:8765') {
    this.url = url;
  }

  private async request<T>(action: string, params: Record<string, any> = {}): Promise<T> {
    try {
      logger.debug(`Запрос к AnkiConnect: ${action}`, params);
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          version: 6,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`AnkiConnect responded with status: ${response.status}`);
      }

      const json = await response.json();
      
      if (json.error) {
        throw new Error(`AnkiConnect error: ${json.error}`);
      }

      return json.result as T;
    } catch (error: any) {
      logger.error(`Сбой запроса к AnkiConnect (${action})`, error);
      if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
        throw new Error('Anki не запущен или плагин AnkiConnect не активен. Пожалуйста, запустите Anki.');
      }
      throw error;
    }
  }

  /**
   * Проверка связи с AnkiConnect
   */
  async checkConnection(): Promise<boolean> {
    try {
      const version = await this.request<number>('version');
      const connected = version >= 6;
      if (connected) {
        logger.info('Успешное подключение к AnkiConnect');
      }
      return connected;
    } catch (err) {
      logger.warn('Не удалось подключиться к AnkiConnect при проверке связи');
      return false;
    }
  }

  /**
   * Получение списка всех колод
   */
  async getDeckNames(): Promise<string[]> {
    return this.request<string[]>('deckNames');
  }

  /**
   * Поиск ID карточек в указанной колоде
   */
  async findCards(deckName: string): Promise<number[]> {
    // Используем запрос вида deck:"Имя_Колоды"
    return this.request<number[]>('findCards', {
      query: `deck:"${deckName}"`,
    });
  }

  /**
   * Получение подробной информации по массиву ID карточек
   */
  async getCardsInfo(cardIds: number[]): Promise<AnkiCardInfo[]> {
    if (cardIds.length === 0) return [];
    return this.request<AnkiCardInfo[]>('cardsInfo', {
      cards: cardIds,
    });
  }

  /**
   * Отправляет ответы (оценки) для массива карточек
   */
  async answerCards(answers: Array<{ cardId: number; ease: number }>): Promise<boolean> {
    if (answers.length === 0) return true;
    await this.request<void>('answerCards', { answers });
    return true;
  }

  /**
   * Сбрасывает карточки в режим повторного изучения (relearning)
   */
  async relearnCards(cardIds: number[]): Promise<boolean> {
    if (cardIds.length === 0) return true;
    await this.request<void>('relearnCards', { cards: cardIds });
    return true;
  }

  /**
   * Устанавливает дату следующего повторения и/или интервал для карточек
   */
  async setDueDate(cardIds: number[], due: string | number): Promise<boolean> {
    if (cardIds.length === 0) return true;
    try {
      await this.request<void>('setDueDate', { cards: cardIds, due });
    } catch (error: any) {
      if (error.message && error.message.includes("unexpected keyword argument 'due'")) {
        logger.info('Повторный запрос setDueDate с параметром days для совместимости с установленной версией AnkiConnect');
        await this.request<void>('setDueDate', { cards: cardIds, days: due });
      } else {
        throw error;
      }
    }
    return true;
  }

  /**
   * Напрямую записывает историю повторений (логи) в базу данных Anki (таблица revlog)
   */
  async insertReviews(reviews: Array<[number, number, number, number, number, number, number, number, number]>): Promise<boolean> {
    if (reviews.length === 0) return true;
    await this.request<void>('insertReviews', { reviews });
    return true;
  }

  /**
   * Добавляет новую заметку (карточку) в Anki
   */
  async addNote(
    deckName: string,
    modelName: string,
    fields: Record<string, string>,
    tags: string[] = []
  ): Promise<number> {
    return this.request<number>('addNote', {
      note: {
        deckName,
        modelName,
        fields,
        tags,
        options: {
          allowDuplicate: false,
          duplicateScope: 'deck',
        },
      },
    });
  }

  /**
   * Поиск карточек по произвольному поисковому запросу Anki
   */
  async findCardsByQuery(query: string): Promise<number[]> {
    return this.request<number[]>('findCards', { query });
  }

  /**
   * Создание новой колоды
   */
  async createDeck(deckName: string): Promise<void> {
    await this.request<void>('createDeck', { deck: deckName });
  }

  /**
   * Удаление колод
   */
  async deleteDecks(deckNames: string[], cardsToo: boolean = true): Promise<void> {
    await this.request<void>('deleteDecks', { decks: deckNames, cardsToo });
  }

  /**
   * Добавление нескольких заметок (карточек) в Anki пакетом
   */
  async addNotes(notes: Array<{ deckName: string; modelName: string; fields: Record<string, string>; tags?: string[] }>): Promise<number[]> {
    return this.request<number[]>('addNotes', { notes });
  }

  /**
   * Создание нового типа заметки (модели) с полями и шаблоном карточки
   */
  async createModel(
    modelName: string,
    inOrderFields: string[],
    cardTemplates: Array<{ Name: string; Front: string; Back: string }>,
    css: string = ''
  ): Promise<void> {
    await this.request<void>('createModel', {
      modelName,
      inOrderFields,
      cardTemplates,
      css,
    });
  }

  /**
   * Получение списка всех типов заметок (моделей)
   */
  async modelNames(): Promise<string[]> {
    return this.request<string[]>('modelNames');
  }

  /**
   * Получение логов повторений для конкретной карточки
   */
  async getReviewsOfCard(cardId: number): Promise<Array<{
    id: number;
    usn: number;
    ease: number;
    ivl: number;
    lastIvl: number;
    factor: number;
    time: number;
    type: number;
  }>> {
    return this.request<Array<{
      id: number;
      usn: number;
      ease: number;
      ivl: number;
      lastIvl: number;
      factor: number;
      time: number;
      type: number;
    }>>('cardReviews', { card: cardId });
  }

  /**
   * Получение логов повторений пакетом для нескольких карточек
   */
  async getReviewsOfCards(cardIds: number[]): Promise<Record<number, Array<{
    id: number;
    usn: number;
    ease: number;
    ivl: number;
    lastIvl: number;
    factor: number;
    time: number;
    type: number;
  }>>> {
    if (cardIds.length === 0) return {};
    return this.request<Record<number, Array<{
      id: number;
      usn: number;
      ease: number;
      ivl: number;
      lastIvl: number;
      factor: number;
      time: number;
      type: number;
    }>>>('getReviewsOfCards', { cards: cardIds });
  }
}

export const ankiClient = new AnkiConnectClient();

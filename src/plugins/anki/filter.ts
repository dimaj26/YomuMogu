import { AnkiCardInfo } from './client';
import { CardWord as AnkiWord } from '../../core/types';
export type { AnkiWord };

/**
 * Очищает HTML-теги из строк Anki
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  
  // 1. Сначала удаляем теги <rt>...</rt> и <rp>...</rp> вместе с их содержимым (чтения фуриганы)
  let clean = html
    .replace(/<rt>[\s\S]*?<\/rt>/gi, '')
    .replace(/<rp>[\s\S]*?<\/rp>/gi, '');
    
  // 2. Теперь удаляем все остальные HTML-теги
  clean = clean.replace(/<[^>]*>/g, '');
  
  // 3. Заменяем HTML-сущности
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
    
  // 4. Удаляем круглые, квадратные и специфические японские скобки вместе с их содержимым,
  // только если они содержат японские символы (Hiragana, Katakana, Kanji).
  // Это сохраняет русские и английские пояснения в скобках, такие как "есть (кушать)".
  const jpCharRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
  clean = clean
    .replace(/\[([^\]]*)\]/g, (match, content) => jpCharRegex.test(content) ? '' : match)
    .replace(/\(([^)]*)\)/g, (match, content) => jpCharRegex.test(content) ? '' : match)
    .replace(/〔([^〕]*)〕/g, (match, content) => jpCharRegex.test(content) ? '' : match)
    .replace(/（([^）]*)）/g, (match, content) => jpCharRegex.test(content) ? '' : match);

  return clean.trim();
}

/**
 * Классификация карты на основе интервала, статуса очереди и списка due карт
 */
export function getWordStatus(
  card: AnkiCardInfo,
  dueCardIds?: number[]
): 'new' | 'learning' | 'review' | 'mature' {
  const queue = card.queue;
  const type = card.type;
  const interval = card.interval || 0;

  // Если карта приостановлена или закопана (queue < 0), ориентируемся на ее тип
  const effectiveQueue = queue < 0 ? type : queue;

  // Если интервал равен 0 и очередь не относится к изучению, считаем карту новой (new)
  if (interval === 0 && effectiveQueue !== 1 && effectiveQueue !== 3) {
    return 'new';
  }

  // queue: 0 = new, 1 = learning, 2 = review, 3 = day learning/relearning
  if (effectiveQueue === 0) {
    return 'new';
  }
  
  if (effectiveQueue === 1 || effectiveQueue === 3) {
    return 'learning';
  }
  
  if (effectiveQueue === 2) {
    // Если передан список dueCardIds, статус review устанавливается только если карта due
    if (dueCardIds && dueCardIds.length > 0) {
      return dueCardIds.includes(card.cardId) ? 'review' : 'mature';
    }
    // В Anki зрелыми (mature) считаются карты с интервалом от 21 дня (фолбек)
    return interval < 21 ? 'review' : 'mature';
  }
  
  // Дефолтный фолбек по интервалу, если статус очереди не определен
  if (interval === 0) return 'new';
  if (dueCardIds && dueCardIds.length > 0) {
    return dueCardIds.includes(card.cardId) ? 'review' : 'mature';
  }
  return interval < 21 ? 'review' : 'mature';
}

/**
 * Обрабатывает сырые карты Anki и преобразует их в удобный формат слов
 */
export function parseAndFilterCards(
  cards: AnkiCardInfo[],
  frontField: string = 'Front',
  backField: string = 'Back',
  dueCardIds?: number[],
  deckMappings?: Record<string, { frontField: string; backField: string; audioField?: string; imageField?: string }>
): AnkiWord[] {
  const wordMap = new Map<string, AnkiWord>();
  
  const statusPriority: Record<string, number> = {
    review: 3,
    learning: 2,
    new: 1,
    mature: 0,
  };

  for (const card of cards) {
    let activeFrontField = frontField;
    let activeBackField = backField;

    if (deckMappings && card.deckName && deckMappings[card.deckName]) {
      const mapping = deckMappings[card.deckName];
      activeFrontField = mapping.frontField || frontField;
      activeBackField = mapping.backField || backField;
    }

    // Ищем поля по имени (регистронезависимо)
    const frontKey = Object.keys(card.fields).find(
      (key) => key.toLowerCase() === activeFrontField.toLowerCase()
    ) || Object.keys(card.fields)[0];
    
    const backKey = Object.keys(card.fields).find(
      (key) => key.toLowerCase() === activeBackField.toLowerCase()
    ) || Object.keys(card.fields)[1] || Object.keys(card.fields)[0];

    const rawFront = card.fields[frontKey]?.value || '';
    const rawBack = card.fields[backKey]?.value || '';

    const word = stripHtml(rawFront);
    const translation = stripHtml(rawBack);

    if (!word) continue;

    const status = getWordStatus(card, dueCardIds);
    const currentWord: AnkiWord = {
      id: card.cardId,
      word,
      translation,
      interval: card.interval || 0,
      status,
      deckName: card.deckName,
      rawFront,
      rawBack,
      cardIds: [card.cardId],
    };

    const existing = wordMap.get(word);
    if (!existing) {
      wordMap.set(word, currentWord);
    } else {
      // Добавляем ID карточки в список
      if (existing.cardIds) {
        if (!existing.cardIds.includes(card.cardId)) {
          existing.cardIds.push(card.cardId);
        }
      } else {
        existing.cardIds = [existing.id, card.cardId];
      }

      // Сравниваем приоритеты статусов
      const existingPriority = statusPriority[existing.status] ?? -1;
      const currentPriority = statusPriority[status] ?? -1;

      if (currentPriority > existingPriority) {
        // Перезаписываем свойства свойствами более приоритетной карты
        existing.id = currentWord.id;
        existing.status = currentWord.status;
        existing.interval = currentWord.interval;
        existing.deckName = currentWord.deckName;
        existing.rawFront = currentWord.rawFront;
        existing.rawBack = currentWord.rawBack;
        
        if (currentWord.translation) {
          existing.translation = currentWord.translation;
        }
      } else if (!existing.translation && currentWord.translation) {
        existing.translation = currentWord.translation;
      }
    }
  }

  return Array.from(wordMap.values());
}

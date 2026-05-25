import { WordSource } from '../../core/pluginRegistry';
import { CardWord } from '../../core/types';
import { ankiClient } from './client';
import { parseAndFilterCards } from './filter';
import { logger } from '../../lib/logger';

export class AnkiWordSource implements WordSource {
  name = 'AnkiConnect';

  async getWords(profileId: string, deckName: string): Promise<CardWord[]> {
    try {
      const cardIds = await ankiClient.findCards(deckName);
      if (!cardIds || cardIds.length === 0) return [];
      
      const cardsInfo = await ankiClient.getCardsInfo(cardIds);
      
      // Since this runs on the server, we rely on the caller to provide mappings or we just use default
      // In a real scenario, the mappings should be passed as arguments, but for now we'll use defaults
      const frontField = 'Front';
      const backField = 'Back';
      
      const words = parseAndFilterCards(cardsInfo, frontField, backField);
      return words;
    } catch (error) {
      logger.error('AnkiWordSource: Ошибка получения слов из Anki', error);
      return [];
    }
  }
}

import { CardWord } from './types';

export interface WordSource {
  name: string;
  // Получить слова из источника (например, из Anki)
  getWords(profileId: string, deckName: string): Promise<CardWord[]>;
  // Синхронизировать отзывы, если источник поддерживает это
  syncReviews?(profileId: string, deckName: string, sessionId?: string): Promise<{ success: boolean; message: string }>;
}

export interface Plugin {
  name: string;
  wordSource?: WordSource;
  init?(): Promise<void> | void;
}

const plugins: Plugin[] = [];

export function registerPlugin(plugin: Plugin) {
  plugins.push(plugin);
}

export function getWordSources(): WordSource[] {
  return plugins.filter(p => p.wordSource).map(p => p.wordSource!);
}

export function getActiveWordSource(): WordSource | null {
  const sources = getWordSources();
  return sources.length > 0 ? sources[0] : null;
}

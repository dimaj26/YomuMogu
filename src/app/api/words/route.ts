import { NextResponse } from 'next/server';
import { getActiveWordSource } from '@/core/pluginRegistry';
import { getDueWords, getLocalWords } from '@/core/db';
import { logger } from '@/lib/logger';
import '@/plugins/anki/index'; // Ensure plugins are registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId') || 'default';
    const deckName = searchParams.get('deckName');

    if (!deckName) {
      return NextResponse.json({ error: 'Не указана колода (deckName)' }, { status: 400 });
    }

    const activeSource = getActiveWordSource();
    if (activeSource) {
      logger.info(`Используем WordSource: ${activeSource.name} для колоды ${deckName}`);
      const words = await activeSource.getWords(profileId, deckName);
      return NextResponse.json({ words });
    }

    // Фоллбэк: Локальная БД
    logger.info(`Используем локальную БД для колоды ${deckName}`);
    const localWords = await getLocalWords(profileId, deckName);
    
    const mappedWords = localWords.map(w => ({
      ...w,
      rawFront: w.word,
      rawBack: w.translation,
      cardIds: [w.id]
    }));

    return NextResponse.json({ words: mappedWords });
  } catch (error: any) {
    logger.error('Ошибка в /api/words', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

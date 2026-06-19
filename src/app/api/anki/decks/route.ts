import { NextResponse } from 'next/server';
import { ankiClient } from '@/plugins/anki/client';
import { logger } from '@/lib/logger';

export async function GET() {
  if (process.env.ANKI_ENABLED === 'false') {
    return NextResponse.json({ error: 'Anki integration is disabled' }, { status: 403 });
  }

  try {
    logger.debug('Запрос списка колод в API /anki/decks');
    const decks = await ankiClient.getDeckNames();
    return NextResponse.json({ decks });
  } catch (error) {
    logger.error('Исключение в API /anki/decks', error);
    return NextResponse.json({ 
      error: (error instanceof Error ? error.message : '') || 'Не удалось загрузить колоды Anki'
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { ankiClient } from '@/lib/anki/client';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.debug('Запрос списка колод в API /anki/decks');
    const decks = await ankiClient.getDeckNames();
    return NextResponse.json({ decks });
  } catch (error: any) {
    logger.error('Исключение в API /anki/decks', error);
    return NextResponse.json({ 
      error: error.message || 'Не удалось загрузить колоды Anki' 
    }, { status: 500 });
  }
}

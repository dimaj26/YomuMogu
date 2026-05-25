import { NextRequest, NextResponse } from 'next/server';
import { lookupWord } from '@/lib/dict/jitendex';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word');

  if (!word) {
    return NextResponse.json({ error: 'Параметр word обязателен' }, { status: 400 });
  }

  logger.info(`[DictLookup] Запрос определения для слова: ${word}`);
  try {
    const result = await lookupWord(word);
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error(`[DictLookup] Ошибка при поиске слова ${word}`, error);
    return NextResponse.json({ error: error.message || 'Ошибка поиска' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { ankiClient } from '@/lib/anki/client';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const isConnected = await ankiClient.checkConnection();
    if (isConnected) {
      return NextResponse.json({ connected: true });
    } else {
      logger.warn('Запрос API /anki/connect вернул: не подключено');
      return NextResponse.json({ 
        connected: false, 
        error: 'AnkiConnect не отвечает. Убедитесь, что Anki запущен.' 
      }, { status: 503 });
    }
  } catch (error: any) {
    logger.error('Исключение в API /anki/connect', error);
    return NextResponse.json({ 
      connected: false, 
      error: error.message || 'Ошибка подключения к Anki' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ankiClient } from '@/plugins/anki/client';
import { logger } from '@/lib/logger';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (process.env.ANKI_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Anki integration is disabled' }, { status: 403 });
  }

  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Blocked unauthorized request to /api/anki/setup-deck');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    logger.info('Начало автоматической настройки колоды и шаблона YomuMogu');
    
    // Получаем имя колоды и модели из запроса или используем дефолтные значения
    let deckName = 'YomuMogu';
    let modelName = 'YomuMoguModel';
    
    try {
      const body = await request.json();
      if (body.deckName) deckName = body.deckName;
      if (body.modelName) modelName = body.modelName;
    } catch (e) {
      // Игнорируем ошибку парсинга тела запроса, если оно пустое
    }

    // 1. Проверяем и создаем колоду
    const decks = await ankiClient.getDeckNames();
    if (!decks.includes(deckName)) {
      logger.info(`Колода "${deckName}" не найдена. Создаем новую.`);
      await ankiClient.createDeck(deckName);
    } else {
      logger.info(`Колода "${deckName}" уже существует.`);
    }

    // 2. Проверяем и создаем шаблон (модель заметки)
    const models = await ankiClient.modelNames();
    if (!models.includes(modelName)) {
      logger.info(`Тип заметки "${modelName}" не найден. Создаем новый.`);
      
      const fields = ['Word', 'Furigana', 'Meaning', 'Audio', 'Image', 'Context'];
      
      const css = `
.card {
  font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, Arial, sans-serif;
  font-size: 20px;
  text-align: center;
  color: #2c3e50;
  background-color: #ffffff;
  padding: 20px;
}
`;

      const frontTemplate = `
<div style="font-family: 'Hiragino Mincho ProN', 'MS Mincho', serif; font-size: 42px; text-align: center; margin-top: 40px; margin-bottom: 20px; color: #1a1a1a;">
  {{Word}}
</div>
`;

      const backTemplate = `
<div style="font-family: 'Hiragino Mincho ProN', 'MS Mincho', serif; font-size: 42px; text-align: center; margin-top: 20px; margin-bottom: 5px; color: #1a1a1a;">
  {{Word}}
</div>

<div style="font-family: 'Hiragino Sans', Meiryo, sans-serif; font-size: 20px; text-align: center; color: #666; margin-bottom: 30px;">
  【{{Furigana}}】
</div>

<hr id="answer" style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">

<div style="font-family: Arial, sans-serif; font-size: 22px; text-align: center; margin-bottom: 30px; font-weight: bold; color: #2c3e50;">
  {{Meaning}}
</div>

{{#Context}}
<div style="font-family: 'Hiragino Sans', Meiryo, sans-serif; font-size: 16px; text-align: left; background-color: #f8f9fa; border-left: 4px solid #0070f3; padding: 12px; margin-top: 20px; border-radius: 4px; line-height: 1.6; color: #333;">
  <b style="color: #0070f3;">Контекст:</b><br>{{Context}}
</div>
{{/Context}}

{{#Audio}}
<div style="margin-top: 25px; text-align: center;">
  {{Audio}}
</div>
{{/Audio}}

{{#Image}}
<div style="margin-top: 25px; text-align: center; max-width: 100%; height: auto;">
  {{Image}}
</div>
{{/Image}}
`;

      const cardTemplates = [
        {
          Name: 'YomuMogu Card Template',
          Front: frontTemplate,
          Back: backTemplate,
        }
      ];

      await ankiClient.createModel(modelName, fields, cardTemplates, css);
      logger.info(`Тип заметки "${modelName}" успешно создан.`);
    } else {
      logger.info(`Тип заметки "${modelName}" уже существует.`);
    }

    return NextResponse.json({
      success: true,
      deckName,
      modelName,
    });
  } catch (error: any) {
    logger.error('Исключение при автоматической настройке колоды YomuMogu', error);
    return NextResponse.json({
      error: error.message || 'Не удалось настроить колоду YomuMogu в Anki'
    }, { status: 500 });
  }
}

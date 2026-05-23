import { NextRequest, NextResponse } from 'next/server';
import { ankiClient } from '@/lib/anki/client';
import { logger } from '@/lib/logger';
import { GoogleGenAI } from '@google/genai';
import { withRetry, GeminiModel } from '@/lib/gemini/retry';
import { verifyCsrf } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) {
    logger.warn('[CSRF] Blocked unauthorized request to /api/anki/add');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.error('Запрос к /api/anki/add отклонен: GEMINI_API_KEY не задан в .env.local');
    return NextResponse.json(
      { error: 'API-ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в файл .env.local.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { deckName, frontField, backField, word, reading, translation, definitionHtml, history } = body;

    const sessionId = body.sessionId;
    const logPrefix = sessionId ? `[Session: ${sessionId}] ` : '';

    // Валидация полей
    if (!deckName || typeof deckName !== 'string') {
      logger.warn(`${logPrefix}[Step: Validation] Ошибка валидации: отсутствует deckName`);
      return NextResponse.json({ error: 'Необходимо передать deckName' }, { status: 400 });
    }
    if (!word || typeof word !== 'string') {
      logger.warn(`${logPrefix}[Step: Validation] Ошибка валидации: отсутствует word`);
      return NextResponse.json({ error: 'Необходимо передать word' }, { status: 400 });
    }
    if (!reading || typeof reading !== 'string') {
      logger.warn(`${logPrefix}[Step: Validation] Ошибка валидации: отсутствует reading`);
      return NextResponse.json({ error: 'Необходимо передать reading' }, { status: 400 });
    }
    if (!translation || typeof translation !== 'string') {
      logger.warn(`${logPrefix}[Step: Validation] Ошибка валидации: отсутствует translation`);
      return NextResponse.json({ error: 'Необходимо передать translation' }, { status: 400 });
    }

    const fField = typeof frontField === 'string' && frontField ? frontField : 'Front';
    const bField = typeof backField === 'string' && backField ? backField : 'Back';

    logger.info(`${logPrefix}[Step: Start] Запрос на добавление нового слова "${word}" в колоду "${deckName}"`);

    // Динамическое определение типа заметки (modelName) и полей из колоды
    let modelName = 'Basic';
    let detectedFields: string[] = [];
    try {
      const existingCardIds = await ankiClient.findCards(deckName);
      if (existingCardIds.length > 0) {
        const cardInfos = await ankiClient.getCardsInfo([existingCardIds[0]]);
        if (cardInfos.length > 0) {
          modelName = cardInfos[0].modelName;
          logger.debug(`${logPrefix}[Step: CheckModel] Обнаружен тип заметки для колоды "${deckName}": ${modelName}`);

          // Сортируем поля по order
          const fieldsWithOrder = Object.entries(cardInfos[0].fields).map(([name, f]) => ({
            name,
            order: f.order,
          }));
          fieldsWithOrder.sort((a, b) => a.order - b.order);
          detectedFields = fieldsWithOrder.map(f => f.name);
          logger.debug(`${logPrefix}[Step: CheckModel] Обнаруженные поля модели: ${detectedFields.join(', ')}`);
        }
      }
    } catch (err) {
      logger.warn(`${logPrefix}[Step: CheckModel] Не удалось определить тип заметки для колоды "${deckName}", используем по умолчанию "${modelName}"`, err);
    }

    const finalFrontField = detectedFields.length > 0 && !detectedFields.includes(fField) ? detectedFields[0] : fField;
    const finalBackField = detectedFields.length > 0 && !detectedFields.includes(bField) ? (detectedFields[1] || detectedFields[0]) : bField;

    // Содержимое по умолчанию, если ИИ-генерация даст сбой
    const displayDef = definitionHtml || '<p>Определение не найдено</p>';
    const backContent = `<div><strong>【${reading}】</strong> ${translation}</div><div style="margin-top: 10px; font-size: 0.95em; max-height: 250px; overflow-y: auto;">${displayDef}</div>`;

    // Определяем список полей для ИИ-генерации
    const fieldsToGenerate = detectedFields.length > 0 ? detectedFields : [fField, bField];

    // Форматируем историю для промпта
    const transcript = Array.isArray(history) && history.length > 0
      ? history.map((msg: any) => `${msg.role === 'user' ? 'Пользователь' : 'Собеседник'}: ${msg.text}`).join('\n')
      : 'История диалога отсутствует.';

    const systemInstruction = `Вы — эксперт по японскому языку и подготовке учебных карточек для Anki.
Ваша задача — заполнить поля новой карточки Anki на основе предоставленной структуры полей модели карточки, словаря JitenDex, истории учебного чата и правил заполнения полей.

Входные данные:
1. Целевое слово: "${word}" (чтение: "${reading}", перевод: "${translation}")
2. Список полей модели карточки: ${JSON.stringify(fieldsToGenerate)}
3. Статья из словаря JitenDex (HTML): \`\`\`${definitionHtml || ''}\`\`\`
4. История диалога (транскрипт):
${transcript}

Правила генерации значений для полей:
1. Поле для выражения/слова (например, "Front", "Word", "Expression", "Vocabulary", "Японский"):
   - Должно содержать только само слово "${word}" в правильной орфографии (иероглифы/кандзи, если слово иероглифичное; хирагана/катакана, если слово пишется азбукой).
   - НЕ должно содержать фуригану, чтение, перевод или подсказки. Только чистое слово.
2. Поле для чтения (например, "Reading", "Furigana", "Pronunciation", "Чтение"):
   - Должно содержать только чтение слова на хирагане/катакане ("${reading}").
3. Поле для значения/перевода (например, "Back", "Meaning", "Translation", "Перевод", "Значение"):
   - Краткий русский перевод ("${translation}") и/или развернутое определение из статьи словаря.
4. Поле для примера предложения (например, "Example", "Sentence", "Пример", "Контекст"):
   - В ПЕРВУЮ ОЧЕРЕДЬ найдите в истории диалога реплику (пользователя или собеседника), где использовалось слово "${word}" (или его грамматическая форма).
   - Если такое предложение найдено в диалоге, используйте его в качестве примера.
   - Если слово не использовалось в диалоге, составьте простое, грамматически верное предложение на японском языке с этим словом, соответствующее уровню N4.
   - Пример должен содержать само предложение и, желательно через перевод строки или в скобках, его перевод на русский.
5. Поле для изображения (например, "Image", "Picture", "Illustration", "Картинка", "Фото"):
   - Если такое поле присутствует, укажите URL-адрес небольшой релевантной картинки с Unsplash: https://images.unsplash.com/photo-... или другого стабильного источника картинок с ограничением по ширине/высоте.
   - Вы ДОЛЖНЫ возвращать HTML-тег изображения с малым разрешением: <img src="URL" style="max-width: 200px; max-height: 200px;" />.
6. Поле для аудио/звука (например, "Audio", "Sound", "Произношение", "Звук"):
   - Если такое поле присутствует, укажите стандартную ссылку воспроизведения TTS в формате Anki: [sound:https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(word)}].
7. Дополнительные поля (например, "Definition", "Jitendex", "Pitch Accent", "Частота", "Frequency", "Notes", "Заметки"):
   - Извлеките Pitch Accent, частоту использования или определение из статьи JitenDex (если она предоставлена) и поместите туда.

Ответ должен быть строго в формате JSON, представляющем объект, где ключи — это точные названия полей из списка, а значения — сгенерированный текст (или HTML/звуковой синтаксис) для этих полей.`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let fields: Record<string, string> = {};

    try {
      const propertiesSchema: Record<string, any> = {};
      fieldsToGenerate.forEach(field => {
        propertiesSchema[field] = {
          type: 'STRING',
          description: `Содержимое для поля "${field}"`
        };
      });

      logger.info(`${logPrefix}[Step: GeminiGenerate] Начало генерации карточки через Gemini для слова "${word}"`);

      const geminiResult = await withRetry(async (model: GeminiModel) => {
        logger.debug(`${logPrefix}[Step: GeminiGenerate] Генерация карточки: используется модель ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents: 'Пожалуйста, заполни поля для карточки Anki.',
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: propertiesSchema,
              required: fieldsToGenerate
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error('Empty text from Gemini');
        return JSON.parse(text) as Record<string, string>;
      });

      fields = geminiResult;
      logger.info(`${logPrefix}[Step: GeminiGenerate] ИИ успешно сгенерировал поля для карточки: ${Object.keys(fields).join(', ')}`);
    } catch (err) {
      logger.warn(`${logPrefix}[Step: GeminiGenerate] Не удалось сгенерировать поля через ИИ, используем стандартную разметку`, err);
      // Фолбек: если произошла ошибка, заполняем дефолтные поля
      fields = {
        [finalFrontField]: word,
        [finalBackField]: backContent
      };
      // Также заполняем остальные поля пустыми строками, чтобы не было ошибок отсутствия полей
      fieldsToGenerate.forEach(f => {
        if (f !== finalFrontField && f !== finalBackField) {
          fields[f] = '';
        }
      });
    }

    logger.info(`${logPrefix}[Step: AddNote] Добавление заметки в Anki с note type "${modelName}" для слова "${word}"`);
    // Добавляем заметку с тегом "yomumogu_sync"
    const noteId = await ankiClient.addNote(deckName, modelName, fields, ['yomumogu_sync']);

    logger.info(`${logPrefix}[Step: Success] Слово "${word}" успешно добавлено в Anki, noteId: ${noteId}`);
    return NextResponse.json({ success: true, noteId });
  } catch (error: any) {
    const body = await request.clone().json().catch(() => ({}));
    const logPrefix = body.sessionId ? `[Session: ${body.sessionId}] ` : '';
    logger.error(`${logPrefix}[Step: Error] Исключение в API /api/anki/add`, error);
    return NextResponse.json(
      { error: error.message || 'Произошла ошибка при добавлении карточки в Anki' },
      { status: 500 }
    );
  }
}

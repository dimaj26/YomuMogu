import { describe, it, expect, beforeAll } from 'vitest';
import { GeminiClient } from '../client';
import { AnkiWord } from '../../anki/filter';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем .env.local вручную
beforeAll(() => {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const parts = line.trim().split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.error('Не удалось загрузить .env.local вручную', e);
  }
});

describe('Gemini API Real Integration Test', () => {
  it('should generate conversational sessions from real Gemini API', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Если ключа нет, тест должен упасть с понятным описанием
    if (!apiKey) {
      throw new Error(
        'Пропуск интеграционного теста: GEMINI_API_KEY отсутствует в .env.local. Укажите действительный API-ключ для запуска этого теста.'
      );
    }

    console.log('--- Выполняется РЕАЛЬНЫЙ запрос к Gemini API ---');
    
    const client = new GeminiClient();
    const mockWords: AnkiWord[] = [
      { id: 1, word: '猫', translation: 'кошка', status: 'new', interval: 0, deckName: 'TestDeck', rawFront: '猫', rawBack: 'кошка' },
      { id: 2, word: '水', translation: 'вода', status: 'learning', interval: 3, deckName: 'TestDeck', rawFront: '水', rawBack: 'вода' },
      { id: 3, word: '犬', translation: 'собака', status: 'new', interval: 0, deckName: 'TestDeck', rawFront: '犬', rawBack: 'собака' },
      { id: 4, word: '食べる', translation: 'есть', status: 'review', interval: 10, deckName: 'TestDeck', rawFront: '食べる', rawBack: 'есть' },
      { id: 5, word: '本', translation: 'книга', status: 'new', interval: 0, deckName: 'TestDeck', rawFront: '本', rawBack: 'книга' },
      { id: 6, word: '読む', translation: 'читать', status: 'learning', interval: 4, deckName: 'TestDeck', rawFront: '読む', rawBack: 'читать' },
      { id: 7, word: '日本語', translation: 'японский язык', status: 'new', interval: 0, deckName: 'TestDeck', rawFront: '日本語', rawBack: 'японский язык' },
      { id: 8, word: '話す', translation: 'говорить', status: 'review', interval: 12, deckName: 'TestDeck', rawFront: '話す', rawBack: 'говорить' },
      { id: 9, word: 'お茶', translation: 'чай', status: 'new', interval: 0, deckName: 'TestDeck', rawFront: 'お茶', rawBack: 'чай' },
      { id: 10, word: '飲む', translation: 'пить', status: 'learning', interval: 2, deckName: 'TestDeck', rawFront: '飲む', rawBack: 'пить' },
      { id: 11, word: '店', translation: 'магазин', status: 'new', interval: 0, deckName: 'TestDeck', rawFront: '店', rawBack: 'магазин' },
      { id: 12, word: '買う', translation: 'покупать', status: 'review', interval: 8, deckName: 'TestDeck', rawFront: '買う', rawBack: 'покупать' }
    ];

    const sessions = await client.generateSessions(mockWords);

    // Логируем результат для визуальной проверки в консоли во время запуска
    console.log('Сгенерированные темы от реального API:');
    console.log(JSON.stringify(sessions, null, 2));

    expect(sessions).toBeInstanceOf(Array);
    expect(sessions.length).toBe(3); // По правилам группировки мы просим ровно 3 темы

    sessions.forEach(session => {
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('string');
      
      expect(session.title).toBeDefined();
      expect(typeof session.title).toBe('string');
      expect(session.title.length).toBeGreaterThan(0);

      expect(session.description).toBeDefined();
      expect(typeof session.description).toBe('string');
      expect(session.description.length).toBeGreaterThan(0);

      expect(session.scenario).toBeDefined();
      expect(typeof session.scenario).toBe('string');
      expect(session.scenario.length).toBeGreaterThan(0);

      expect(session.targetWords).toBeInstanceOf(Array);
      expect(session.targetWords.length).toBeGreaterThanOrEqual(1);
      
      session.targetWords.forEach(tw => {
        expect(tw.word).toBeDefined();
        expect(typeof tw.word).toBe('string');
        expect(tw.translation).toBeDefined();
        expect(typeof tw.translation).toBe('string');
      });
    });
  }, 60000);

  it('should verify that all models in GEMINI_MODELS are available and responsive', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Пропуск интеграционного теста: GEMINI_API_KEY отсутствует в .env.local. Укажите действительный API-ключ для запуска этого теста.'
      );
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const { GEMINI_MODELS } = await import('../retry');

    console.log(`--- Проверка доступности моделей: ${GEMINI_MODELS.join(', ')} ---`);

    for (const model of GEMINI_MODELS) {
      let success = false;
      let lastError: any = null;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`Проверка работоспособности модели: ${model} (попытка ${attempt}/${maxAttempts})...`);
          const response = await ai.models.generateContent({
            model,
            contents: 'Say "hello" in Japanese'
          });
          expect(response.text).toBeDefined();
          expect(typeof response.text).toBe('string');
          expect(response.text?.length).toBeGreaterThan(0);
          console.log(`Модель ${model} успешно ответила.`);
          success = true;
          break;
        } catch (err: any) {
          lastError = err;
          const statusCode = err?.status || err?.statusCode;
          if (statusCode === 503 || statusCode === 429) {
            console.warn(`Модель ${model} вернула ошибку ${statusCode}. Повтор через ${attempt * 2000}мс...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          } else {
            console.error(`Модель ${model} вернула критическую ошибку:`, err.message || err);
            throw err;
          }
        }
      }

      if (!success) {
        throw lastError;
      }
    }
  }, 90000);
});

import { describe, it, expect } from 'vitest';
import { chatService, ChatMessage, TargetWord } from '../chat';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем .env.local синхронно прямо при импорте файла
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

describe('AI Sensei Scenarios Integration Tests', () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('Пропуск тестов сценариев: отсутствует GEMINI_API_KEY в .env.local');
  }

  describe.runIf(apiKey)('Live Scenarios', () => {
    const scenario = 'Покупка одежды в магазине. Практика диалога при покупке одежды, выбор товаров и вопросы по обмену.';
    const targetWords: TargetWord[] = [
      { word: '選ぶ', translation: 'выбирать' },
      { word: '半袖', translation: 'короткие рукава' },
      { word: '交換', translation: 'обмен' },
      { word: '確認', translation: 'проверка/подтверждение' },
      { word: '買う', translation: 'покупать' }
    ];

    it('Scenario 1: Memory Retention over long turns (Level 2)', async () => {
      console.log('--- Запуск Сценария 1: Проверка долговременной памяти (Уровень 2) ---');

      const dialogue = [
        { user: '__START__' },
        { user: 'こんにちは。半袖のシャツを選びたいです。' }, // Использованы 半袖 и 選ぶ
        { user: '青いシャツがほしいです。' }, // Выбран цвет: синий
        { user: 'サイズはMサイズがいいです。' }, // Выбран размер: M
        { user: 'ありがとうございます。他には何を売っていますか？' }, // Смена темы (другие товары)
        { user: 'ズボンもありますか？' },
        { user: '靴もありますか？' },
        { user: 'わかりました。ところで、私が最初に選んだシャツは何色ですか？' } // Вопрос-проверка памяти
      ];

      let history: ChatMessage[] = [];
      let currentResponse: any = null;

      for (let i = 0; i < dialogue.length; i++) {
        const turn = dialogue[i];
        
        currentResponse = await chatService.sendMessage(
          scenario,
          targetWords,
          history,
          turn.user,
          2
        );

        console.log(`[Ход ${i + 1}] Ученик: ${turn.user}`);
        console.log(`[Ход ${i + 1}] Сэнсэй: ${currentResponse.reply}`);
        console.log(`[Ход ${i + 1}] Перевод: ${currentResponse.translation}`);
        console.log(`[Ход ${i + 1}] Обнаружено слов:`, currentResponse.wordsDetected);
        console.log('--------------------------------------------------');

        history.push({ role: 'user', text: turn.user });
        history.push({ role: 'model', text: currentResponse.reply });
      }

      // Проверяем, что в финальном ответе сэнсэй помнит цвет "синий" (青 или あお)
      const finalReply = currentResponse.reply;
      const finalTranslation = currentResponse.translation.toLowerCase();

      const remembersBlue = 
        finalReply.includes('青') || 
        finalReply.includes('あお') || 
        finalTranslation.includes('синий') || 
        finalTranslation.includes('сине');

      expect(remembersBlue).toBe(true);
    }, 90000);

    it('Scenario 2: Simple Tone & Keigo Exclusion (Level 1)', async () => {
      console.log('--- Запуск Сценария 2: Исключение Кэйго и простота фраз (Уровень 1) ---');

      let history: ChatMessage[] = [];

      // Ход 1
      let response = await chatService.sendMessage(scenario, targetWords, history, '__START__', 1);
      console.log('[Ход 1] Сэнсэй:', response.reply);
      console.log('[Ход 1] Перевод:', response.translation);

      // Проверки для Уровня 1:
      // 1. Отсутствие похвалы
      const praiseWords = ['すごい', '上手', 'さすが', '素晴らしい', '完璧', 'お見事', 'よくでき', 'いいですね'];
      praiseWords.forEach(word => {
        expect(response.reply).not.toContain(word);
      });

      // 2. Отсутствие сложного магазинного кэйго
      const forbiddenKeigo = ['いらっしゃいませ', 'かしкоまりました', 'ございます', 'お会計', '少々お待ちください', '少々お待ちくださいませ'];
      forbiddenKeigo.forEach(word => {
        expect(response.reply).not.toContain(word);
      });

      // 3. Длина предложений не более 15 японских символов
      const cleanText = response.reply.replace(/<[^>]*>/g, '');
      const sentences = cleanText.split(/[。？！?!]/).filter(s => s.trim().length > 0);
      sentences.forEach(sentence => {
        expect(sentence.length).toBeLessThanOrEqual(15);
      });

      history.push({ role: 'user', text: '__START__' });
      history.push({ role: 'model', text: response.reply });

      // Ход 2: Пользователь выбирает рубашку с коротким рукавом
      response = await chatService.sendMessage(scenario, targetWords, history, '半袖のシャツを選びます。', 1);
      console.log('[Ход 2] Сэнсэй:', response.reply);
      console.log('[Ход 2] Перевод:', response.translation);

      forbiddenKeigo.forEach(word => {
        expect(response.reply).not.toContain(word);
      });

      const cleanText2 = response.reply.replace(/<[^>]*>/g, '');
      const sentences2 = cleanText2.split(/[。？！?!]/).filter(s => s.trim().length > 0);
      sentences2.forEach(sentence => {
        expect(sentence.length).toBeLessThanOrEqual(15);
      });
    }, 45000);

    it('Scenario 3: Target Word Nudging (Level 2)', async () => {
      console.log('--- Запуск Сценария 3: Подталкивание к неиспользованным словам (Уровень 2) ---');

      let history: ChatMessage[] = [];

      // Ход 1: Старт
      let response = await chatService.sendMessage(scenario, targetWords, history, '__START__', 2);
      history.push({ role: 'user', text: '__START__' });
      history.push({ role: 'model', text: response.reply });

      // Ход 2: Пользователь использует '半袖' и '選ぶ'
      response = await chatService.sendMessage(
        scenario,
        targetWords,
        history,
        'こんにちは。半袖のシャツを選びたいです。',
        2
      );
      console.log('[Ход 2] Сэнсэй:', response.reply);
      expect(response.wordsDetected).toContain('半袖');
      expect(response.wordsDetected).toContain('選ぶ');

      history.push({ role: 'user', text: 'こんにちは。半袖のシャツを選びたいです。' });
      history.push({ role: 'model', text: response.reply });

      // Ход 3: Пользователь просто выбирает цвет. Сэнсэй должен подталкивать к оставшимся словам:
      // 交換 (обмен), 確認 (проверка), 買う (покупать)
      response = await chatService.sendMessage(scenario, targetWords, history, '青いのがいいです。', 2);
      console.log('[Ход 3] Сэнсэй:', response.reply);
      console.log('[Ход 3] Перевод:', response.translation);

      // 1. Проверяем, что неиспользованные целевые слова строго СКРЫТЫ в ответе Сэнсэя
      expect(response.reply).not.toContain('交換');
      expect(response.reply).not.toContain('確認');
      expect(response.reply).not.toContain('買う');

      // 2. Проверяем, что Сэнсэй подталкивает к обсуждению размера/выбора/покупки в контексте
      const lowercaseReply = response.reply.toLowerCase();
      const lowercaseTranslation = response.translation.toLowerCase();

      const hasContextNudge = 
        lowercaseReply.includes('サイズ') || // размер
        lowercaseReply.includes('大丈夫') || // все ли в порядке
        lowercaseReply.includes('青') ||     // цвет
        lowercaseReply.includes('シャツ') ||  // рубашка
        lowercaseReply.includes('着') ||      // примерить
        lowercaseTranslation.includes('размер') ||
        lowercaseTranslation.includes('подходит') ||
        lowercaseTranslation.includes('синий') ||
        lowercaseTranslation.includes('примерить');

      expect(hasContextNudge).toBe(true);
    }, 45000);

    it('Scenario 4: Resolving Ambiguity / Avoiding Loops (Level 2)', async () => {
      console.log('--- Запуск Сценария 4: Устранение зацикливаний при неопределенности (Уровень 2) ---');

      let history: ChatMessage[] = [];

      // Ход 1: Старт
      let response = await chatService.sendMessage(scenario, targetWords, history, '__START__', 2);
      history.push({ role: 'user', text: '__START__' });
      history.push({ role: 'model', text: response.reply });

      // Ход 2: Пользователь говорит "Я не знаю/Я запутался"
      response = await chatService.sendMessage(scenario, targetWords, history, 'わかりません。何がいいですか？', 2);
      console.log('[Ход 2] Сэнсэй:', response.reply);
      console.log('[Ход 2] Перевод:', response.translation);

      // Сэнсэй должен предложить конкретный вариант (рубашка, короткий рукав и т.д.),
      // а не повторять абстрактный вопрос "Что вы хотите купить?".
      const suggestions = ['シャツ', '半袖', '服', 'これ', 'あれ'];
      const suggestionFound = suggestions.some(word => response.reply.includes(word)) || 
        response.translation.toLowerCase().includes('рубашк') || 
        response.translation.toLowerCase().includes('одежд') ||
        response.translation.toLowerCase().includes('футболк') ||
        response.translation.toLowerCase().includes('коротк');

      expect(suggestionFound).toBe(true);
    }, 45000);
  });
});

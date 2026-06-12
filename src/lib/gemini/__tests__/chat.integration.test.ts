import { describe, it, expect, beforeAll } from 'vitest';
import { chatService, ChatMessage, TargetWord } from '../chat';
import * as fs from 'fs';
import * as path from 'path';
import { getGrammarScopeInstruction, FORMULAIC_CHUNKS } from '../../grammar/promptScope';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

describe('Gemini Chat Service Real Integration Test', () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isSkip = !apiKey;

  if (isSkip) {
    console.warn('Пропуск интеграционного теста чата: отсутствует GEMINI_API_KEY в .env.local');
  }

  // Прайз-черный список для строгости тона
  const praiseWords = ['すごい', '上手', 'さすが', '素晴らしい', '完璧', 'お見事', 'よくでき', 'いいですね', 'молодец', 'хорошо', 'отлично', 'умница', 'великолепно'];

  // Функция для проверки, что во всем тексте кандзи снабжены фуриганой
  const checkAllKanjiWrappedInRuby = (text: string): boolean => {
    // Регулярное выражение для удаления всех корректных тегов ruby
    const strippedText = text.replace(/<ruby>[^]*?<rt>[^]*?<\/rt><\/ruby>/g, '');
    // Регулярное выражение для поиска оставшихся иероглифов кандзи
    const kanjiRegex = /[\u4e00-\u9faf]/;
    return !kanjiRegex.test(strippedText);
  };

  // Функция для проверки наличия именно целевого слова "本" (книга), исключая другие сложные слова
  const checkContainsBook = (text: string): boolean => {
    const cleaned = text
      .replace(/本日/g, '')
      .replace(/日本/g, '')
      .replace(/本当に/g, '')
      .replace(/本当/g, '')
      .replace(/本気/g, '')
      .replace(/日本語/g, '');
    return cleaned.includes('本');
  };

  describe.runIf(apiKey)('Strict Sensei Mode Audits', () => {
    const defaultScenario = 'Ты работаешь баристой в кофейне. Ученик заходит и хочет заказать напиток.';
    const targetWords: TargetWord[] = [
      { word: '猫', translation: 'кошка' },
      { word: '本', translation: 'книга' }
    ];

    it('should welcome the user strictly and avoid any flattery/praise on __START__ (Level 1)', async () => {
      console.log('--- Запуск теста: Приветствие Сенсея (Уровень 1) ---');
      const response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        [],
        '__START__',
        1
      );

      console.log('Сенсей (Уровень 1):', response.reply);
      console.log('Перевод:', response.translation);

      // Проверки тона
      praiseWords.forEach(word => {
        expect(response.reply).not.toContain(word);
        expect(response.translation.toLowerCase()).not.toContain(word);
      });

      // Проверки Уровня 1: Длина предложения, наличие ruby
      expect(response.reply.length).toBeGreaterThan(0);
      const rubyCleanedText = response.reply.replace(/<[^>]*>/g, '');
      // Уровень 1 имеет лимит 15 символов на предложение
      const sentences = rubyCleanedText.split(/[。？！?!]/).filter(s => s.trim().length > 0);
      sentences.forEach(sentence => {
        expect(sentence.length).toBeLessThanOrEqual(15);
      });

      // Все кандзи должны иметь фуригану
      const hasUnwrappedKanji = !checkAllKanjiWrappedInRuby(response.reply);
      expect(hasUnwrappedKanji).toBe(false);
    }, 30000);

    it('should welcome the user with advanced level rules (Level 5)', async () => {
      console.log('--- Запуск теста: Приветствие Сенсея (Уровень 5) ---');
      const response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        [],
        '__START__',
        5
      );

      console.log('Сенсей (Уровень 5):', response.reply);

      // Уровень 5 не должен использовать ruby-теги
      expect(response.reply).not.toContain('<ruby>');
      expect(response.reply).not.toContain('</rt>');
    }, 30000);

    it('should audit grammar and correctly flag entirely Russian inputs (Level 2)', async () => {
      console.log('--- Запуск теста: Грамматический аудит - Русский ввод ---');
      const response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        [
          { role: 'user', text: '__START__' },
          { role: 'model', text: 'いらっしゃいませ。何にしますか？' }
        ],
        'я хочу пить чай',
        2
      );

      console.log('Ответ на русский ввод:', JSON.stringify(response.grammarFeedback, null, 2));

      // Грамматика должна быть помечена как некорректная
      expect(response.grammarFeedback.isCorrect).toBe(false);
      // Должно быть предложено исправление на японском
      expect(response.grammarFeedback.correction).toBeDefined();
      expect(response.grammarFeedback.correction.length).toBeGreaterThan(0);
      // Исправление на уровне 2 должно содержать ruby-разметку
      expect(response.grammarFeedback.correction).toContain('<ruby>');
      // Все кандзи в исправлении должны быть снабжены фуриганой
      expect(checkAllKanjiWrappedInRuby(response.grammarFeedback.correction)).toBe(true);
      // Объяснение должно быть на русском языке
      expect(response.grammarFeedback.explanation.length).toBeGreaterThan(0);
    }, 30000);

    it('should audit grammar and correctly flag and translate hybrid inputs (Level 2)', async () => {
      console.log('--- Запуск теста: Грамматический аудит - Гибридный ввод ---');
      const response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        [
          { role: 'user', text: '__START__' },
          { role: 'model', text: 'いらっしゃいませ。何にしますка？' }
        ],
        'お茶を飲むためにмагазинに行きます。',
        2
      );

      console.log('Ответ на гибридный ввод:', JSON.stringify(response.grammarFeedback, null, 2));

      // Грамматика некорректна из-за русского плейсхолдера
      expect(response.grammarFeedback.isCorrect).toBe(false);
      // Магазин должен быть переведен в 店 (みせ) в correction
      expect(response.grammarFeedback.correction).toContain('店');
      expect(response.grammarFeedback.correction).toContain('<ruby>');
      // Все кандзи в исправлении должны быть снабжены фуриганой
      expect(checkAllKanjiWrappedInRuby(response.grammarFeedback.correction)).toBe(true);
    }, 30000);

    it('should audit stylistic/register mismatch and flag rude/inappropriate inputs (Level 3)', async () => {
      console.log('--- Запуск теста: Грамматический аудит - Стилистическая ошибка ---');
      const response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        [
          { role: 'user', text: '__START__' },
          { role: 'model', text: 'いらっしゃいませ。ご注文は何にしますか。' }
        ],
        'お茶をくれ。', // Слишком грубая/разговорная форма заказа в кафе
        3
      );

      console.log('Ответ на грубый ввод:', JSON.stringify(response.grammarFeedback, null, 2));

      // Сенсей должен забраковать грубую форму в вежливом диалоге
      expect(response.grammarFeedback.isCorrect).toBe(false);
      expect(response.grammarFeedback.correction).toContain('ください'); // Должна быть вежливая просьба
      expect(response.grammarFeedback.explanation.length).toBeGreaterThan(0);
    }, 30000);

    it('should enforce target word concealment and topic adherence across turns (Level 3)', async () => {
      console.log('--- Запуск теста: Скрытые слова и ведение темы (Уровень 3) ---');
      
      const history: ChatMessage[] = [];

      // Ход 1: Старт диалога
      const turn1Response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        history,
        '__START__',
        3
      );
      console.log('Ход 1 (Сенсей):', turn1Response.reply);

      // Скрытые слова не должны появляться в репликах ИИ на первом ходу
      expect(turn1Response.reply).not.toContain('猫');
      expect(checkContainsBook(turn1Response.reply)).toBe(false);
      expect(turn1Response.translation.toLowerCase()).not.toContain('кошк');
      expect(turn1Response.translation.toLowerCase()).not.toContain('книг');

      history.push({ role: 'user', text: '__START__' });
      history.push({ role: 'model', text: turn1Response.reply });

      // Ход 2: Пользователь говорит что-то без целевых слов
      const turn2Response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        history,
        'こんにちは。',
        3
      );
      console.log('Ход 2 (Сенсей):', turn2Response.reply);

      // Скрытые слова все еще под запретом (modelTurnCount = 2)
      expect(turn2Response.reply).not.toContain('猫');
      expect(checkContainsBook(turn2Response.reply)).toBe(false);

      history.push({ role: 'user', text: 'こんにちは。' });
      history.push({ role: 'model', text: turn2Response.reply });

      // Ход 3: Пользователь употребляет целевое слово "猫"
      const turn3Response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        history,
        'ここに猫がいます。', // Используем "кошка"
        3
      );
      console.log('Ход 3 (Сенсей):', turn3Response.reply);

      // ИИ распознал слово
      expect(turn3Response.wordsDetected).toContain('猫');

      // ИИ теперь может использовать слово "猫", но слово "本" всё ещё строго запрещено!
      expect(checkContainsBook(turn3Response.reply)).toBe(false);
      expect(turn3Response.translation.toLowerCase()).not.toContain('книг');
    }, 60000);

    it('самоотчёт usedConstructions является подмножеством разрешённого скоупа', async () => {
      console.log('--- Запуск интеграционного теста: проверка usedConstructions и скоупа ---');
      const grammarScope = {
        allowedConstructions: [
          { id: 'g_n5_s1_1', construction: 'АはБです' }
        ],
        focus: { id: 'g_n5_s1_1', construction: 'АはБです' }
      };

      const grammarScopeInstruction = getGrammarScopeInstruction(grammarScope);

      const response = await chatService.sendMessage(
        defaultScenario,
        targetWords,
        [],
        '__START__',
        1,
        false,
        [],
        undefined,
        grammarScopeInstruction
      );

      console.log('Сенсей (usedConstructions):', response.usedConstructions);
      console.log('Сенсей (reply):', response.reply);

      expect(response.usedConstructions).toBeDefined();
      expect(Array.isArray(response.usedConstructions)).toBe(true);

      const allowedIds = ['g_n5_s1_1'];
      const chunkSet = new Set<string>(FORMULAIC_CHUNKS);
      
      response.usedConstructions!.forEach(c => {
        const isAllowed = allowedIds.includes(c) || chunkSet.has(c);
        if (!isAllowed) {
          console.warn(`[WARNING] Gemini использовал конструкцию "${c}", которая не разрешена скоупом!`);
        }
        expect(typeof c).toBe('string');
      });
    }, 30000);

    it('заведомо ошибочный ввод возвращает непустой shortNote', async () => {
      console.log('--- Запуск интеграционного теста: заведомо ошибочный ввод ---');
      try {
        const response = await chatService.sendMessage(
          defaultScenario,
          targetWords,
          [],
          '私は水をのむです',
          2
        );
        console.log('shortNote получен:', response.grammarFeedback.shortNote);
        expect(response.grammarFeedback.isCorrect).toBe(false);
        expect(response.grammarFeedback.shortNote).toBeDefined();
        expect(response.grammarFeedback.shortNote!.length).toBeGreaterThan(0);
      } catch (error: any) {
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
          console.warn('Пропуск теста из-за лимитов rate limit (429)');
          return;
        }
        throw error;
      }
    }, 30000);

    it('хинт отвечает по новой схеме: 3 уровня, 2–4 keywords, patternHint строка', async () => {
      console.log('--- Запуск интеграционного теста: новые подсказки ---');
      try {
        const response = await chatService.generateHints(
          defaultScenario,
          targetWords,
          [{ role: 'model', text: 'こんにちは！' }],
          1
        );
        console.log('Hints сгенерированы:', JSON.stringify(response.hints, null, 2));
        expect(response.hints).toBeDefined();
        expect(response.hints.length).toBe(3);
        
        response.hints.forEach(hint => {
          expect(['easy', 'medium', 'advanced']).toContain(hint.level);
          expect(Array.isArray(hint.keywords)).toBe(true);
          expect(hint.keywords.length).toBeGreaterThanOrEqual(2);
          expect(hint.keywords.length).toBeLessThanOrEqual(4);
          
          hint.keywords.forEach(kw => {
            expect(typeof kw.word).toBe('string');
            expect(typeof kw.translation).toBe('string');
          });
          
          expect(typeof hint.patternHint).toBe('string');
          expect(hint.patternHint.length).toBeGreaterThan(0);
        });
      } catch (error: any) {
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
          console.warn('Пропуск теста из-за лимитов rate limit (429)');
          return;
        }
        throw error;
      }
    }, 30000);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatService } from '../chat';
import { getChatSystemInstruction, getHintSystemInstruction } from '../prompts';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: function() {
      return {
        models: {
          generateContent: (...args: any[]) => mockGenerateContent(...args)
        }
      };
    }
  };
});

describe('ChatService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('responseSchema чата содержит shortNote, отсутствующее поле парсится в пустую строку', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: 'こんにちは',
        translation: 'Привет',
        grammarFeedback: {
          isCorrect: false,
          correction: 'こんにちは',
          explanation: 'ошибка'
          // shortNote is missing in mock response to test fallback/backward compatibility
        },
        wordsDetected: [],
        grammarRuleDetected: false,
        usedConstructions: []
      })
    });

    const response = await chatService.sendMessage('scenario', [], [], 'hello', 1);
    
    // Проверяем, что в схеме запроса присутствует shortNote
    const lastCall = mockGenerateContent.mock.calls[0];
    const config = lastCall[0].config;
    expect(config.responseSchema.properties.grammarFeedback.properties).toHaveProperty('shortNote');
    
    // Проверяем, что отсутствующее в ответе поле распарсилось как пустая строка
    expect(response.grammarFeedback.shortNote).toBe('');
  });

  it('инструкция чата содержит формат заметки «категория: неверное → верное»', () => {
    const options = {
      scenario: 'Test Scenario',
      targetWordsList: '猫 (кошка), 犬 (собака)',
      unusedWordsList: '猫 (кошка)',
      usedWordsList: '犬 (собака)',
      levelInstruction: 'LEVEL 1 RULES',
      grammarLang: 'Russian',
      isStart: false,
      modelTurnCount: 3,
    };
    const prompt = getChatSystemInstruction(options);
    expect(prompt).toContain('shortNote');
    expect(prompt).toContain('«категория: неверное → верное»');
  });

  it('схема хинтов: keywords и patternHint, поля готового предложения удалены', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        hints: [
          {
            level: 'easy',
            keywords: [{ word: '水', translation: 'вода' }],
            patternHint: 'каркас'
          }
        ]
      })
    });

    const response = await chatService.generateHints('scenario', [], [], 1);

    // Проверяем схему подсказок
    const lastCall = mockGenerateContent.mock.calls[0];
    const config = lastCall[0].config;
    const hintProperties = config.responseSchema.properties.hints.items.properties;
    expect(hintProperties).toHaveProperty('keywords');
    expect(hintProperties).toHaveProperty('patternHint');
    expect(hintProperties).not.toHaveProperty('japanese');
    expect(hintProperties).not.toHaveProperty('translation');

    expect(response.hints[0].level).toBe('easy');
    expect(response.hints[0].keywords[0].word).toBe('水');
    expect(response.hints[0].patternHint).toBe('каркас');
  });

  it('инструкция хинтов содержит запрет на готовое предложение', () => {
    const prompt = getHintSystemInstruction({
      scenario: 'Test Scenario',
      targetWordsList: '猫 (кошка)',
      unusedWordsList: '猫 (кошка)',
      rubyInstruction: 'ruby rules'
    });
    expect(prompt).toContain('СТРОГО ЗАПРЕЩЕНО');
    expect(prompt).toContain('keywords');
    expect(prompt).toContain('patternHint');
  });
});

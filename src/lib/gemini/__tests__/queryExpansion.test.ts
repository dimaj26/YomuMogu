import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryExpansionService } from '../queryExpansion';
import { withRetry, GEMINI_MODELS } from '../retry';

// Мокаем SDK GoogleGenAI
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

// Мокаем withRetry
vi.mock('../retry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../retry')>();
  return {
    ...actual,
    withRetry: vi.fn((fn) => fn('gemini-2.5-flash-lite'))
  };
});

describe('QueryExpansionService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    process.env.GEMINI_API_KEY = 'test-key';
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('structured output парсится по схеме', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        jaQueries: ['日本語の勉強', '日本語会話', '日本語レッスン'],
        theme: 'education'
      })
    });

    const result = await queryExpansionService.expandQuery('хочу учить японский');
    expect(result.jaQueries).toEqual(['日本語の勉強', '日本語会話', '日本語レッスン']);
    expect(result.theme).toBe('education');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('кэш-хит не вызывает Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        jaQueries: ['日本語の勉強', '日本語会話', '日本語レッスン'],
        theme: 'education'
      })
    });

    // Первый вызов - кэш пустой, вызывается Gemini
    const result1 = await queryExpansionService.expandQuery('хочу учить японский');
    expect(result1.jaQueries).toContain('日本語の勉強');

    // Второй вызов - кэш хит, Gemini не вызывается
    const result2 = await queryExpansionService.expandQuery('хочу учить японский');
    expect(result2.jaQueries).toEqual(result1.jaQueries);
    expect(result2.theme).toBe(result1.theme);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1); // Всего 1 раз
  });

  it('отказ Gemini → деградация {jaQueries:[rawQuery], theme:null}', async () => {
    // Симулируем ошибку при вызове withRetry
    const mockedWithRetry = vi.mocked(withRetry);
    mockedWithRetry.mockRejectedValueOnce(new Error('API Error'));

    const result = await queryExpansionService.expandQuery('хочу учить японский');
    expect(result).toEqual({
      jaQueries: ['хочу учить японский'],
      theme: null
    });
  });

  it('retry regression: дефолтная цепочка flash→pro→flash-lite без modelChain не изменилась', () => {
    // Проверим саму константу GEMINI_MODELS в retry.ts
    expect(GEMINI_MODELS).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']);
  });
});

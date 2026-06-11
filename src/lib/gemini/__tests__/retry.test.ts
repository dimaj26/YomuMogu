import { describe, it, expect, vi } from 'vitest';
import { withRetry, GEMINI_MODELS } from '../retry';

describe('Gemini withRetry fallback logic', () => {
  it('дефолтная цепочка без modelChain использует GEMINI_MODELS', async () => {
    const calledModels: string[] = [];
    await withRetry(async (model) => {
      calledModels.push(model);
      return 'success';
    });
    // По умолчанию с первой попытки возвращается результат, вызвав первую модель
    expect(calledModels).toEqual([GEMINI_MODELS[0]]);
  });

  it('modelChain переопределяет цепочку', async () => {
    const calledModels: string[] = [];
    
    // Симулируем ошибку 503 для перехода по цепочке
    try {
      await withRetry(
        async (model) => {
          calledModels.push(model);
          const err: any = new Error('Service Unavailable');
          err.status = 503;
          throw err;
        },
        {
          modelChain: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'],
          maxRetries: 1, // Ограничим попытки до 1 на модель
          baseDelayMs: 1 // Минимальная задержка
        }
      );
    } catch (err) {
      // Игнорируем финальную ошибку
    }

    expect(calledModels).toEqual(['gemini-2.5-flash-lite', 'gemini-2.5-flash']);
  });
});

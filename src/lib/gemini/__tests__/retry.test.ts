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

  it('сетевая ошибка («fetch failed») подлежит повтору, а не мгновенному выбросу', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('fetch failed'); // сетевая ошибка undici, без status
        }
        return 'recovered';
      },
      { maxRetries: 3, baseDelayMs: 1 }
    );

    expect(result).toBe('recovered');
    expect(attempts).toBe(2); // первая попытка упала по сети, вторая успешна
  });
});

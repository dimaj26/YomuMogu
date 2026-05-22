import { logger } from '../logger';

/**
 * Список моделей для автоматического fallback.
 * Если основная модель недоступна (503), пробуем следующую.
 */
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableStatusCodes: [429, 500, 503],
};

/**
 * Выполняет функцию с автоматическим повтором при сетевых ошибках
 * и fallback на другие модели Gemini при 503.
 */
export async function withRetry<T>(
  fn: (model: GeminiModel) => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any = null;

  // Пробуем каждую модель
  for (const model of GEMINI_MODELS) {
    // Для каждой модели — несколько попыток
    for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
      try {
        return await fn(model);
      } catch (error: any) {
        lastError = error;
        
        const statusCode = error?.status || error?.statusCode;
        const isRetryable = opts.retryableStatusCodes.includes(statusCode);
        
        if (!isRetryable) {
          // Ошибка не подлежит повтору (400, 401 и т.д.) — бросаем сразу
          throw error;
        }

        const delay = opts.baseDelayMs * Math.pow(2, attempt); // экспоненциальная задержка: 1s, 2s, 4s
        logger.warn(
          `Gemini API вернул ошибку ${statusCode} (модель: ${model}, попытка: ${attempt + 1}/${opts.maxRetries}). ` +
          `Повтор через ${delay}мс...`
        );

        await sleep(delay);
      }
    }

    // Все попытки для этой модели исчерпаны — пробуем следующую
    if (GEMINI_MODELS.indexOf(model) < GEMINI_MODELS.length - 1) {
      const nextModel = GEMINI_MODELS[GEMINI_MODELS.indexOf(model) + 1];
      logger.info(`Переключение на запасную модель: ${nextModel}`);
    }
  }

  // Все модели и попытки исчерпаны
  logger.error('Все попытки запроса к Gemini API исчерпаны');
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

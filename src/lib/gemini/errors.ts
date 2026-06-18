import { NextResponse } from 'next/server';

/**
 * Классификация ошибок ИИ-сервиса для человеческого представления.
 *
 * Сырой текст исключения («fetch failed», стек undici и т.п.) НИКОГДА не уходит
 * пользователю — только в logger. Наружу отдаётся структурный контракт.
 */

export type GeminiErrorReason = 'config' | 'transient' | 'unavailable';

export interface ClassifiedGeminiError {
  reason: GeminiErrorReason;
  message: string;   // человеческое сообщение на русском
  retryable: boolean;
}

// Человеческие сообщения по причине (без технических деталей)
const MESSAGES: Record<GeminiErrorReason, string> = {
  config:
    'ИИ-сервис не настроен (проблема с ключом доступа). Это вопрос к настройке приложения, повтор не поможет.',
  transient:
    'ИИ-сервис временно недоступен. Попробуйте ещё раз позже — слова и повторение работают офлайн.',
  unavailable:
    'ИИ-сервис сейчас недоступен. Попробуйте ещё раз позже — слова и повторение работают офлайн.',
};

/**
 * Распознаёт сетевые ошибки (недоступность хоста, обрыв соединения, undici «fetch failed»).
 */
export function isNetworkError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code || e?.cause?.code || '';
  const msg = `${e?.message || ''} ${e?.cause?.message || ''}`;

  const NETWORK_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET'];
  if (NETWORK_CODES.includes(code)) return true;

  return /fetch failed|socket hang up|network error|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg);
}

/**
 * Классифицирует исключение ИИ-сервиса в одну из трёх причин.
 */
export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  const e = err as { status?: number; statusCode?: number; message?: string; response?: { status?: number } };
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  const msg = String(e?.message || '');

  // Конфигурация: нет/неверный ключ, нет прав — повтор бесполезен
  if (
    status === 401 ||
    status === 403 ||
    /api[_\s-]?key|api-ключ|unauthorized|permission denied|invalid authentication/i.test(msg)
  ) {
    return { reason: 'config', message: MESSAGES.config, retryable: false };
  }

  // Транзиентные: перегрузка/временный сбой/сеть — имеет смысл повторить
  if (status === 429 || status === 500 || status === 503 || isNetworkError(err)) {
    return { reason: 'transient', message: MESSAGES.transient, retryable: true };
  }

  // Прочее: неизвестная ошибка — повтор допустим
  return { reason: 'unavailable', message: MESSAGES.unavailable, retryable: true };
}

/**
 * Строит структурный JSON-ответ для роутов на основе классификации.
 * Сырой текст исключения наружу не попадает.
 */
export function geminiErrorResponse(err: unknown): NextResponse {
  const classified = classifyGeminiError(err);
  // Конфиг-ошибки — это 500 (вопрос к настройке), транзиент/прочее — тоже 500
  // (статус не используется клиентом для логики; решение принимается по reason/retryable).
  return NextResponse.json(
    { error: classified.message, reason: classified.reason, retryable: classified.retryable },
    { status: 500 }
  );
}

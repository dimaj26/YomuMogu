import { describe, it, expect } from 'vitest';
import { classifyGeminiError, isNetworkError } from '../errors';

describe('classifyGeminiError', () => {
  it('нет ключа / 401 / 403 → reason config, не retryable', () => {
    const c1 = classifyGeminiError({ status: 401, message: 'Unauthorized' });
    expect(c1.reason).toBe('config');
    expect(c1.retryable).toBe(false);

    const c2 = classifyGeminiError(new Error('API key not valid. Please pass a valid API key.'));
    expect(c2.reason).toBe('config');
    expect(c2.retryable).toBe(false);

    const c3 = classifyGeminiError({ status: 403, message: 'Permission denied' });
    expect(c3.reason).toBe('config');
  });

  it('429 / 500 / 503 → reason transient, retryable, сообщение «временно недоступен»', () => {
    for (const status of [429, 500, 503]) {
      const c = classifyGeminiError({ status, message: 'boom' });
      expect(c.reason).toBe('transient');
      expect(c.retryable).toBe(true);
      expect(c.message).toContain('временно недоступен');
    }
  });

  it('сетевая ошибка undici («fetch failed») → transient, retryable, «временно недоступен»', () => {
    const c = classifyGeminiError(new Error('fetch failed'));
    expect(c.reason).toBe('transient');
    expect(c.retryable).toBe(true);
    expect(c.message).toContain('временно недоступен');
    // Сырой текст не попадает в пользовательское сообщение
    expect(c.message).not.toContain('fetch failed');
  });

  it('неизвестная ошибка → reason unavailable, retryable', () => {
    const c = classifyGeminiError(new Error('что-то странное'));
    expect(c.reason).toBe('unavailable');
    expect(c.retryable).toBe(true);
    expect(c.message).not.toContain('что-то странное');
  });
});

describe('isNetworkError', () => {
  it('распознаёт сетевые ошибки по сообщению и коду', () => {
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
    expect(isNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isNetworkError({ code: 'ENOTFOUND' })).toBe(true);
    expect(isNetworkError(new Error('socket hang up'))).toBe(true);
  });

  it('обычная ошибка не считается сетевой', () => {
    expect(isNetworkError(new Error('validation error'))).toBe(false);
    expect(isNetworkError({ status: 400 })).toBe(false);
  });
});

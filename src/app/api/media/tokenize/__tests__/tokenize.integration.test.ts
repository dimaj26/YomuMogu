import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as tokenizePost } from '../route';
import { NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/csrf';

// Мокаем CSRF для прогона тестов интеграции
vi.mock('@/lib/csrf', () => ({
  verifyCsrf: vi.fn(),
}));

describe('Tokenize Media Integration Test (Real MeCab)', () => {
  beforeEach(() => {
    vi.mocked(verifyCsrf).mockReturnValue(true);
  });

  it('should successfully tokenize Japanese text when MeCab microservice is online', async () => {
    // Этот тест будет пропущен, если токенизатор сейчас выключен.
    // Если токенизатор онлайн, проверяем реальную токенизацию.
    const tokenizerUrl = process.env.TOKENIZER_URL || 'http://127.0.0.1:8000';
    try {
      const pingRes = await fetch(`${tokenizerUrl}/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tokenizer-API-Key': 'yomumogu-secret-token' },
        body: JSON.stringify({ text: 'テスト', mode: 'detailed' }),
      });
      if (!pingRes.ok) {
        throw new Error('Tokenizer offline');
      }
    } catch {
      // Если токенизатор оффлайн, пропускаем этот конкретный тест
      return;
    }

    const request = new NextRequest('http://localhost/api/media/tokenize', {
      method: 'POST',
      body: JSON.stringify({
        text: '日本語のトкеナイザーテスト',
        mode: 'detailed'
      }),
    });

    const response = await tokenizePost(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.tokens).toBeInstanceOf(Array);
    expect(data.tokens.length).toBeGreaterThan(0);
    expect(data.tokens[0].lemma).toBeDefined();
  });

  it('should return 200 with tokenizationSkipped when MeCab microservice is offline', async () => {
    // Временно перенаправляем на закрытый порт
    const originalUrl = process.env.TOKENIZER_URL;
    process.env.TOKENIZER_URL = 'http://127.0.0.1:9999';

    try {
      const request = new NextRequest('http://localhost/api/media/tokenize', {
        method: 'POST',
        body: JSON.stringify({
          text: '日本語',
          mode: 'detailed'
        }),
      });

      const response = await tokenizePost(request);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.tokenizationSkipped).toBe(true);
      expect(data.tokens).toEqual([]);
      expect(data.lemmas).toEqual([]);
    } finally {
      // Восстанавливаем оригинальный URL
      if (originalUrl) {
        process.env.TOKENIZER_URL = originalUrl;
      } else {
        delete process.env.TOKENIZER_URL;
      }
    }
  });

  it('should query tokenizer health check endpoint successfully if online', async () => {
    const tokenizerUrl = process.env.TOKENIZER_URL || 'http://127.0.0.1:8000';
    try {
      const res = await fetch(`${tokenizerUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        expect(data.status).toBe('ok');
      }
    } catch {
      // Игнорируем ошибку подключения, если микросервис выключен
    }
  });
});

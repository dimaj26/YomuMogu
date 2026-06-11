import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as parsePost } from '../route';
import { NextRequest } from 'next/server';
import { verifyCsrf } from '@/lib/csrf';

// Мокаем CSRF для прогона тестов интеграции
vi.mock('@/lib/csrf', () => ({
  verifyCsrf: vi.fn(),
}));

describe('Parse Media Integration Test (Real MeCab)', () => {
  beforeEach(() => {
    vi.mocked(verifyCsrf).mockReturnValue(true);
  });

  it('should successfully parse and tokenize using the running local MeCab microservice', async () => {
    // Этот тест будет пропущен, если токенизатор сейчас выключен.
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
      return; // Пропускаем
    }

    const request = new NextRequest('http://localhost/api/media/parse', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=LqV2u750oA8'
      }),
    });

    const response = await parsePost(request);
    
    // Если токенизатор онлайн, то ручка должна ответить успешным статусом 200
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.cached).toBe(false);
    
    // Проверяем наличие токенизированных лемм и сегментов из локального JSON кэша
    expect(data.lemmas).toBeInstanceOf(Array);
    expect(data.lemmas.length).toBeGreaterThan(0);
    expect(data.lemmas).toContain('友達');
    
    expect(data.segments).toBeInstanceOf(Array);
    expect(data.segments.length).toBeGreaterThan(0);
  });

  it('should return 200 with tokenizerDown: true when the MeCab tokenizer microservice is offline', async () => {
    // Временно подменяем URL токенизатора на несуществующий порт
    const originalUrl = process.env.TOKENIZER_URL;
    process.env.TOKENIZER_URL = 'http://127.0.0.1:9999';

    try {
      const request = new NextRequest('http://localhost/api/media/parse', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=Jnea4HbYIso'
        }),
      });

      const response = await parsePost(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.tokenizerDown).toBe(true);
      expect(data.lemmas).toEqual([]);
      expect(data.segments.length).toBeGreaterThan(0);
    } finally {
      // Восстанавливаем оригинальный URL
      if (originalUrl) {
        process.env.TOKENIZER_URL = originalUrl;
      } else {
        delete process.env.TOKENIZER_URL;
      }
    }
  });
});

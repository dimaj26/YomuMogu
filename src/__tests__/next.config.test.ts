import { describe, it, expect, afterEach } from 'vitest';
import nextConfig from '../../next.config';

describe('Конфигурация заголовков next.config.ts', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Восстанавливаем оригинальное значение NODE_ENV после каждого теста
    (process.env as any).NODE_ENV = originalEnv;
  });

  it('должен возвращать CSP с unsafe-eval в режиме разработки (development)', async () => {
    (process.env as any).NODE_ENV = 'development';

    const headersConfig = await nextConfig.headers?.();
    expect(headersConfig).toBeDefined();

    // Поиск заголовка Content-Security-Policy
    const cspHeader = headersConfig?.[0]?.headers?.find(
      (h) => h.key === 'Content-Security-Policy'
    );

    expect(cspHeader).toBeDefined();
    expect(cspHeader?.value).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it('не должен возвращать CSP с unsafe-eval в режиме production', async () => {
    (process.env as any).NODE_ENV = 'production';

    const headersConfig = await nextConfig.headers?.();
    expect(headersConfig).toBeDefined();

    const cspHeader = headersConfig?.[0]?.headers?.find(
      (h) => h.key === 'Content-Security-Policy'
    );

    expect(cspHeader).toBeDefined();
    expect(cspHeader?.value).not.toContain("'unsafe-eval'");
    expect(cspHeader?.value).toContain("script-src 'self' 'unsafe-inline'");
  });
});

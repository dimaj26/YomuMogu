import '@testing-library/jest-dom';
import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем .env.local для интеграционных тестов и симуляции
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const parts = line.trim().split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.error('Не удалось загрузить .env.local во время настройки тестов', e);
}

// На случай, если в тестовом окружении jsdom не полностью определен fetch
if (!globalThis.fetch) {
  // @ts-ignore
  globalThis.fetch = vi.fn();
}

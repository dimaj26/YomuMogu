import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Ограничиваем число форк-воркеров половиной ядер: при дефолте vitest форкает
    // на ВСЕ ядра, и при фоновой нагрузке (graphify-rebuild из git-хуков тоже берёт
    // все ядра) возникает 2x-оверсабскрипшн CPU → тяжёлые jsdom+Dexie тесты не
    // укладываются в дефолтный testTimeout (5000мс) → ложные таймауты-флаки (017).
    // testTimeout НЕ трогаем — это детектор перформанс-регрессий, глушить его нельзя.
    poolOptions: {
      forks: { maxForks: 8 },
    },
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts', 'scratch/**', 'tests/e2e/**'],
  },
});

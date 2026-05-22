import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // Интеграционные тесты API запускаются в окружении Node, а не в jsdom (поскольку они тестируют бэкенд-логику)
    globals: true,
    include: ['**/*.integration.test.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

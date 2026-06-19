import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Временные diagnostic/scratch-скрипты (см. CP-3.9) — не часть кодовой базы.
    "scratch/**",
  ]),
  // Тестовые файлы: моки и фикстуры легитимно используют any и ts-ignore,
  // поэтому здесь смягчаем строгость, чтобы шум тестов не блокировал линт-гейт.
  {
    files: [
      "**/__tests__/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "tests/**",
      "vitest.setup.ts",
      "tests/global-setup.ts",
      "tests/global-teardown.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  // set-state-in-effect конфликтует с предписанным проектом SSR/init-паттерном
  // (отложенное чтение localStorage и измерение DOM в useEffect, см. CP-3.4):
  // оставляем как предупреждение, чтобы новые случаи были видны, но не ломали гейт.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import vitest from "eslint-plugin-vitest";

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
    plugins: { vitest },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      // Контроль качества тестов: ловим «зелёные» пустышки (пустые тесты, без
      // ассертов, .skip-заглушки, дубли заголовков). База чистая после калибровки → error.
      // valid-expect: maxArgs=2 разрешает легитимное vitest-сообщение `expect(val, msg).toBe()`.
      "vitest/expect-expect": "error",
      "vitest/no-disabled-tests": "error",
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      "vitest/no-identical-title": "error",
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
  // Архитектурные границы: машинно фиксируем инварианты, которые раньше держались
  // только на дисциплине. Точечные легитимные исключения — через eslint-disable с обоснованием.
  {
    rules: {
      // [CP-3.4] localStorage только через lib/profile.ts. sessionStorage не покрыт
      // (хелпера нет — эфемерные debug/UI-флаги), поэтому в правило не входит.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='localStorage']",
          message:
            "localStorage только через lib/profile.ts (CP-3.4): getProfileItem/setProfileItem/removeProfileItem.",
        },
      ],
      // [CP-3.3] Gemini SDK инкапсулирован в lib/gemini/**; снаружи — через сервисы оттуда.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@google/genai",
              message:
                "Gemini SDK только внутри lib/gemini/** (CP-3.3). Снаружи используй сервисы из lib/gemini.",
            },
          ],
        },
      ],
    },
  },
  // lib/profile.ts — сам реестр localStorage, прямой доступ ему разрешён.
  {
    files: ["src/lib/profile.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  // DebugDrawer — dev-only инспектор хранилища: легитимно перебирает сырой localStorage.
  {
    files: ["src/components/DebugDrawer.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  // lib/gemini/** — слой-владелец Gemini SDK.
  {
    files: ["src/lib/gemini/**"],
    rules: { "no-restricted-imports": "off" },
  },
  // Унаследованные роуты с прямым SDK: уже используют withRetry (CP-3.3); вынос в сервис
  // отложен (рабочий код, рефакторинг без функц. выгоды). Grandfather, чтобы правило ловило новое.
  {
    files: [
      "src/app/api/chat/analyze/route.ts",
      "src/app/api/anki/add/route.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  // Тест-зона освобождена от архитектурных границ (идёт ПОСЛЕ их блока, чтобы
  // перебить severity): тесты легитимно сидят/читают сырой localStorage в jsdom и мокают SDK.
  {
    files: [
      "**/__tests__/**",
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "tests/**",
    ],
    rules: {
      "no-restricted-syntax": "off",
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;

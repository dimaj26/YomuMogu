---
name: testing
description: Test infrastructure — Vitest/Playwright configs, commands, categories, and current test count.
---

# Testing Infrastructure

Formerly `PROJECT_LOGIC.md` [PL-9.1–9.4]. Lint/quality enforcement is split into [lint-and-quality](lint-and-quality.md); testing conventions (no hollow tests, fake-indexeddb setup) are in [coding-rules](coding-rules.md) CP-3.6.

## [PL-9.1] Configs
- `vitest.config.ts` — unit tests, excludes `*.integration.test.ts`
- `vitest.integration.config.ts` — integration tests only, reads `.env.local`
- `vitest.setup.ts` — jsdom setup, `@testing-library/jest-dom` matchers
- `playwright.config.ts` — end-to-end tests (Chromium), requires running dev server

## [PL-9.2] Commands
```powershell
npm run test                     # Unit tests (mocked, offline)
npm run test:integration         # Anki integration tests (requires local Anki Desktop on port 8765)
npm run test:integration:gemini  # Live LLM integration tests (uses Gemini API, costs money)
npm run test:integration:media   # MeCab integration tests (requires tokenizer on port 8000)
npm run test:e2e                 # Playwright end-to-end tests (requires running dev server)
```

## [PL-9.3] Test Categories
| Category | Location | Mock strategy |
|---|---|---|
| Anki Client | `plugins/anki/__tests__/` | Mock `fetch` |
| Local Database | `core/__tests__/` | `fake-indexeddb` polyfill |
| Anki Filter | `plugins/anki/__tests__/` | Pure function, no mocks |
| Gemini Client | `lib/gemini/__tests__/` | Mock `@google/genai` |
| API Routes | `app/api/*/__tests__/` | Mock service singletons |
| UI Components | `app/__tests__/`, `app/chat/__tests__/`, `app/settings/__tests__/`, `app/practice/__tests__/`, `app/practice/quiz/__tests__/` | Mock `fetch`, `lucide-react`, `next/navigation` |
| Hooks | `hooks/__tests__/` | Mock state and time |
| Integration (Anki) | `plugins/anki/__tests__/sync.integration.test.ts` | Real local AnkiConnect |
| Integration (Gemini) | `lib/gemini/__tests__/*.integration.test.ts` | Real Gemini API call |
| Integration (MeCab) | `app/api/media/parse/__tests__/parse.integration.test.ts` | Real local MeCab microservice |
| Journey (golden path) | `__tests__/journeys/*.journey.test.ts` | Mock Gemini singletons, `fake-indexeddb`; deterministic cross-system stitch, runs in default suite |

## [PL-9.4] Current Test Count
527 unit/integration tests across 77 test files. All passing. Playwright E2E tests fully aligned with sequential execution and offline spec.

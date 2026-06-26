---
name: coding-rules-integrations
description: Integration-layer coding conventions — Gemini API patterns, profile/storage, API routes, and testing. Split from coding-rules.
---

# Coding Rules — Integrations (Gemini / Storage / API / Testing)

Split from [coding-rules](coding-rules.md) (the general conventions). These cover the heavy integration surfaces. Hard, machine-enforced subset: [constraints](constraints.md), [lint-and-quality](lint-and-quality.md). Runtime contracts: [gemini-patterns](gemini-patterns.md), [api-contracts](api-contracts.md), [data-schema](data-schema.md), [testing](testing.md).

## [CP-3.3] Gemini API Patterns
- Always use `withRetry()` from `src/lib/gemini/retry.ts` — never call `ai.models.generateContent` directly.
- Always use `responseMimeType: 'application/json'` + `responseSchema` (Structured Output).
- Services are **singletons** exported at module bottom: `export const chatService = new ChatService()`.
- System instructions must NOT use words: `ролевая игра`, `Роль ИИ`, `Роль пользователя`. Use: `практический диалог`, `персонаж`, `кем является ИИ`.
- Target word concealment: strictly forbid all target words in turns 1-2; in turns 3+ allow only already user-detected target words.
- Politeness Register constraints: For Levels 1 & 2, strictly exclude formal clerk-speak Keigo/Kenjougo (like `いらっしゃいませ`, `お会計`, `ございます`). Stick to simple polite forms (`です/ます/てください`) and prioritize student comprehension.
- Context retention and memory: The AI must retain, remember, and adapt to choices (items, colors, sizes) made by the user in previous turns. It must not loop on already decided options or repeat questions.
- Proactive target word nudging: The AI must design situational prompts and questions to guide the student towards unused target words.
- Cyrillic/Russian input check: check user's input for Russian characters. For hybrid inputs (Cyrillic placeholders in Japanese sentences, e.g. 'Стулの座って'), set `isCorrect: false` and return a fully corrected Japanese sentence with the translated placeholder (e.g. '椅子に座って') in `correction`. For entirely Russian messages, set `isCorrect: false` and return the complete Japanese translation in `correction`. Enforce the same Furigana/Ruby rules in `correction` as in `reply` (every single kanji word wrapped in HTML ruby tags, regardless of Japanification level or progress). Never detect target words from Russian translations/placeholders.
- Response structure: reply must contain exactly one response sentence/phrase with exactly one question. Enforce difficulty level limits via self-counting. If the user asks a question, answer it in character first before asking the next question. Base the reply on the corrected meaning of the user's input (from `grammarFeedback.correction`). Never ask abstract questions (e.g. 'What are your plans?'); always ask highly concrete, situational questions to nudge the user to target words. Prefer open-ended questions over simple yes/no questions (unless a direct confirmation, preference, or ordering choice is contextually needed) to prevent one-word answers and encourage the user to write descriptive Japanese.

## [CP-3.4] Profile & Storage
- All client-side persistence via `src/lib/profile.ts` helpers: `getProfileItem`, `setProfileItem`, `removeProfileItem`.
- Never use raw `localStorage.getItem('yomumogu_...')` — always go through profile helpers.
- All `localStorage` access must be guarded: `if (typeof window === 'undefined') return null`.
- SSR hydration: defer localStorage reads to `useEffect` only.
- Client-side database queries use Dexie.js (`core/db.ts`), current schema **version 8** (the `*tags` multiEntry index was added at v5; the dual-curve collapse landed at v8 — full schema in [data-schema](data-schema.md), ground truth is `core/db.ts`). Defer all database transactions to client-side lifecycle functions (`useEffect`) or wrap them in a `typeof window !== 'undefined'` check to prevent Next.js SSR hydration errors.
- **Dual FSRS Scheduling**: Scheduler utility calls (`calculateNextFsrsState`) support signature overloading. They must accept either a flat legacy object or a nested structure with the review type specified (`'passive' | 'active'`) to support both global UI translations and deep dialog vocabulary practices.
- **Japanification Provider Enforcement**: The `useJapanification` hook must strictly be used within a `<JapanificationProvider>`. It is configured to throw an error if the context is undefined, preventing isolated local state synchronization splits. All tests rendering components calling this hook must wrap the subject under test with the provider.

## [CP-3.5] API Routes
- Every route validates required fields and returns structured JSON errors with appropriate HTTP codes.
- Every route logs at start (`[INFO]`) and on error (`[ERROR]` / `[WARN]`).
- Check `GEMINI_API_KEY` from `process.env` at top of route — return 500 with clear message if missing.

## [CP-3.6] Testing
- Unit tests use Vitest + `@testing-library/react`. Run with `npm run test`.
- All Gemini calls in unit tests must be **mocked** — never hit real API.
- Integration tests (real API) live in `*.integration.test.ts`. Run local Anki integration tests with `npm run test:integration`, local MeCab integration tests with `npm run test:integration:media`, and live LLM tests with `npm run test:integration:gemini`.
- Integration tests require Anki Desktop to be running with AnkiConnect active on port 8765; if Anki is offline, sync-related integration tests will be silently skipped. The AI must explicitly instruct the user to open Anki Desktop before running integration tests.
- When adding a new module, add corresponding test file in `__tests__/` sibling directory.
- Journey (golden-path) tests live in `src/__tests__/journeys/*.journey.test.ts`: deterministic cross-system flows (e.g. gating → daily pool → API routes → FSRS) with Gemini singletons mocked and `fake-indexeddb`. They run in the default `npm run test` suite, so keep them few and lightweight — seed a small deck directly, do **not** import the full 500-word starter deck (it bloats suite time and causes load-induced timeouts elsewhere).
- Mock all `lucide-react` icons in UI component tests to avoid SVG rendering issues in jsdom.
- **No hollow or over-mocked tests.** Every test must assert real behaviour: no empty test bodies, no test without an `expect`, no `.skip` left as a placeholder. Mock only the genuine external boundary (Gemini, network, time) — do not mock the unit under test or stub so much that the assertion only checks the mock. A green test that verifies nothing is worse than no test. (Empty/assertion-less/disabled tests are also lint-blocked, see [lint-and-quality](lint-and-quality.md).)
- For database-dependent unit tests (e.g. settings or practice pages querying Dexie IndexedDB), import and initialize the global polyfill `fake-indexeddb` at the top of the test file: `import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb'; globalThis.indexedDB = fakeIndexedDB; globalThis.IDBKeyRange = IDBKeyRange;` to run offline DB queries and statistics aggregation safely in JSDOM.
- Playwright E2E tests must be configured to run sequentially (`workers: 1`, `fullyParallel: false`) to avoid Next.js dev server compilation overload and IndexedDB database transaction locks. If running HTTPS fetch/scraping tests (like live YouTube transcript tests) in environments with certificate issues, set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at the top of the spec file to bypass SSL validation. Live tests fetching YouTube search or transcripts must dynamically skip execution (using `test.skip` or `this.skip`) upon encountering YouTube IP rate-limiting (HTTP 429) rather than failing, as rate limits are an environmental condition.

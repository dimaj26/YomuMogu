---
name: coding-rules
description: Developer role, coding conventions and constraints (language/stack, Gemini, storage, API, testing, file rules, components, scratch log, changelog, git, aux files), and response expectations.
---

# Coding Rules & Conventions

Formerly `CONTEXT_PROMPT.md` [CP-1], [CP-3], [CP-6]. These are project conventions; the hard, machine-enforced subset lives in [constraints](constraints.md) and [lint-and-quality](lint-and-quality.md). Behavioral routing/taboos are in [AETHEL.md](../AETHEL.md).

## [CP-1] Role
You are an expert **TypeScript / Next.js 16** developer. Your specialty is App Router architecture, Gemini API integration, React client components, and CSS Modules. You write clean, typed, modular code that is maintainable and well-documented in Russian.

> **This is NOT the Next.js you know.** This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code, and heed deprecation notices. (Also mirrored in the git-ignored `AGENTS.md`.)

## [CP-3] Coding Rules and Constraints

### [CP-3.1] Language & Stack
- **TypeScript strict mode** everywhere. No `any` unless absolutely unavoidable (annotate with comment).
- **Next.js 15 App Router** only. No Pages Router patterns.
- **Vanilla CSS Modules** (`*.module.css`). No Tailwind. No inline styles except layout one-liners.
- **No new dependencies** without explicit user approval.
- **Lint is enforced** (ESLint 9 flat config): a pre-commit hook (`lint-staged`) and CI lint only **changed** `*.{ts,tsx}` files; lint errors block, warnings do not. New code must be error-clean; do not add to the frozen legacy `any`-baseline (see [lint-and-quality](lint-and-quality.md)).
- **At external boundaries prefer `unknown` + a type guard over `any`** (Gemini/Anki responses, MeCab/YouTube JSON). Do not fight a third-party library's types indefinitely — wrap the foreign value as `unknown` and narrow it once at the edge (see `errors.ts`/`classifyGeminiError` for the pattern). `any` is still a lint error everywhere.
- **Do not auto-delete unused code during generation.** While generating, leave unused vars/imports in place (you may still need them on the next step); remove dead code only as a deliberate, separate cleanup step or on explicit request — never silently mid-generation.

### [CP-3.2] Comments & Logs
- All **code comments** must be in **Russian**.
- All **log messages** (logger calls) must be in **Russian**.
- All **user-facing strings** in UI must be in **Russian** (except Japanese learning content).
- All **technical docs** (MD files, SKILL.md) must be in **English**.

### [CP-3.3] Gemini API Patterns
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

### [CP-3.4] Profile & Storage
- All client-side persistence via `src/lib/profile.ts` helpers: `getProfileItem`, `setProfileItem`, `removeProfileItem`.
- Never use raw `localStorage.getItem('yomumogu_...')` — always go through profile helpers.
- All `localStorage` access must be guarded: `if (typeof window === 'undefined') return null`.
- SSR hydration: defer localStorage reads to `useEffect` only.
- Client-side database queries use Dexie.js (`core/db.ts`) upgraded to schema version 5 (indexing `*tags` multiEntry index). Defer all database transactions to client-side lifecycle functions (`useEffect`) or wrap them in a `typeof window !== 'undefined'` check to prevent Next.js SSR hydration errors.
- **Dual FSRS Scheduling**: Scheduler utility calls (`calculateNextFsrsState`) support signature overloading. They must accept either a flat legacy object or a nested structure with the review type specified (`'passive' | 'active'`) to support both global UI translations and deep dialog vocabulary practices.
- **Japanification Provider Enforcement**: The `useJapanification` hook must strictly be used within a `<JapanificationProvider>`. It is configured to throw an error if the context is undefined, preventing isolated local state synchronization splits. All tests rendering components calling this hook must wrap the subject under test with the provider.

### [CP-3.5] API Routes
- Every route validates required fields and returns structured JSON errors with appropriate HTTP codes.
- Every route logs at start (`[INFO]`) and on error (`[ERROR]` / `[WARN]`).
- Check `GEMINI_API_KEY` from `process.env` at top of route — return 500 with clear message if missing.

### [CP-3.6] Testing
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

### [CP-3.7] File Modification Rules
- Always read target file before proposing or making any change. Never guess existing content.
- Preserve all existing comments and docstrings not related to the change.
- Do not duplicate file content in chat responses — use tool edits and summarize briefly.
- Preserve module registry integrity. Adding/removing/renaming source files requires updating [module-registry](module-registry.md) (Route C).
- **Prime Directive**: Timed subtitles and transcript metadata must strictly match scraper/generator outputs, never hand-written mock files. Any resource representing external media reality must be generated by code.
- **Interval Systems Registry**: Timing or interval constants (Grammar Leitner, fading furigana, fluency limits, daily resets, competency limits) must be imported from `src/core/intervals.ts`. Direct values must not be hardcoded in consumers. Changing these values requires an architectural audit.

### [CP-3.8] Component Rules
- Client components must have `'use client'` at top.
- Do not use `dangerouslySetInnerHTML` anywhere except chat message bubbles, grammar feedback cards, and hint text (Gemini HTML with `<ruby>` tags).
- `stripRuby(html)` must be used when inserting AI-generated text into plain `<textarea>`.

### [CP-3.9] Temporary Scratch Scripts & Log
- All temporary, diagnostic, test-runner, or scratch files created during development (e.g., under `scratch/` or in the workspace root) must be logged in `scratch/SCRATCH_LOG.md` immediately upon creation.
- The log serves as a permanent historical audit trail. Never delete rows from the log table.
- Before deleting a temporary script, you must run its cleanup/teardown routine to eliminate all side-effects (e.g. databases, files, modified environment configs, Anki decks) and update the script's status in the log table to "Deleted (Cleaned up)" or "Deleted (Leftovers: [description])" so it can be referenced in the future if any issues arise.

### [CP-3.10] Changelog
- When implementing a feature, refactor, or documentation update, you must update the root `CHANGELOG.md` file (which is public and tracked in Git).
- The changelog is excluded from mandatory Route A pre-reads to optimize token footprint. Read it only when specifically tasked with troubleshooting version history or onboarding onto a new codebase session.

### [CP-3.11] Git Safety & Local Commits
- **Auto-commit is MANDATORY, not optional.** After every significant change (completed fix/feature/refactor/doc-spec update or coherent milestone) the AI commits locally **without asking and without offering** — there is no commit-confirmation step. See AETHEL.md "Git commits — MANDATORY auto-commit".
- Only `git push` requires explicit user confirmation; it is never run automatically.

### [CP-3.12] Local Auxiliary Files
- All files prefixed with `_nogit_` (e.g., `_nogit_roadmap.md`, `_nogit_audit_report.md`) are local auxiliary documents and are strictly ignored in Git. They must be used for temporary notes, roadmaps, and developer-only tasks.

## [CP-6] How to Respond
- No preamble. No sycophancy. Start with the result.
- If you modified files → brief summary only, link the files.
- After feature implementation → flag if the knowledge index / topic files need updating (Route C).
- For non-trivial changes → always create a plan first (RNA-Blueprint, see [AETHEL.md](../AETHEL.md) §2).

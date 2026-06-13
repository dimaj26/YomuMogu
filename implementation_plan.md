# RNA-Blueprint — Chunk A: Scalable "hard-words → chat" target selection

> Route A (RNA-1). Executor: **Gemini Flash 3.5** (per user directive).
> Scope: wire the dead `shouldRouteToChat` into real chat target selection, make chat scale from 0 to 10k+ words, present 3 themes × 5–8 words (user picks one), and gate chat entry at cold start.
> Roadmap source: `_nogit_roadmap.md` §2.6 (final model) + §2.7.A (pre-plan).

---

## 1. Base DNA (environment / runtime constraints)

- OS: Windows 10 / PowerShell. Call `.\venv\Scripts\python.exe` directly if Python is ever needed (not in this chunk).
- Stack: Next.js 16 App Router, TypeScript strict, React 19 client components, Dexie.js (IndexedDB), Gemini via `withRetry`. No new dependencies.
- Runtime: target-word selection runs **client-side** over IndexedDB (`db.words`); all DB access must stay behind the existing SSR guard (`typeof window === 'undefined'` → early return).
- Testing: Vitest (`npm run test`, mocked/offline). DB-dependent tests need the `fake-indexeddb` polyfill.
- Constraint: the public API surface (`getDailyActivePool` returns `AnkiWord[]`; `generateSessions(words: AnkiWord[])`) must NOT change signature — selection happens before flattening, carried via one optional flag.

## 2. Task RNA (logic, risks, edge cases)

**Logic.** Difficulty (`active.stability < 3 || active.lapses >= 2`, the existing `shouldRouteToChat`) must actually influence which words become chat targets. Today it does not: selection is by theme + `status !== 'mature'`. The fix carries a per-word `isHard` flag from the `LocalWord` (which has FSRS fields) into the `AnkiWord` (which loses them), and `groupWordsIntoThemes` prioritizes hard words first within each theme. Theme set stays at **3 themes**, each holding **5–8 words** (user picks the closest theme, regenerates the rest). At cold start (no learnt words) chat is gated until enough words reach `learning`/`review`.

**Scaling behaviour (must hold 0 → 10k):**
- 0 words / only `new`: `shouldRouteToChat` returns false for all → no hard words → `canEnterChat` false → chat gated, UI routes to Warm-up/Quiz.
- mid: hard words exist → they float to the front of each theme; non-hard fill the rest up to 5–8.
- 10k / post-pause: many hard words → only enough to fill 3×(5–8) are consumed; the rest simply are not selected this session (fixed per-session cap = avalanche-safe). Daily session count remains governed by future P0/P1 budget work (out of scope here).

**Risks & mitigations:**
- `AnkiWord` lacks `stability/lapses/due` (dropped by `localWordToAnkiWord`). → add one optional `isHard?: boolean`, computed in the converter via `shouldRouteToChat(localWord)`. No need to widen `AnkiWord` with raw FSRS fields.
- `groupWordsIntoThemes` re-sorts by `status` and would erase hard-first order. → change its internal sort to `isHard` first, then `status !== 'mature'`.
- Changing per-theme size 5 → 5–8 may break existing `groupWordsIntoThemes` assertions. → audit and update those tests (allowed in the plan; the `test-runner-and-debugger` subagent may NOT edit tests).
- Word-count constants are **counts, not intervals** → they live next to the logic (precedent: `MIN_WORDS_FOR_3_SESSIONS` lives in `localDeckService`), NOT in `intervals.ts` (registry is for time-based systems per [PL-10]).

**Edge cases:** pool with 0 hard words (normal fill); pool < `MIN_WORDS_FOR_3_SESSIONS` (existing new-word top-up); fully empty pool (existing mature fallback); exactly `CHAT_MIN_ENTRY_WORDS` boundary; a hard word that is also `mature` (hard-first must still rank it above easy non-mature? — decision: `isHard` outranks `mature` penalty, because difficulty is the whole point).

## 3. Contextual Constraints (CC)

- **[CC-1] Adaptive Reviews & Situational Routing [PL-5.9]** — `active.stability < 3 || lapses >= 2` routes a word to dialog; this chunk is the first real implementation of that rule. `groupWordsIntoThemes` situational clustering is preserved.
- **[CC-2] Dual-State FSRS [PL-6.5.7]** — difficulty is read from the `active` state only; `passive` untouched here.
- **[CC-3] AnkiWord schema [PL-3.3]** — extend with optional `isHard?: boolean`; keep all existing fields.
- **[CC-4] No direct Gemini SDK calls / `withRetry` [PL-8.2 / CP-3.3]** — this chunk adds NO Gemini calls (pure pre-Gemini selection); `generateSessions` retry path unchanged.
- **[CC-5] SSR guard for IndexedDB [PL-8.3 / CP-3.4]** — `getDailyActivePool` keeps its `typeof window` guard; new helpers are pure (no DB) or reuse the guarded path.
- **[CC-6] Russian comments/logs/UI [CP-3.2]** — all new code comments and any user-facing strings in Russian; this plan doc stays English.
- **[CC-7] Test coverage [PL-8.6 / CP-3.6]** — new logic gets unit tests; DB-touching tests import `fake-indexeddb`; pure helpers need no polyfill.
- **[CC-8] Interval Registry discipline [PL-10 / CP-3.7]** — confirmed: session word-counts are NOT interval/timing constants, so they are NOT added to `intervals.ts`; they live with the logic.
- **[CC-9] No new dependencies [CP-3.1].**

## 4. Proposed Changes (by component)

**Core / scheduler**
- `src/core/scheduler.ts` `[MODIFY]` — keep `shouldRouteToChat` as-is. Add pure helper `canEnterChat(words: LocalWord[]): boolean` (true when ≥ `CHAT_MIN_ENTRY_WORDS` words have `active.status` in `{learning, review}`). Add const `CHAT_MIN_ENTRY_WORDS = 5`.

**Core / local deck service**
- `src/core/localDeckService.ts` `[MODIFY]` — import `shouldRouteToChat`; in `localWordToAnkiWord` set `isHard: shouldRouteToChat(word)`. In `getDailyActivePool`, after building `pool: LocalWord[]`, stable-sort so `shouldRouteToChat` words come first (keeps existing due/new/mature bucket logic intact). Return type unchanged (`AnkiWord[]`).

**Plugins / Anki filter (types)**
- `src/plugins/anki/filter.ts` `[MODIFY]` — add `isHard?: boolean` to the `AnkiWord` interface (optional, backward-compatible).

**Gemini client / theme grouping**
- `src/lib/gemini/client.ts` `[MODIFY]` — in `groupWordsIntoThemes`: (1) sort candidates within a theme by `isHard` first, then `status !== 'mature'`; (2) parameterize per-theme size to 5–8 via consts `CHAT_WORDS_PER_THEME_MIN = 5`, `CHAT_WORDS_PER_THEME_MAX = 8` (noun cap raised, universal fill up to MAX, MIN floor enforced). Still returns exactly 3 themes.

**UI / practice page**
- `src/app/practice/page.tsx` `[MODIFY]` — before generating sessions / entering chat, call `canEnterChat(localWords)`; if false, disable the generate/enter action and show a Russian prompt steering the user to Warm-up + Quiz (reuse the existing low-count banner pattern, e.g. around `priorityWordsCount`).

**Tests**
- `src/lib/gemini/__tests__/client.test.ts` `[NEW]` — `groupWordsIntoThemes` priority + size tests.
- `src/core/__tests__/scheduler.test.ts` `[MODIFY]` — `canEnterChat` tests.
- `src/core/__tests__/localDeckService.test.ts` `[MODIFY]` — `getDailyActivePool` carries `isHard`.
- Audit existing `groupWordsIntoThemes` assertions (5-word assumption) and update to the 5–8 range.

## 5. Execution Steps (chunked 3–5; report and await approval after Chunk 1)

**Chunk 1 — TDD reproducer + types (steps 1–4):**
1. `[TEST]` Add failing reproducer `groupWordsIntoThemes > приоритизирует трудные слова (isHard) в целевые слова тем` in `src/lib/gemini/__tests__/client.test.ts` [NEW]; verify it FAILS (no `isHard` logic yet). [CC-1][CC-7]
2. `[PL-3.3]` Add `isHard?: boolean` to `AnkiWord` in `src/plugins/anki/filter.ts`. [CC-3]
3. `[PL-5.9]` In `src/core/localDeckService.ts`, import `shouldRouteToChat`, set `isHard` in `localWordToAnkiWord`. [CC-1][CC-2]
4. `[TEST]` Add `getDailyActivePool > помечает трудные слова isHard в выдаче` in `src/core/__tests__/localDeckService.test.ts` (with `fake-indexeddb`). [CC-7]

→ **REPORT & AWAIT APPROVAL.**

**Chunk 2 — theme prioritization + size (steps 5–7):**
5. `[PL-5.9]` In `groupWordsIntoThemes`, sort by `isHard` first then non-mature; add `CHAT_WORDS_PER_THEME_MIN/MAX`; make the reproducer from step 1 pass. [CC-4][CC-8]
6. `[TEST]` Add `groupWordsIntoThemes > формирует 3 темы по 5–8 слов`; audit & update existing 5-word assertions to the new range.
7. `[CP-3.2]` Run `npm run test`; ensure green (delegate log-cleanup to `test-runner-and-debugger` if needed — it must NOT touch test files).

→ **REPORT & AWAIT APPROVAL.**

**Chunk 3 — cold-start gate (steps 8–10):**
8. `[PL-5.9]` Add `canEnterChat` + `CHAT_MIN_ENTRY_WORDS` to `src/core/scheduler.ts`. [CC-5]
9. `[TEST]` Add `canEnterChat > false при менее CHAT_MIN_ENTRY_WORDS слов learning/review` in `scheduler.test.ts`; verify red→green.
10. `[CP-3.8]` Gate generate/enter in `src/app/practice/page.tsx` via `canEnterChat`; Russian prompt to Warm-up/Quiz when blocked. [CC-6]

→ **REPORT.** Flag CMD-1 (PROJECT_LOGIC [PL-2.2] / [PL-5.9]) since selection logic and a new helper change behaviour.

## 6. Verification & TDD reproducer

**Primary reproducer (the "dead code" bug — difficulty ignored in chat):**
- File: `src/lib/gemini/__tests__/client.test.ts`
- Case: `groupWordsIntoThemes > приоритизирует трудные слова (isHard) в целевые слова тем`
- Setup: feed `AnkiWord[]` sharing one theme where capacity forces a choice between an `isHard:true` word and an easy non-mature word; assert the hard word is in the theme's `words`.
- Expected: **FAILS before Chunk 2** (no `isHard` ordering), **PASSES after**.

**Secondary reproducers:**
- `src/core/__tests__/localDeckService.test.ts` → `getDailyActivePool > помечает трудные слова isHard в выдаче` (fake-indexeddb).
- `src/core/__tests__/scheduler.test.ts` → `canEnterChat > false при менее CHAT_MIN_ENTRY_WORDS слов learning/review`.
- `src/lib/gemini/__tests__/client.test.ts` → `groupWordsIntoThemes > формирует 3 темы по 5–8 слов`.

**Commands:** `npm run test` (unit, offline/mocked).

**Manual checks:**
1. Deck with several hard words (low stability / lapses≥2) → generate themes → hard words appear among target words across the 3 themes.
2. Fresh profile with <5 `learning`/`review` words → generate/enter chat is disabled with a Russian Warm-up/Quiz prompt.
3. Profile with ≥5 learning words but 0 hard → themes still fill 5–8 from non-hard words (chat never empty).
4. Large deck after a long pause → each theme caps at ≤8; no overflow/freeze.

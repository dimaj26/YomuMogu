# Tasks 016: HomePage page.test.tsx de-flaking

Sequential. One commit at the end (test-only). Reference: `src/app/__tests__/home-grid.test.tsx` (the 014 fix) — same component, same mock.

- [ ] **T001** Port the in-memory `@/core/db` mock into `src/app/__tests__/page.test.tsx`.
  1. Remove the in-file fake-indexeddb install (`:1-6`). Do NOT touch `vitest.setup.ts`.
  2. Copy the `vi.hoisted` + `vi.mock('@/core/db', ...)` block from `home-grid.test.tsx` verbatim: a generic `createMockTable()` (methods `bulkPut`, `put`, `clear`, `where(field).equals(value) -> {toArray, count, delete, filter(pred) -> {toArray, count}}`) backing `words` **and** `ui_words`. Keep the local `const db = { words: mockWordsTable }` binding the test's `seedWords`/`beforeEach` use (`db.words.bulkPut`, `db.words.clear`).
  3. Keep the real `import { LOCAL_DECK_NAME } from '@/core/localDeckService'` — not mocked.
  - **Accept**: `npx vitest run src/app/__tests__/page.test.tsx` green 11/11, materially faster than before. If a mock method is missing (throws), add it faithfully — do not weaken an assertion.

- [ ] **T002** Confirm timeouts.
  With the mock, reads are instant; the default 1000 ms `waitFor`s should pass comfortably. Only if a specific assertion still races under `npx vitest run src/app/__tests__/page.test.tsx` repeated ~5×, give that one assertion an explicit `{ timeout: 5000 }`. Otherwise leave timeouts untouched.
  - **Accept**: file green across 5 isolated re-runs.

- [ ] **T003** Prove determinism.
  Loop the full suite 20× (`npx vitest run`), watch for `page.test.tsx` failures. Prefer running in the background (each loop ~40 s).
  - **Accept**: 0 failures of this file across 20 runs (or, per 015's precedent, exactly one genuinely-unreproducible residual documented honestly in spec.md — never a blind fix).

- [ ] **T004** Commit (test-only).
  `test(home): de-flake app/page.test.tsx via in-memory db mock (016, follows 015)`. Stage the test file + `specs/016-**`. **Do not push** (explicit approval required). Guard satisfied by the staged `specs/016-**` docs.
  - **Accept**: clean tree; spec.md Status → Implemented; boxes above checked. This closes the suite-wide de-flaking arc (014→016).

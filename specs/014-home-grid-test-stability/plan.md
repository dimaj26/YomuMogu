# Plan 014: home-grid test stability

**Input**: spec.md | **Executor**: Sonnet | **Tasks**: tasks.md

## Technical context

| Area | Fact (verified 2026-07-02) |
|---|---|
| Test | `src/app/__tests__/home-grid.test.tsx`, 8 tests / 4 describes. Heavy cases: 500-word (`:84`, timeout 25 s), 550-word (`:96`, timeout 25 s + `waitFor` 20 s), 25-word (`:90`, timeout 12 s). The 500-word `findByText` at `:87` is what timed out under load. |
| Seeding | `seedWords(n)` (`:37`) builds n rows and `db.words.bulkPut`s them into fake-indexeddb. |
| Reads per render | `HomePage` mount triggers ≥3 word-table reads: `isLocalDeckInitialized` → `db.words.where('profileId').equals(id).count()` (`localDeckService.ts:75`); `getPriorityWordsCount` → `.toArray()` (`localDeckService.ts:559`); heatmap effect → `.where('profileId').equals(activeProfileId).toArray()` (`page.tsx:94`). All go through the same `db.words` (`@/core/db`). |
| Runner | vitest 4.1.9, jsdom, `globals: true`. `vitest.config.ts` sets **no** `poolOptions`/`fileParallelism` → default parallel across files. `vitest.setup.ts` installs fake-indexeddb globally (the test file also re-installs it redundantly, `:1-6`). |
| Mechanism | Failure is a **timeout**, not a wrong value → CPU-starvation/perf, not state pollution. Confirmed: passes 8/8 in isolation. |

## Decision (already made — do not re-litigate)

**Primary: mock the `db.words` table with an in-memory backing** for this file, so
the 3 reads + the seed no longer pay fake-indexeddb structured-clone cost. Because
all three callers (page + localDeckService) go through the single `@/core/db`
`words` object, mocking at the `@/core/db` layer transparently covers every read at
once — no per-callsite stubbing. Runtime becomes deterministic and sub-second, so
the flakiness (a wall-clock artifact) disappears and timeouts can drop to ≤5 s.

**Why this over the alternatives:**
- *Serial/non-parallel project for the file* — zero fidelity loss but fragments the
  single `npm run test`, adds config surface, and the vitest-4 cross-project
  contention guarantee is unverified. Keep as **fallback** if the mock proves leaky.
- *Shrink the deck* — rejected: the 500 (boundary) and 550 (>500 slice) cases need
  those counts to prove the exact regression.

**Fidelity:** the regression under test lives in `page.tsx` bucketing/slicing, which
the mock still exercises fully. Real-Dexie query correctness is covered separately by
`src/core/__tests__/db.test.ts`; this file does not need to re-prove it.

## Approach

Add a small reusable in-memory words-table mock (test helper), point this file's
`vi.mock('@/core/db', ...)` at it, keep every existing assertion, and tighten
timeouts. No product code changes. Verify by looping the full suite.

Language rule: test code comments in Russian (project convention); this plan/spec in English.

## Risks

- **Mock surface leak**: the mock must implement exactly the `db.words` methods these
  paths use — at minimum `bulkPut`, `clear`, and a chainable `where(field).equals(v)`
  exposing `.toArray()` and `.count()`. If a path uses another method, the test throws
  a clear "not implemented" — extend the mock. Discover the full set by running the
  file against the mock and filling gaps (T002 acceptance covers this).
- **Redundant global fake-indexeddb** (`:1-6` + setup) becomes dead for this file once
  mocked — remove the in-file re-install to avoid confusion, but leave `vitest.setup.ts`
  untouched (other files rely on it).
- If the mock turns out to under-represent behavior the assertions depend on (e.g.
  ordering), fall back to the serial-project route in this plan's Decision section
  rather than weakening an assertion.

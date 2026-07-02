# Plan 016: HomePage page.test.tsx de-flaking

**Input**: spec.md | **Executor**: Sonnet | **Tasks**: tasks.md

## Technical context

| Area | Fact (verified 2026-07-02) |
|---|---|
| Test | `src/app/__tests__/page.test.tsx`, 11 tests, tests the **same `HomePage`** component as `src/app/__tests__/home-grid.test.tsx` (014). Installs fake-indexeddb globally at `:1-6`, seeds via `db.words.bulkPut` through a local `localWord()` helper, `beforeEach` does `db.words.clear()`. |
| Cost driver | Identical to 014's root cause: `HomePage` mount reads the words table 3× through fake-indexeddb (`isLocalDeckInitialized` count, `getPriorityWordsCount` toArray, heatmap toArray). Failed 2/20 full-suite runs during 015's addendum loop; not reproduced in isolation. |
| Existing fix | `home-grid.test.tsx` already carries a proven `vi.hoisted` in-memory mock covering `words` + `ui_words` (needed because `JpUIProvider`, wrapped in some HomePage render trees, also reads `db.ui_words`). This file does not import `JpUIProvider` directly in its render helper — confirm during T001 whether `ui_words` mocking is actually needed here, or whether `words`-only suffices; port both regardless since the proven pattern already handles it and the marginal cost is zero. |
| Timeouts | All `waitFor` calls in this file use the default (no explicit `{ timeout }`). Per 015/T002, leave as-is unless a specific assertion still races after the mock — decided already, do not pre-emptively add timeouts. |

## Approach

Port the exact `vi.hoisted` mock block from `home-grid.test.tsx` verbatim — no
new design decisions needed, this is a mechanical reuse of an already-verified
pattern. No product code changes.

## Decision (already made)

- Reuse, don't reinvent: copy the mock, do not write a new one.
- Leave timeouts alone unless T002's isolated re-run stress proves otherwise.
- Per 015's precedent: if a residual unreproducible failure survives the 20-run loop, document it honestly in spec.md rather than padding timeouts blindly.

## Risks

- If this file's render tree pulls in `JpUIProvider` transitively (not just `JapanificationProvider`), the `ui_words` mock is mandatory, not optional — T001's accept criterion (11/11 green) will catch this immediately via a hard crash if missing, same as it did in 014.

# Feature 016: HomePage page.test.tsx de-flaking (015 follow-up, final)

**Status**: Planned | **Branch**: `016-home-page-test-deflaking` | **Source**: 5th flaky file surfaced by 015's verification loop (2026-07-02)

## Problem

`src/app/__tests__/page.test.tsx` (11 tests, the HomePage behavioural suite) failed
2 of 20 full-suite runs during 015's addendum loop — same class as every other
015/014 flake: a timeout under vitest's default parallel CPU contention, not a
product defect. Green in isolation. This is the last known flaky file in the suite.

## Why it matters (keep the test)

It guards the adaptive-CTA logic of the main screen — first-run → diagnostics,
returning user (due) → "Продолжить обучение" + counter, newbie → "разминка",
all-done → neutral no-pressure state — direct regressions for audit-004 fixes
007/008, plus profile/help modals, mascot, and the Kumiko heatmap. Do not delete.

## Root cause (verified)

Same as `home-grid.test.tsx` (014): this file tests the **same `HomePage`
component**, which on mount reads the words table 3× through fake-indexeddb
(`isLocalDeckInitialized` count, `getPriorityWordsCount` toArray, heatmap toArray).
The test seeds via `db.words.bulkPut` and installs fake-indexeddb globally
(`:1-6`). Under load the real fake-indexeddb round-trips exceed the tests' default
1000 ms `waitFor`.

## Approach

Reuse the **exact** in-memory `@/core/db` mock already proven in
`home-grid.test.tsx` (words + ui_words tables, `vi.hoisted`). No new pattern.
Because reads become instant, the default `waitFor` timeouts are ample — no
timeout changes expected.

## Out of scope

- Product code — untouched.
- The other four files — already fixed in 014/015.

## Success criteria

- `page.test.tsx` green in isolation (11/11).
- 20 consecutive full-suite runs: 0 failures in this file (per 015's precedent, a single genuinely-unreproducible residual is acceptable **only if** documented honestly, never papered over by blind timeout padding).
- Lint clean; no product code changed.

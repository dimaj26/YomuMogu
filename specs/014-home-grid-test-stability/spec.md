# Feature 014: home-grid test stability (013 follow-up)

**Status**: Implemented | **Branch**: `014-home-grid-test-stability` | **Source**: flaky test surfaced during 013 verification (2026-07-02)

## Problem

`src/app/__tests__/home-grid.test.tsx` is a false-negative flaky test. It passes
in isolation (8/8, ~14 s) but intermittently fails the full `npm run test` run
with a **timeout** (not a wrong value) on the 500-word case. The product code is
correct — the flakiness is in the test's robustness, so a green suite can go red
for reasons unrelated to any real defect (worst on a loaded CI machine).

## Root cause (verified)

On mount `HomePage` (`src/app/page.tsx`) reads the words table **3× through
fake-indexeddb** per render — `isLocalDeckInitialized` (count), `getPriorityWordsCount`
(toArray), and the heatmap effect (`db.words.where('profileId').equals().toArray()`),
each over 500–550 rows — on top of a `bulkPut` seed and a two-provider chain.
fake-indexeddb structured-clones every row on every read (~1500 clones/test). The
heavy cases carry generous wall-clock timeouts (25 s / 12 s) to absorb this. Under
the default **parallel** vitest run, worker CPU contention inflates wall-clock past
even 25 s → timeout. It is not deck-size compute: the heatmap is a single O(n) pass
into 50 fixed buckets (`page.tsx:99-155`).

## What (user stories)

- **US1**: As a developer, the full `npm run test` run is deterministic — this file
  never fails for load-timing reasons, only for a real regression.
- **US2**: As a developer, the regression intent of the 500 / 550-word cases is
  preserved (dynamic count, late words not sliced off the map).
- **US3**: As a developer, a genuine hang fails fast (seconds), not after a 25 s wait.

## Out of scope

- Product code in `src/app/page.tsx` or `src/core/` — it is correct; do not change it.
- The lighter cases (1-word, 25-word, first-run) beyond timeout tidy-up.
- Broader test-suite parallelism policy.

## Success criteria

- 20 consecutive full `npm run test` runs: `home-grid.test.tsx` passes every time.
- The 500 and 550-word assertions still exercise `page.tsx` bucketing/slicing (the real regression surface).
- Per-assertion timeouts in this file ≤ 5 s (fail-fast).
- No change to the other test files' behavior; suite still green.

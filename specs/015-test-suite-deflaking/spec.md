# Feature 015: test-suite de-flaking (014 follow-up)

**Status**: Implemented | **Branch**: `015-test-suite-deflaking` | **Source**: pre-existing flakiness surfaced by 014's 20-run loop (2026-07-02)

## Problem

The 20-run full-suite loop in 014 surfaced three more false-negative flaky tests,
same class as `home-grid` (timeout under parallel vitest load, not a real defect):

- `src/app/settings/__tests__/page.test.tsx` — "F5" (save→`/practice`); `importStarterDeck` bulk-writes ~500 words to fake-indexeddb, timed out 3/20.
- `src/components/__tests__/AssessmentModal.test.tsx` — both save tests import the starter deck to fake-indexeddb, timed out 1/20.
- `src/components/__tests__/MediaInteractivePlayer.test.tsx` — "submits note to Anki"; the success message only appears after `syncLocalDatabaseWithAnki` (a second fetch + db reads), but the `waitFor` used the default **1000 ms** timeout — 1/20.

## What was done

- **settings + AssessmentModal**: replaced the real `@/core/db` + fake-indexeddb with an in-memory table mock (`vi.hoisted`), same pattern as 014. `importStarterDeck` (real, via mocked `db.words`) becomes instant. Timeouts tightened 8000→5000.
- **MediaInteractivePlayer**: no db mock — the failure was purely the too-tight default `waitFor` timeout on a legitimately async add→sync chain. Gave that one assertion an explicit `{ timeout: 5000 }`. Assertion unchanged.

## Out of scope

- Product code — untouched; all failures were timeout-class test artifacts.
- A 4th file (`src/app/practice/quiz/__tests__/page.test.tsx`) surfaced 1/14 during 015 verification — same class, flagged as a separate follow-up.

## Success criteria (met)

- Each of the three files green in isolation (MediaInteractivePlayer 21/21, settings 10/10, AssessmentModal 3/3).
- 14 consecutive full-suite runs: **0 failures** in any of the three target files (loop capped at 14 by a 10-min wall; targets were previously failing 1–3 per 20).
- Lint clean; no product code changed.

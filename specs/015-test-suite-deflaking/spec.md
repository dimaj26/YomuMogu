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
- A 4th file (`src/app/practice/quiz/__tests__/page.test.tsx`) surfaced 1/14 during 015 verification, fixed same-day below.
- `src/app/__tests__/page.test.tsx` surfaced 2/20 during this addendum's verification loop — a 5th file, same class, **not yet fixed**, flagged as a separate follow-up.

## Addendum (same day): practice/quiz/page.test.tsx

`QuizPage` loads due words via `syncExistingLocalWordsWithStarterDeck` (full
words-table scan + starter_deck.json reconciliation) plus its own
`where().filter()` queries on every mount — same fake-indexeddb cost driver.
Applied the same in-memory `@/core/db` mock (`vi.hoisted`), extended with
`.first()` (used after `.filter()` for ad-hoc mode) and a mocked
`addLocalReview` export (page.tsx imports it alongside `db`). No explicit
`waitFor` timeouts existed in this file — left at vitest's default.

15/15 green in isolation. Verified with **40 full-suite-equivalent runs**
after the fix (20 full-suite + 8 full-suite + 12 more full-suite, plus 15
isolated-file stress runs): **1 failure in 40** (`run 13` of the first batch),
down from ~1/14 before. Re-running the file in isolation and under repeated
full-suite stress 27 more times did not reproduce it, so no exception text
could be captured — per the constitution's fail-fast principle, no blind
change (timeout padding, assertion weakening) was made against an
unreproducible, undiagnosed single failure. Residual ~2.5% rate noted here
rather than silently closed; revisit if it recurs with a reproducible trace.

## Success criteria (met)

- Each of the four files green in isolation (MediaInteractivePlayer 21/21, settings 10/10, AssessmentModal 3/3, quiz 15/15).
- 14 consecutive full-suite runs: **0 failures** in the first three target files (loop capped at 14 by a 10-min wall; targets were previously failing 1–3 per 20).
- quiz: 40 full-suite-equivalent runs post-fix, 1 unreproducible failure (down from ~1/14) — see addendum.
- Lint clean; no product code changed.

# Tasks: Review Session-Size Selector

**Feature**: `010-review-session-size` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Completes 004 C-03 (reorder = 006). Test-First (FR-007). Scope: review (default)
quiz mode + practice review entry only — no other-mode/FSRS/`[N]`-count change.
Anchors in [plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/app/practice/quiz/__tests__/page.test.tsx` and confirm existing quiz cases (incl. the 006 ordering) pass.

## Phase 2: Foundational

_No shared foundational work — two localized edits. (Skip.)_

## Phase 3: User Story 1 — Capped, highest-need review batch (P1) 🎯 MVP

**Goal**: A numeric session size caps the review queue to that many highest-need cards.

**Independent test**: > N due + `limit=N` → exactly N cards, highest-need first.

- [X] T002 [US1] In `src/app/practice/quiz/__tests__/page.test.tsx`, add a case: seed ≥ N+ due cards (distinct, with differing lapses/stability so 006 ordering is determinate); mock `searchParams.get('limit')` → 'N' (and mode 'review'); assert the quiz loads exactly N cards and the first presented card is the highest-need one (cap after sort). Add a sub-check: below-size (fewer due than N) → all due shown.
- [X] T003 [US1] In `src/app/practice/quiz/page.tsx` (review branch, after the 006 `ordered` sort `:368-375`): read `const limit = parseInt(searchParams.get('limit') || '', 10)`; in review mode, if `Number.isFinite(limit) && limit > 0`, set `ordered = ordered.slice(0, limit)` before `setWords(ordered)`. No cap otherwise. Confirm T002 passes.

**Checkpoint**: review queue caps to the chosen size, highest-need first (C-03 cap done).

## Phase 4: User Story 2 — Selector + «Все»/modes unchanged (P2)

**Goal**: Practice offers the size choice; «Все»/no-limit and other modes unchanged.

**Independent test**: «Все»/no limit → full due set; new-mode unchanged.

- [X] T004 [US2] In `src/app/practice/page.tsx` near the review button (`:1297`): add a `reviewLimit` state (default `20`) and a small selector of «20» / «50» / «Все»; the review button navigates `/practice/quiz?mode=review` appending `&limit=${reviewLimit}` when numeric (omit for «Все»). Russian labels. Leave the `[N]` count text and other buttons unchanged.
- [X] T005 [US2] In the quiz test file, add a case: no `limit` param (mode 'review') → the full seeded due set loads (no cap), and confirm existing new-mode / grading / 006-ordering cases still pass.

**Checkpoint**: selector works; «Все» and other modes unchanged.

## Phase 5: Polish & Cross-Cutting

- [X] T006 Run the quiz suite + `npm run test` + ESLint on the changed files; all green (note any load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T007 [P] Append a `CHANGELOG.md` entry for feature 010 (review session-size selector; completes 004 C-03).
- [X] T008 Run `./venv/Scripts/graphify.exe update .` (source symbols changed), then auto-commit (specs, src, tests, CHANGELOG) with a `feat(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003)** (cap test then quiz cap) → **US2 (T004, T005)**
  (selector + no-cap test) → **Polish (T006–T008)**.
- T003 (quiz) and T004 (practice) touch different files; T002/T003/T005 share the quiz
  test file → sequential.

## Parallel opportunities

- T004 (practice selector) is independent of the quiz-cap edits and could be done in
  parallel after T003. T007 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T001–T003)** delivers the cap (the core value); US2 adds the selector
UI + the «Все»/no-cap guard.

## Summary

- Total tasks: **8** (Setup 1, US1 2, US2 2, Polish 3). Test-First: T002 precedes T003.

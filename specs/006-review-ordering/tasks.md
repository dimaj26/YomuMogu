# Tasks: Prioritized Review Ordering

**Feature**: `006-review-ordering` | **Plan**: [plan.md](plan.md) |
**Spec**: [spec.md](spec.md)

Single-branch ordering fix for 004 finding C-03 (reorder only; no cap). Test-First
(FR-006). Scope: review (default) quiz mode only — no scheduling/grading/other-mode
changes (FR-003/FR-004), no session cap (FR-005). Anchors in [plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/app/practice/quiz/__tests__/page.test.tsx` and confirm existing quiz cases pass before changes.

## Phase 2: Foundational

_No shared foundational work — single localized change. (Skip.)_

## Phase 3: User Story 1 — Highest-need card first (P1) 🎯 MVP

**Goal**: Review-mode due queue is ordered weakest/most-overdue first, deterministically.

**Independent test**: With due cards of differing lapses/stability/due, the highest-need card is shown first.

- [X] T002 [US1] In `src/app/practice/quiz/__tests__/page.test.tsx`, add a case: seed ≥3 due cards (distinct translations, status not 'new', due in the past) — e.g. A: lapses 5; B: lapses 0, stability 1; C: lapses 0, stability 9 — in default (review) mode; assert the prompt for A (most lapses) is shown first and B/C are not yet shown. Add a second sub-check that with equal lapses the lower-stability card precedes the higher-stability one.
- [X] T003 [US1] In `src/app/practice/quiz/page.tsx` (~`:355`/`:364`), replace the review-mode random shuffle (`[...loadedWords].sort(() => Math.random() - 0.5)`) with a deterministic comparator for review mode: `lapses` desc → `stability` asc → `due` asc. Leave `new` and unused-target modes' ordering unchanged. Confirm T002 passes.

**Checkpoint**: review order is deterministic highest-need-first (C-03 reorder done).

## Phase 4: User Story 2 — Other modes & scheduling unchanged (P2)

**Goal**: No regression to new-word/unused-target modes or FSRS grading.

**Independent test**: existing quiz tests (empty state, correct-answer grading, new-mode, shortcuts) stay green.

- [X] T004 [US2] Run the full quiz suite `npx vitest run src/app/practice/quiz/__tests__/page.test.tsx` and confirm all prior cases still pass (new-mode selection, grading/scheduling, keyboard shortcuts unchanged).

**Checkpoint**: surgical change verified — no regression.

## Phase 5: Polish & Cross-Cutting

- [X] T005 Run the quiz suite + `npm run test` + ESLint on the changed files; all green (note any pre-existing load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T006 [P] Append a `CHANGELOG.md` entry for feature 006 (prioritized review ordering; partial 004 C-03; cap deferred).
- [X] T007 Run `./venv/Scripts/graphify.exe update .` (source symbols changed), then auto-commit (specs, src, test, CHANGELOG) with a `fix(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003)** (test first, then the comparator) →
  **US2 (T004)** regression check → **Polish (T005–T007)**.

## Parallel opportunities

- T006 (CHANGELOG) is `[P]` vs other polish. Core change is one file, sequential.

## MVP scope

**User Story 1 (T001–T003)** is the whole fix. US2 is the regression guard.

## Summary

- Total tasks: **7** (Setup 1, US1 2, US2 1, Polish 3).
- Test-First: T002 precedes T003.

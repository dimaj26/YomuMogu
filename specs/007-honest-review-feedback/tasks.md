# Tasks: Honest Review Feedback on Day One

**Feature**: `007-honest-review-feedback` | **Plan**: [plan.md](plan.md) |
**Spec**: [spec.md](spec.md)

Single-message conditional fix for 004 finding C-09. Test-First (FR-006). Scope: the
active-review no-due message on `/practice` only (FR-005). Anchors in [plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/app/practice/__tests__/page.test.tsx` and confirm existing practice cases pass before changes.

## Phase 2: Foundational

_No shared foundational work — single localized change. (Skip.)_

## Phase 3: User Story 1 — No false praise on day one (P1) 🎯 MVP

**Goal**: A fresh all-new deck no longer sees the congratulations; it sees a neutral "not started" message.

**Independent test**: all-new deck → neutral message present, congratulations absent.

- [X] T002 [US1] In `src/app/practice/__tests__/page.test.tsx`, add a case: seed local words all status 'new' (deck initialized, none due, none review/learning); render practice; assert the active-review card shows the neutral "повторений пока нет / начните с разминки" message and does NOT show «Все активные слова повторены! Отличная работа.».
- [X] T003 [US1] In `src/app/practice/page.tsx` (~`:1283-1290`), derive `const hasActiveWords = words.some(w => w.status === 'review' || w.status === 'learning')` and change the no-due branch: `dueActiveWordsCount > 0` → existing count; else `hasActiveWords` → existing congratulations; else → new neutral Russian message via `t()` pointing to the warm-up/quiz. Confirm T002 passes.

**Checkpoint**: day-one false praise removed (C-09 fixed).

## Phase 4: User Story 2 — Genuine praise & count preserved (P1)

**Goal**: Praise still appears when active-but-not-due; count message when due.

**Independent test**: ≥1 review/learning none-due → praise; ≥1 due → count.

- [X] T004 [US2] In the same test file, add: (a) seed ≥1 word status 'review'/'learning' with due in the FUTURE (none due now) → assert congratulations «Все активные слова повторены! Отличная работа.» appears; (b) seed ≥1 word status 'review' due in the PAST → assert the "готовых к повторению" count message appears. Confirm both pass with the T003 change.

**Checkpoint**: no loss of legitimate praise / count behavior.

## Phase 5: Polish & Cross-Cutting

- [X] T005 Run `npx vitest run src/app/practice/__tests__/page.test.tsx` + `npm run test` + ESLint on the changed files; all green (note any pre-existing load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T006 [P] Append a `CHANGELOG.md` entry for feature 007 (honest review feedback; fixes 004 C-09).
- [X] T007 Run `./venv/Scripts/graphify.exe update .` (source symbols changed), then auto-commit (specs, src, test, CHANGELOG) with a `fix(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003)** (test first, then the conditional) →
  **US2 (T004)** verify praise/count → **Polish (T005–T007)**.
- T002/T003/T004 touch the same two files → sequential.

## Parallel opportunities

- T006 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T001–T003)** removes the false praise. US2 guards the preserved states.

## Summary

- Total tasks: **7** (Setup 1, US1 2, US2 1, Polish 3).
- Test-First: T002 precedes T003.

# Tasks: Beginner Express-Start in the Diagnostic

**Feature**: `009-beginner-express-start` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Additive express button for 004 finding C-11. Test-First (FR-006). Scope:
AssessmentModal only — additive; no FSRS/schema/other-screen change. Anchors in [plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/components/__tests__/AssessmentModal.test.tsx` and confirm existing cases pass.

## Phase 2: Foundational

_No shared foundational work — single localized change. (Skip.)_

## Phase 3: User Story 1 — One-click start from zero (P1) 🎯 MVP

**Goal**: An explicit «Я начинаю с нуля» button seeds the deck all-new and proceeds.

**Independent test**: click express → deck seeded all-new + onSaved called.

- [X] T002 [US1] In `src/components/__tests__/AssessmentModal.test.tsx`, add a case: render `<AssessmentModal isOpen profileId="default" onClose onSaved/>`; wait for the deck to load (express button enabled); click «Я начинаю с нуля»; assert `onSaved` is called and `db.words` for `default` with `category === LOCAL_DECK_NAME` has count > 0 and every such word has `active.status === 'new'`.
- [X] T003 [US1] In `src/components/AssessmentModal.tsx`: add `handleStartFresh` (mirrors `handleSave` at `:127-137` but calls `importStarterDeck(profileId, new Set())`), and add a footer button «Я начинаю с нуля» near «Сохранить и начать» (`:256-273`) wired to it, `disabled={starterDeckData.length === 0 || isSaving}`. Leave handleSave / «Отмена» / «Закрыть» unchanged. Confirm T002 passes.

**Checkpoint**: beginner has an explicit one-click start (C-11 fixed).

## Phase 4: User Story 2 — Existing controls unchanged (P2)

**Goal**: Save-with-checks, cancel, close behave as before.

**Independent test**: existing AssessmentModal tests stay green.

- [X] T004 [US2] Run `npx vitest run src/components/__tests__/AssessmentModal.test.tsx` and confirm the prior cases (isOpen=false; «Сохранить и начать» import) still pass.

**Checkpoint**: additive — no regression.

## Phase 5: Polish & Cross-Cutting

- [X] T005 Run the modal suite + `npm run test` + ESLint on the changed files; all green (note any load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T006 [P] Append a `CHANGELOG.md` entry for feature 009 (beginner express-start; fixes 004 C-11).
- [X] T007 Run `./venv/Scripts/graphify.exe update .`, then auto-commit (specs, src, test, CHANGELOG) with a `feat(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003)** → **US2 (T004)** → **Polish (T005–T007)**.

## Parallel opportunities

- T006 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T001–T003)** is the whole fix; US2 is the regression guard.

## Summary

- Total tasks: **7** (Setup 1, US1 2, US2 1, Polish 3). Test-First: T002 precedes T003.

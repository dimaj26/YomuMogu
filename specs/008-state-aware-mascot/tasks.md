# Tasks: State-Aware Mascot Greeting

**Feature**: `008-state-aware-mascot` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Single render-helper copy fix for 004 finding C-10. Test-First (FR-006). Scope: the
level-0 mascot greeting only — no nav entry, no CTA/FSRS/other-screen change
(FR-005). Anchors in [plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/app/__tests__/home-grid.test.tsx` and confirm existing Home cases pass.

## Phase 2: Foundational

_No shared foundational work — single localized change. (Skip.)_

## Phase 3: User Story 1 — Mascot mirrors the dashboard state (P1) 🎯 MVP

**Goal**: The level-0 mascot greeting matches the current dashState; no nonexistent-nav reference.

**Independent test**: first-run render → bubble points to the diagnostic, not «раздел практики».

- [X] T002 [US1] In `src/app/__tests__/home-grid.test.tsx`, add a first-run case: render Home with no deck (uninitialized); assert the mascot bubble text references the diagnostic (e.g. /диагностик/i) and does NOT contain «раздел практики».
- [X] T003 [US1] In `src/app/page.tsx`: change `getMascotBubbleHtml` signature to accept `state: DashState` (`:238`), update the call site `:354` to `getMascotBubbleHtml(dashState)`, and rewrite the level-0 branch (`:256-258`) to switch on `state` — first-run → diagnostic, newbie → warm-up, returning → reviews/continue, all-done → neutral done, default/anki → safe generic; remove «раздел практики». Keep the `customBubbleText` return, the resume-session branch, and the Japanese greetings (level 1/2/default) unchanged. Confirm T002 passes.

**Checkpoint**: mascot no longer misdirects (C-10 fixed).

## Phase 4: User Story 2 — Existing greetings preserved (P2)

**Goal**: Resume bubble + japanified greetings unchanged.

**Independent test**: existing Home tests stay green.

- [X] T004 [US2] Run `npx vitest run src/app/__tests__/home-grid.test.tsx` and confirm all prior cases still pass (no regression to the seeded/uninitialized description tests or other Home assertions).

**Checkpoint**: no regression.

## Phase 5: Polish & Cross-Cutting

- [X] T005 Run the Home suite + `npm run test` + ESLint on the changed files; all green (note any load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T006 [P] Append a `CHANGELOG.md` entry for feature 008 (state-aware mascot greeting; fixes 004 C-10).
- [X] T007 Run `./venv/Scripts/graphify.exe update .`, then auto-commit (specs, src, test, CHANGELOG) with a `fix(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003)** → **US2 (T004)** → **Polish (T005–T007)**.

## Parallel opportunities

- T006 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T001–T003)** is the whole fix; US2 is the regression guard.

## Summary

- Total tasks: **7** (Setup 1, US1 2, US2 1, Polish 3). Test-First: T002 precedes T003.

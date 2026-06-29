# Tasks: First-Run "How It Works"

**Feature**: `011-first-run-how-it-works` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Static informational block for 004 finding C-14. Test-First (FR-005). Scope: the
first-run home branch only — additive; no nav/logic/FSRS/other-screen change.
Anchors in [plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/app/__tests__/home-grid.test.tsx` and confirm existing Home cases pass.

## Phase 2: Foundational

_No shared foundational work — single localized change. (Skip.)_

## Phase 3: User Story 1 — Newcomer sees the 3-step overview (P1) 🎯 MVP

**Goal**: First-run shows a compact «Как это работает» 3-step overview before the diagnostic CTA.

**Independent test**: fresh first-run render → the 3-step overview is present.

- [X] T002 [US1] In `src/app/__tests__/home-grid.test.tsx`, add a first-run case: render Home with no deck; assert the «Как это работает» heading and the three step phrases (диагностик… / повторени… / диалог…) are present.
- [X] T003 [US1] In `src/app/page.tsx` first-run fragment (after the intro `<p>` `:418`, before `</>` `:419`): add a compact «Как это работает» heading + 3 numbered steps via `t()` — (1) короткая диагностика → подберём ваши слова; (2) разминка и интервальные повторения (FSRS); (3) практика слов в живом диалоге с ИИ-тьютором. Static markup, no handlers. Confirm T002 passes.

**Checkpoint**: newcomer sees the journey preview (C-14 fixed).

## Phase 4: User Story 2 — Absent outside first-run (P2)

**Goal**: The overview shows only on first run.

**Independent test**: initialized deck → overview absent.

- [X] T004 [US2] In the same test file, add a case: seed a starter word (deck initialized → non-first-run); render Home; assert the «Как это работает» heading is NOT present.

**Checkpoint**: first-run-only confirmed.

## Phase 5: Polish & Cross-Cutting

- [X] T005 Run the Home suite + `npm run test` + ESLint on the changed files; all green (note any load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T006 [P] Append a `CHANGELOG.md` entry for feature 011 (first-run "how it works"; fixes 004 C-14).
- [X] T007 Run `./venv/Scripts/graphify.exe update .`, then auto-commit (specs, src, test, CHANGELOG) with a `feat(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003)** → **US2 (T004)** → **Polish (T005–T007)**.

## Parallel opportunities

- T006 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T001–T003)** delivers the overview; US2 guards first-run-only.

## Summary

- Total tasks: **7** (Setup 1, US1 2, US2 1, Polish 3). Test-First: T002 precedes T003.

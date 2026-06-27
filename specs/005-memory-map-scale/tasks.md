# Tasks: Memory Map Scales to the Real Deck

**Feature**: `005-memory-map-scale` | **Plan**: [plan.md](plan.md) |
**Spec**: [spec.md](spec.md)

Single-component UI fix for 004 finding C-02. Test-First (FR-006). Scope: the home
heatmap only — no FSRS/visual/other-screen changes (FR-005). Anchors in
[plan.md](plan.md) "Concrete change targets".

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/app/__tests__/home-grid.test.tsx` and confirm the existing feature-003 cases pass before changes.

## Phase 2: Foundational

_No shared foundational work — single localized change. (Skip.)_

## Phase 3: User Story 1 — Whole deck represented + real count (P1) 🎯 MVP

**Goal**: The home heatmap buckets the entire deck across its 50 cells and the caption shows the real total.

**Independent test**: With a deck >500 words, all words are represented and the caption shows N (not 500); 500 unchanged.

- [X] T002 [US1] In `src/app/__tests__/home-grid.test.tsx`: update the seeded assertion (currently expects literal "состояние 500 слов") to the dynamic count, and add cases — (a) >500 words: caption shows the real N and the rendered grid accounts for all words (assert via caption count and that a word beyond index 500 influences a cell / no drop); (b) exactly 500: caption shows 500 (regression); (c) <500 initialized: caption shows the real smaller N. Keep the existing uninitialized case.
- [X] T003 [US1] In `src/app/page.tsx` heatmap `useEffect` (~`:98-100`): replace the fixed 10-word window with `const bucket = Math.max(1, Math.ceil(words.length / 50))` and `words.slice(cellIndex*bucket, (cellIndex+1)*bucket)`; leave per-cell status/isDue/avgStability aggregation unchanged. Confirm T002 binning cases pass.
- [X] T004 [US1] In `src/app/page.tsx` `MemoryDecayHeatmap` (~`:725-742`): accept a real total-count prop (computed in the parent from the same word read that builds `cells`) and render the initialized caption with that count instead of literal `500` («50 ячеек отображают состояние {N} слов вашей стартовой колоды. …»); keep the feature-003 uninitialized caption branch unchanged. Confirm T002 caption cases pass.

**Checkpoint**: heatmap + caption scale to the real deck (C-02 fixed).

## Phase 4: User Story 2 — Smaller / uninitialized decks read correctly (P2)

**Goal**: Honest caption for small and uninitialized decks; feature-003 text preserved.

**Independent test**: uninitialized → feature-003 caption; small initialized → real N.

- [X] T005 [US2] Verify (covered by T002 cases c + uninitialized) that `Math.max(1, …)` handles <500 and 0 words without divide/empty-cell issues and the uninitialized caption is unchanged; adjust if any case fails.

**Checkpoint**: counts honest in both directions; no feature-003 regression.

## Phase 5: Polish & Cross-Cutting

- [X] T006 Run `npx vitest run src/app/__tests__/home-grid.test.tsx` then `npm run test` and ESLint; all green. Validate against [quickstart.md](quickstart.md).
- [X] T007 [P] Append a `CHANGELOG.md` entry for feature 005 (memory map scales to the real deck; fixes 004 C-02).
- [X] T008 Run `./venv/Scripts/graphify.exe update .` (source symbols changed), then auto-commit (specs, src, test, CHANGELOG) with a `fix(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002→T003→T004)** (test first, then the two source edits) →
  **US2 (T005)** verification → **Polish (T006–T008)**.
- T003 and T004 touch the same file (`page.tsx`) → sequential.

## Parallel opportunities

- T007 (CHANGELOG) is `[P]` vs other polish. The core edits are sequential (one file).

## MVP scope

**User Story 1 (T001–T004)** is the whole fix. US2 is a verification guard.

## Summary

- Total tasks: **8** (Setup 1, US1 3, US2 1, Polish 3).
- Test-First: T002 precedes T003/T004.

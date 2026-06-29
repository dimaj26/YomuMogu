# Tasks: Competency Level Reflects Real Per-Level Coverage

**Feature**: `012-competency-per-level` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Fixes 004 C-07 + C-08. Test-First (FR-007). Decision-light: reuses the existing
completion rule/constants; no FSRS/chat/grammar-content/threshold change. Anchors in
[plan.md](plan.md).

## Phase 1: Setup

- [X] T001 Baseline: run `npx vitest run src/lib/competency/__tests__/profile.test.ts` and confirm existing competency tests pass.

## Phase 2: Foundational

_No shared foundational work beyond the helpers (in US1). (Skip.)_

## Phase 3: User Story 1 — Real active level across all levels (P1) 🎯 MVP

**Goal**: Compute per-level coverage and derive the real active level by the existing rule.

**Independent test**: N5+N4 complete → active N3; per-level coverage for all 5 levels.

- [X] T002 [US1] In `src/lib/competency/__tests__/profile.test.ts`, add cases: (a) `computeAllLevelCoverages(words, progressMap)` returns an entry for each of N5–N1 with the expected lex/grammar (seed `jlpt:nX`-tagged review/mature words + `grammar_progress` mature rules); (b) `deriveActiveLevel(coverages)` returns the first level not completed by `lex ≥ 0.8 && grammar ≥ 1.0` — seed N5 & N4 complete → expect 'N3'.
- [X] T003 [US1] In `src/lib/competency/profile.ts`, add `export function computeAllLevelCoverages(words, progressMap)` (loop `['N5','N4','N3','N2','N1']`, reuse `computeLexCoverage`/`computeGrammarCoverage`) and `export function deriveActiveLevel(coverages)` (import `LADDER_COMPLETE_LEX_COVERAGE`/`LADDER_COMPLETE_GRAMMAR_COVERAGE` from `@/core/intervals`; complete iff `lex ≥ LEX && grammar ≥ GRAMMAR`; return first non-complete in order; all complete → 'N1'; none/empty → 'N5'). Leave `buildCompetencyProfile` unchanged. Confirm T002 passes.
- [X] T004 [US1] In `src/app/practice/page.tsx` (~`:398-406`), build `coverages` from `computeAllLevelCoverages(allProfileWords, progressMap)` and `activeLevelId` from `deriveActiveLevel(coverages)` for `setMacroLadderProfile`, replacing the single-`computedProfile.level` map. Keep the `buildCompetencyProfile` call if still needed for advice/correction-rate.

**Checkpoint**: balance widget + learning track show the real working level (C-07/C-08 fixed).

## Phase 4: User Story 2 — Beginner/regression unchanged (P1)

**Goal**: N5-only / empty learner still shows N5; existing competency outputs intact.

**Independent test**: N5-only / empty → active 'N5'; existing tests green.

- [X] T005 [US2] In `profile.test.ts`, add: `deriveActiveLevel` with only-N5 coverage (or empty) → 'N5'; and confirm the existing `buildCompetencyProfile`/`getPresetAdvice` tests still pass (unchanged).

**Checkpoint**: no regression to N5 / existing engine outputs.

## Phase 5: Polish & Cross-Cutting

- [X] T006 Run `npx vitest run src/lib/competency/__tests__/profile.test.ts` + the practice suite + `npm run test` + ESLint on the changed files; all green (note any load-flaky suites that pass in isolation). Validate against [quickstart.md](quickstart.md).
- [X] T007 [P] Append a `CHANGELOG.md` entry for feature 012 (competency level reflects real per-level coverage; fixes 004 C-07/C-08; N3–N1 grammar authoring still deferred).
- [X] T008 Run `./venv/Scripts/graphify.exe update .` (source symbols changed), then auto-commit (specs, src, test, CHANGELOG) with a `fix(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → **US1 (T002 → T003 → T004)** (test → helpers → wiring) →
  **US2 (T005)** regression → **Polish (T006–T008)**.
- T003 (helpers) blocks T004 (wiring) and T002/T005 (tests of the helpers).

## Parallel opportunities

- T007 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T001–T004)** delivers the fix; US2 guards the N5/regression path.

## Summary

- Total tasks: **8** (Setup 1, US1 3, US2 1, Polish 3). Test-First: T002 precedes T003.

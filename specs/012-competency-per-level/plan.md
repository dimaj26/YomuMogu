# Implementation Plan: Competency Level Reflects Real Per-Level Coverage

**Branch**: `012-competency-per-level` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-competency-per-level/spec.md`

## Summary

Fix 004 C-07 + C-08. Add two pure helpers to `src/lib/competency/profile.ts`:
`computeAllLevelCoverages(words, progressMap)` (lex + grammar coverage for all five
JLPT levels, reusing the existing per-level `computeLexCoverage`/`computeGrammarCoverage`)
and `deriveActiveLevel(coverages)` (first level not completed by the EXISTING rule —
`lex ≥ LADDER_COMPLETE_LEX_COVERAGE` 0.8 AND `grammar ≥ LADDER_COMPLETE_GRAMMAR_COVERAGE`
1.0, the same constants `LearningTrack.isLevelCompleted` uses). Wire both into
`src/app/practice/page.tsx` (replace the N5-only `macroLadderProfile` build, lines
398-406). `buildCompetencyProfile` keeps its current shape/tests. No new thresholds,
no FSRS/chat/grammar-content change. Ships with Test-First helper tests.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16. Docs Markdown.
**Primary Dependencies**: Existing app — `computeLexCoverage`, `computeGrammarCoverage`,
the `LADDER_COMPLETE_*` constants (`core/intervals.ts`), the `MacroLadderProfile` /
`LevelCoverage` types (`components/LearningTrack.tsx`). No new packages/data/schema.
**Storage**: No change.
**Testing**: Vitest. Extend `src/lib/competency/__tests__/profile.test.ts` (pure-unit):
all-level coverage; active level = first non-completed (N5+N4 complete → N3); N5-only → N5.
**Target Platform**: Web app; Windows/PowerShell.
**Project Type**: Web application — competency-engine helpers + practice wiring.
**Constraints**: reuse existing completion rule/constants (no new thresholds, FR-002/006);
no FSRS/chat-grammar-scoping/grammar-content change (FR-006); `buildCompetencyProfile`
unchanged (FR-005); strings unchanged (FR-008).
**Scale/Scope**: 1 lib file + 1 practice file + 1 test file.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| `computeAllLevelCoverages` | `src/lib/competency/profile.ts` (new export) | for each of `['N5','N4','N3','N2','N1']` return `{ lexCoverage: computeLexCoverage(words, lvl), grammarCoverage: computeGrammarCoverage(progressMap, lvl) }`. |
| `deriveActiveLevel` | `src/lib/competency/profile.ts` (new export) | import `LADDER_COMPLETE_LEX_COVERAGE`, `LADDER_COMPLETE_GRAMMAR_COVERAGE` from `core/intervals`; a level is complete iff `lex ≥ LEX && grammar ≥ GRAMMAR`; return the first non-complete level in N5→N1 order; if all complete, return `'N1'`; if none/empty, `'N5'`. |
| Practice wiring | `src/app/practice/page.tsx:398-406` | build `coverages` from `computeAllLevelCoverages(allProfileWords, progressMap)` and `activeLevelId` from `deriveActiveLevel(coverages)` (replacing the single-`computedProfile.level` map). Keep `buildCompetencyProfile` call if still used for `recentCorrectionRate`/advice; otherwise compute coverages directly. |
| Unchanged | `buildCompetencyProfile`, `getPresetAdvice`, FSRS, chat grammar scoping, thresholds | untouched. |
| Test | `src/lib/competency/__tests__/profile.test.ts` | add cases for the two new helpers (see Testing). |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | `specs/012-competency-per-level/`. |
| II. Test-First | ✅ | Pure-unit tests for the new helpers (FR-007). |
| III. Fail-Fast | ✅ | Pure functions over existing data; safe defaults (empty → N5). |
| IV. Layered Boundaries | ✅ | Pure helpers in `lib/competency`; practice reads them as today. No facade change. |
| V. No Placeholders | ✅ | Real per-level computation; the N3–N1 grammar gap is surfaced honestly, not stubbed. |
| Stack & Language | ✅ | No UI strings change; docs English. |
| Doc-drift gate | ✅ planned | CHANGELOG entry in the commit; supersede the C-07/C-08 brief's "needs decision". |

**Result**: PASS — no violations.

## Project Structure

```text
specs/012-competency-per-level/{plan,research,data-model,quickstart}.md + checklists/
src/lib/competency/profile.ts                       # EDIT — computeAllLevelCoverages + deriveActiveLevel
src/app/practice/page.tsx                           # EDIT — wire all-level coverages + derived active level
src/lib/competency/__tests__/profile.test.ts        # EDIT — helper tests
CHANGELOG.md                                         # EDIT — changelog entry
```

**Structure Decision**: Two pure helpers in the existing competency lib + a localized
practice-page wiring change; co-located unit tests extended. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed.

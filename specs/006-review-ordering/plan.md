# Implementation Plan: Prioritized Review Ordering

**Branch**: `006-review-ordering` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-review-ordering/spec.md`

## Summary

Partial fix for 004 C-03. In `src/app/practice/quiz/page.tsx`, the review (default)
mode loads all due words then orders them with a **random shuffle**
(`[...loadedWords].sort(() => Math.random() - 0.5)`, ~line 364). Replace that
shuffle — **for review mode only** — with a deterministic "highest-need first" sort:
more lapses first, then lower stability first, then earlier `due` first. The `new`
and unused-target modes keep their existing ordering; scheduling/grading and the
practice screen are untouched; no session cap is added.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16 (client component). Docs Markdown.

**Primary Dependencies**: Existing app only; reads existing `LocalWord.active`
fields (`lapses`, `stability`, `due`). No new packages, no schema change.

**Storage**: No change. Same `db.words` read as today.

**Testing**: Vitest + @testing-library/react. Extend
`src/app/practice/quiz/__tests__/page.test.tsx` with a review-ordering case
(seed due cards of differing lapses/stability/due; assert the highest-need card is
shown first). Existing quiz tests must stay green.

**Target Platform**: Web app; Windows/PowerShell dev.

**Project Type**: Web application — single-component ordering fix.

**Constraints**: Review (default) mode only (FR-003); no scheduling/grading change
(FR-004); no session cap (FR-005); deterministic ordering (FR-002). Docs English.

**Scale/Scope**: 1 source file (`src/app/practice/quiz/page.tsx`) + 1 test file.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| Review ordering | `src/app/practice/quiz/page.tsx` ~`:355` (review `else` branch sets `loadedWords`) and ~`:364` (`const shuffled = [...loadedWords].sort(() => Math.random() - 0.5)`) | For review mode, sort `loadedWords` deterministically by `(b.active.lapses - a.active.lapses)` then `(a.active.stability - b.active.stability)` then `(a.active.due - b.active.due)` instead of the random shuffle; keep existing behavior for the other modes. |
| Scope guard | same file | Only the review branch's ordering changes; `new` / unused-target branches keep current behavior. |
| Test | `src/app/practice/quiz/__tests__/page.test.tsx` | add a case: seed ≥3 due cards (distinct translations) with differing lapses/stability/due; default (review) mode; assert the highest-need card's prompt is shown first and a lower-need card is not yet shown. |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement; `specs/006-review-ordering/`. |
| II. Test-First | ✅ | New ordering covered by an added quiz test asserting highest-need-first (FR-006). |
| III. Fail-Fast | ✅ | Pure comparator over existing fields; empty/single-card sets handled by existing empty-state/no-op. |
| IV. Layered Boundaries | ✅ | Reads `db.words` as today; comparator is pure; no facade crossed. |
| V. No Placeholders | ✅ | Real deterministic comparator; no stubs. |
| Stack & Language | ✅ | No UI strings change; docs English. |
| Doc-drift gate | ✅ planned | `CHANGELOG.md` entry ships in the implementing commit; no schema/API doc affected. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/006-review-ordering/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/app/practice/quiz/page.tsx                       # EDIT — review-mode deterministic ordering
src/app/practice/quiz/__tests__/page.test.tsx        # EDIT — add highest-need-first test
CHANGELOG.md                                          # EDIT — changelog entry
```

**Structure Decision**: Localized single-branch change in the quiz loader; its
co-located test suite is extended. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

# Implementation Plan: Review Session-Size Selector

**Branch**: `010-review-session-size` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-review-session-size/spec.md`

## Summary

Complete 004 C-03. Add a session-size selector (20 / 50 / Все, default 20) on
`/practice` next to the review button; pass the choice to the review quiz as a
`limit` query param; the quiz caps the due queue to that many cards **after** the
006 weakest-first ordering. «Все» = no cap. Review-mode + practice review entry
only; other modes / FSRS / the practice `[N]` count unchanged. Ships with tests.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16 (client). Docs Markdown.
**Primary Dependencies**: Existing app; `useSearchParams` (already used in the quiz).
No new packages/data/schema.
**Storage**: No change (size passed per-session via URL, not persisted).
**Testing**: Vitest + RTL. Quiz suite: a `limit` caps the review queue to N
highest-need cards; no/`Все` limit loads the full due set. Practice suite (optional):
the selector renders and navigates with the chosen limit.
**Target Platform**: Web app; Windows/PowerShell.
**Project Type**: Web application — review entry + quiz cap.
**Constraints**: review/default mode only (FR-005); cap after 006 sort (FR-003); no
silent cap → keep `[N]` truthful (FR-006); Russian strings, English docs (FR-008).
**Scale/Scope**: 2 source files (`practice/page.tsx`, `practice/quiz/page.tsx`) + tests.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| Size selector | `src/app/practice/page.tsx` near review button (`:1297`) | add `reviewLimit` state (default `20`), 3 small buttons «20» / «50» / «Все»; the review button navigates `/practice/quiz?mode=review` + `&limit=${reviewLimit}` (omit when «Все»). |
| Cap in quiz | `src/app/practice/quiz/page.tsx` review branch, after the 006 ordering (`ordered`, `:368-375`) | read `const limitParam = searchParams.get('limit')`; in review mode, if a positive integer limit is present, `ordered = ordered.slice(0, limit)` before `setWords`. No cap when absent/«Все». |
| Unchanged | quiz `new`/unused-target branches; FSRS grading; practice `[N]` count text | untouched. |
| Tests | `src/app/practice/quiz/__tests__/page.test.tsx` (+ optionally `practice/__tests__/page.test.tsx`) | seed > N due; `limit=N` mock → exactly N cards, highest-need first; no-limit → full set. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | `specs/010-review-session-size/`. |
| II. Test-First | ✅ | Cap + no-cap cases added (FR-007). |
| III. Fail-Fast | ✅ | Below-size → all due (slice is safe); invalid/absent limit → no cap. |
| IV. Layered Boundaries | ✅ | Reads `db.words` + URL param as today; pure slice; no facade change. |
| V. No Placeholders | ✅ | Real selector + real cap. |
| Stack & Language | ✅ | Russian labels; docs English. |
| Doc-drift gate | ✅ planned | CHANGELOG entry in the commit; no schema/API doc affected. |

**Result**: PASS — no violations.

## Project Structure

```text
specs/010-review-session-size/{plan,research,data-model,quickstart}.md + checklists/
src/app/practice/page.tsx                          # EDIT — size selector + limit in nav
src/app/practice/quiz/page.tsx                     # EDIT — cap review queue by limit (after 006 sort)
src/app/practice/quiz/__tests__/page.test.tsx      # EDIT — cap / no-cap tests
CHANGELOG.md                                        # EDIT — changelog entry
```

**Structure Decision**: Two localized edits (practice review entry + quiz cap) with
co-located quiz tests. No new modules/state beyond a small `reviewLimit` UI state.

## Complexity Tracking

> Not applicable — Constitution Check passed.

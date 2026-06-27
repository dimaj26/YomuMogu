# Implementation Plan: Memory Map Scales to the Real Deck

**Branch**: `005-memory-map-scale` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-memory-map-scale/spec.md`

## Summary

Fix 004 finding C-02. In `src/app/page.tsx`, the `MemoryDecayHeatmap` data builder
bins words with a fixed window of 10 (`words.slice(cellIndex*10, +10)`), so only the
first 500 of a larger deck are shown; the caption hardcodes "500 слов". Change the
binning to a **dynamic bucket** (`Math.max(1, Math.ceil(total/50))`) so all 50 cells
collectively cover the whole deck, and make the caption show the **actual** word
count. Keep the 50-cell visual, FSRS, the per-cell aggregation, and the feature-003
uninitialized caption unchanged. Ship with updated/added tests.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16 (client component). Docs Markdown.

**Primary Dependencies**: Existing app only; no new packages. Uses the existing
`db.words` read and the existing `isLocalInit` flag.

**Storage**: No schema change. Reads the active profile's words (as today).

**Testing**: Vitest + @testing-library/react. Existing suite
`src/app/__tests__/home-grid.test.tsx` (from feature 003) is extended; its seeded
caption assertion is updated to the dynamic count, and large/exactly-500/small cases
are added.

**Target Platform**: Web app; Windows/PowerShell dev.

**Project Type**: Web application — single-component UI fix.

**Constraints**: Home heatmap only; do not change the 50-cell visual, FSRS, or other
screens (FR-005). Russian UI strings; English docs (FR-007). Preserve feature-003
uninitialized caption (FR-004).

**Scale/Scope**: 1 source file (`src/app/page.tsx`) + 1 test file. C-03/C-07/C-08
explicitly deferred.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| Binning | `src/app/page.tsx` heatmap `useEffect` (~`:98-100`) | replace fixed `cellIndex*10 / slice(+10)` with `bucket = Math.max(1, Math.ceil(words.length/50))` and `slice(cellIndex*bucket, (cellIndex+1)*bucket)`; per-cell aggregation (status/stability/due) unchanged. |
| Caption count | `src/app/page.tsx` `MemoryDecayHeatmap` description (~`:738`) | initialized branch: show the real total instead of literal `500`, e.g. «50 ячеек отображают состояние {N} слов вашей стартовой колоды. …». Uninitialized branch (feature-003): unchanged. |
| Count source | `MemoryDecayHeatmap` props | pass the real total into the component (it currently receives only `cells`), or derive from the same word set the cells are built from, so caption and grid agree. |
| Test | `src/app/__tests__/home-grid.test.tsx` | update the seeded regex from the literal "500" to the dynamic count; add cases for >500 (all covered, caption N), exactly 500 (regression), <500 (caption N), uninitialized (feature-003 text). |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement; `specs/005-memory-map-scale/`. |
| II. Test-First | ✅ | New behavior covered by updated/added cases in the co-located home-grid suite (FR-006). |
| III. Fail-Fast | ✅ | `Math.max(1, …)` avoids divide/zero-bucket; uninitialized handled by existing branch. |
| IV. Layered Boundaries | ✅ | Reads `db.words` exactly as today (same call); no new DB access pattern, no facade crossed. |
| V. No Placeholders | ✅ | Real dynamic binning + real count; no stubs. |
| Stack & Language | ✅ | Russian caption via existing `t()`; docs English. |
| Doc-drift gate | ✅ planned | `CHANGELOG.md` entry ships in the implementing commit; no schema/API doc affected. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/005-memory-map-scale/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/app/page.tsx                       # EDIT — dynamic bucket binning + dynamic caption count
src/app/__tests__/home-grid.test.tsx   # EDIT — update seeded assertion + add scale cases
CHANGELOG.md                           # EDIT — changelog entry
```

**Structure Decision**: Localized single-component fix in the existing App Router
home page; its co-located test suite is extended. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

# Implementation Plan: First-Run "How It Works"

**Branch**: `011-first-run-how-it-works` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-first-run-how-it-works/spec.md`

## Summary

Fix 004 C-14. In `src/app/page.tsx` the first-run branch (`dashState === 'first-run'`,
~`:407-419`) renders only an H1 + intro before the diagnostic CTA. Insert a compact
static «Как это работает» 3-step block inside that first-run fragment, between the
intro paragraph (`:418`) and the closing `</>` (`:419`), so it sits above the CTA.
Shown only in first-run (the branch already gates it); absent in all other states.
No logic/nav/FSRS change. Ships with a test.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16 (client). Docs Markdown.
**Primary Dependencies**: Existing app; the existing first-run branch + `t()` helper.
No new packages/data/schema.
**Storage**: No change.
**Testing**: Vitest + RTL. Extend `src/app/__tests__/home-grid.test.tsx`: first-run →
the 3-step «Как это работает» renders; initialized deck → absent.
**Target Platform**: Web app; Windows/PowerShell.
**Project Type**: Web application — static informational block.
**Constraints**: first-run only (FR-003); static/additive — no nav/logic/FSRS/other-
screen change (FR-004); Russian strings, English docs (FR-006).
**Scale/Scope**: 1 source file + 1 test file.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| 3-step block | `src/app/page.tsx` first-run fragment, after the intro `<p>` (`:418`), before `</>` (`:419`) | add a compact «Как это работает» heading + 3 numbered steps via `t()`: (1) короткая диагностика → подберём слова; (2) разминка + интервальные повторения (FSRS); (3) практика в живом диалоге с ИИ-тьютором. Static markup; no handlers. |
| Gating | (same) | already inside `dashState === 'first-run' ? (...) : (...)`, so it renders only on first run — no extra condition needed. |
| Test | `src/app/__tests__/home-grid.test.tsx` | first-run render → assert the «Как это работает» heading + step phrases present; seeded/initialized render → assert absent. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | `specs/011-first-run-how-it-works/`. |
| II. Test-First | ✅ | first-run present / initialized absent cases (FR-005). |
| III. Fail-Fast | ✅ | Static markup; no new failure path. |
| IV. Layered Boundaries | ✅ | Render-only; no DB/facade change. |
| V. No Placeholders | ✅ | Real factual steps. |
| Stack & Language | ✅ | Russian via `t()`; docs English. |
| Doc-drift gate | ✅ planned | CHANGELOG entry in the commit; no schema/API doc affected. |

**Result**: PASS — no violations.

## Project Structure

```text
specs/011-first-run-how-it-works/{plan,research,data-model,quickstart}.md + checklists/
src/app/page.tsx                       # EDIT — first-run «Как это работает» 3-step block
src/app/__tests__/home-grid.test.tsx   # EDIT — present(first-run)/absent(initialized) test
CHANGELOG.md                           # EDIT — changelog entry
```

**Structure Decision**: One static block inside the existing first-run branch; test
added to the Home suite. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed.

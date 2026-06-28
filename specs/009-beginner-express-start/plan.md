# Implementation Plan: Beginner Express-Start in the Diagnostic

**Branch**: `009-beginner-express-start` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-beginner-express-start/spec.md`

## Summary

Fix 004 C-11. In `src/components/AssessmentModal.tsx`, `handleSave` imports the
starter deck with `checkedNewWordIds` (line 127-137). Add a sibling
`handleStartFresh` that imports with an **empty** set (`new Set()`) and calls the
same `onSaved`, plus a footer button «Я начинаю с нуля» (guarded like the existing
save). Existing «Сохранить и начать», «Отмена», «Закрыть» unchanged. Ships with a test.

## Technical Context

**Language/Version**: TypeScript / React 19 (client component). Docs Markdown.
**Primary Dependencies**: Existing `importStarterDeck(profileId, knownIds)` + `onSaved`.
No new packages/data/schema.
**Storage**: No change (reuses the existing additive starter-deck import).
**Testing**: Vitest + RTL. Extend `src/components/__tests__/AssessmentModal.test.tsx`:
click the express button → starter deck seeded, all words new, `onSaved` called.
**Target Platform**: Web app; Windows/PowerShell.
**Project Type**: Web application — single-component additive button.
**Constraints**: additive only; same load-guard as save (FR-004); no FSRS/schema/
other-screen change (FR-005); Russian string, English docs (FR-007).
**Scale/Scope**: 1 source file + 1 test file.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| Express handler | `src/components/AssessmentModal.tsx` near `handleSave` (`:127-137`) | add `handleStartFresh` = `importStarterDeck(profileId, new Set())` then `onSaved()`, with the same `isSaving`/try-catch/`onError` wrapper. |
| Express button | footer (`:256-273`, near «Сохранить и начать») | add a button «Я начинаю с нуля» → `handleStartFresh`, `disabled={starterDeckData.length === 0 || isSaving}` (same guard). |
| Unchanged | `:127` handleSave, «Отмена» (`:257`), «Закрыть» (`:146`) | untouched. |
| Test | `src/components/__tests__/AssessmentModal.test.tsx` | render modal, wait for deck load, click «Я начинаю с нуля» → `onSaved` called, `db.words` has LOCAL_DECK words all status 'new'. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | `specs/009-beginner-express-start/`. |
| II. Test-First | ✅ | Express-button test added (FR-006). |
| III. Fail-Fast | ✅ | Same try/catch/onError + load guard as existing save. |
| IV. Layered Boundaries | ✅ | Reuses `importStarterDeck` service facade; no new DB access. |
| V. No Placeholders | ✅ | Real handler + button. |
| Stack & Language | ✅ | Russian label; docs English. |
| Doc-drift gate | ✅ planned | CHANGELOG entry in the commit; no schema/API doc affected. |

**Result**: PASS — no violations.

## Project Structure

```text
specs/009-beginner-express-start/{plan,research,data-model,quickstart}.md + checklists/
src/components/AssessmentModal.tsx                  # EDIT — express handler + button
src/components/__tests__/AssessmentModal.test.tsx   # EDIT — express-start test
CHANGELOG.md                                         # EDIT — changelog entry
```

**Structure Decision**: Localized additive change in the existing modal; co-located
test extended. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed.

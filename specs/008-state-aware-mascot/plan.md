# Implementation Plan: State-Aware Mascot Greeting

**Branch**: `008-state-aware-mascot` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-state-aware-mascot/spec.md`

## Summary

Fix 004 C-10. `getMascotBubbleHtml` (`src/app/page.tsx:238`) returns, for level 0, a
static «…Перейди в раздел практики и выбери тему!» that references a nonexistent nav
and contradicts the adaptive CTA. Pass the already-computed `dashState` (line 300)
into the function (call site line 354) and make the level-0 branch switch on it:
first-run → diagnostic, newbie → warm-up, returning → reviews/continue, all-done →
neutral done, generic fallback. The resume-session bubble, custom-bubble path, and
the Japanese greetings (level 1/2/default) are unchanged. Ships with a test.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16 client component. Docs Markdown.
**Primary Dependencies**: Existing app only; uses the existing `DashState` union +
`dashState` value. No new packages/data/schema.
**Storage**: No change.
**Testing**: Vitest + RTL. Extend `src/app/__tests__/home-grid.test.tsx` (already
renders Home): first-run → bubble points to diagnostic, no «раздел практики».
**Target Platform**: Web app; Windows/PowerShell.
**Project Type**: Web application — single-function copy fix.
**Constraints**: greeting text only; no nav entry, no CTA/FSRS/other-screen change
(FR-005); Russian strings, English docs (FR-007); preserve resume + japanified
greetings (FR-003) and custom-bubble precedence (FR-004).
**Scale/Scope**: 1 source file + 1 test file.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| Greeting signature | `src/app/page.tsx:238` | `getMascotBubbleHtml(state: DashState)` — accept dashState. |
| Level-0 branch | `:256-258` | switch on `state`: first-run → «…пройди диагностику…», newbie → «…начни разминку…», returning → «…тебя ждут повторения…», all-done → «…на сегодня всё повторено…», default/anki → safe generic «Привет! Готов попрактиковаться сегодня?». Remove «раздел практики». |
| Unchanged | `:244-252`, `:259-263` | resume-session bubble + Japanese greetings (level 1/2/default) untouched; `customBubbleText` precedence untouched. |
| Call site | `:354` | `getMascotBubbleHtml(dashState)`. |
| Test | `src/app/__tests__/home-grid.test.tsx` | first-run render → assert bubble contains diagnostic wording and NOT «раздел практики». |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | `specs/008-state-aware-mascot/`. |
| II. Test-First | ✅ | First-run bubble test added (FR-006). |
| III. Fail-Fast | ✅ | Pure switch over an existing union; default fallback covers all states. |
| IV. Layered Boundaries | ✅ | Render-only copy; no DB/facade change. |
| V. No Placeholders | ✅ | Real state-aware copy. |
| Stack & Language | ✅ | Russian via inline strings (matches existing bubble style); docs English. |
| Doc-drift gate | ✅ planned | CHANGELOG entry in the commit; no schema/API doc affected. |

**Result**: PASS — no violations.

## Project Structure

```text
specs/008-state-aware-mascot/{plan,research,data-model,quickstart}.md + checklists/
src/app/page.tsx                       # EDIT — dashState-aware level-0 greeting
src/app/__tests__/home-grid.test.tsx   # EDIT — first-run bubble test
CHANGELOG.md                           # EDIT — changelog entry
```

**Structure Decision**: Localized change to one render helper + its call site; test
added to the existing Home suite. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed.

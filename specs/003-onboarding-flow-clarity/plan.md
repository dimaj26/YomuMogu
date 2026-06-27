# Implementation Plan: Onboarding Flow Clarity

**Branch**: `003-onboarding-flow-clarity` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-onboarding-flow-clarity/spec.md`

## Summary

Make the fresh-profile onboarding funnel **honest and self-explanatory** by fixing
the four actionable findings from the 002 cognitive-walkthrough — without touching
the funnel itself. Three small UI copy/CTA changes (chat empty-state CTA target,
practice disabled-warm-up explanation, home grid description) plus one
documentation rewrite (architecture core-flow). Each UI change ships with a test.
The diagnostics-as-gate behavior is preserved exactly (FR-006 / SC-005).

## Technical Context

**Language/Version**: TypeScript (strict), React 19 client components, Next.js 16
App Router. Docs in Markdown.

**Primary Dependencies**: Existing app only. No new packages. Uses the existing
bilingual `t(ru, jp)` helper and the existing local-list initialization signals
already present in each page.

**Storage**: N/A — no schema/persistence change. The conditional copy is driven by
**existing** state flags: `isLocalInit` (home, `src/app/page.tsx:54`) and
`isLocalInitialized` (practice, `src/app/practice/page.tsx:154`).

**Testing**: Vitest + @testing-library/react. New behavior is covered in the
existing co-located suites: `src/app/chat/__tests__/page.test.tsx` and
`src/app/practice/__tests__/page.test.tsx`; a focused test is added for the home
grid description (`src/app/__tests__/` or a co-located home test).

**Target Platform**: Web app, Windows/PowerShell dev environment.

**Project Type**: Web application (Next.js App Router) — copy/CTA + docs change.

**Performance Goals**: N/A (static conditional rendering).

**Constraints**: Diagnostics gate unchanged — no auto-seed, no new direct nav into
quiz/chat from a fresh profile (FR-006). Russian UI strings; English docs (FR-008).

**Scale/Scope**: 3 source files + 1 knowledge doc + up to 3 test files +
CHANGELOG. Findings F-01…F-04 only; F-05 out of scope.

## Concrete change targets (from source review)

| Finding | File / anchor | Current | Change |
|---------|---------------|---------|--------|
| **F-02** | `src/app/chat/page.tsx:1461-1462` (empty `!session` branch) | `onClick={() => router.push('/settings')}` + `t('Перейти в настройки', …)` | route to `/practice`; relabel to `t('Перейти к практике', '練習へ')`. (The session-*completion* routing at `:770`/`:782` is a separate concern and stays as-is.) |
| **F-03** | `src/app/practice/page.tsx` new-words card, near warm-up button (`:1243-1260`); flag `isLocalInitialized` (`:154`) | disabled `🎯 Начать разминку` (`:1246`) with no reason | add a conditional explanatory line shown when `deckMode === 'local' && !isLocalInitialized`, directing to the diagnostic with a link to `/settings` (mirrors the tab message at `:1367` and the `hasStudyContext` soft-hint pattern at `:1566`). |
| **F-04** | `src/app/page.tsx:738` (Kumiko grid description); flag `isLocalInit` (`:54`) | hardcoded "состояние 500 слов вашей стартовой колоды" | render description conditionally on `isLocalInit`: uninitialized → "колода ещё не инициализирована, пройдите диагностику"; initialized → existing text. |
| **F-01** | `knowledge/architecture.md` [CP-2.1] | Anki-first numbered flow | rewrite so primary numbered flow is local-first; Anki as labeled opt-in branch. |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement; `specs/003-onboarding-flow-clarity/`. |
| II. Test-First | ✅ | New user-facing behavior (F-02/F-03/F-04) ships with accompanying Vitest/RTL tests in the co-located suites (FR-007). F-01 is docs-only (no test). |
| III. Fail-Fast | ✅ | No error handling changed; the F-03 change makes a silent gated state *louder* (explanatory), consistent with fail-loud. |
| IV. Layered Boundaries | ✅ | No DB/IndexedDB access added — changes read **existing** page state flags and render copy. No facade boundary crossed. |
| V. No Placeholders | ✅ | Real copy and real conditional logic; no stubs/TODOs. |
| Stack & Language | ✅ | New UI strings Russian via existing `t()` helper; docs English (FR-008); PowerShell. |
| Doc-drift gate | ✅ planned | F-01 edits `knowledge/architecture.md`; `CHANGELOG.md` entry ships in the same commit; `features.md` already correct. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-onboarding-flow-clarity/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (incl. audit constraint)
├── data-model.md        # Phase 1 — the init-state signal (no new data)
├── quickstart.md        # Phase 1 — test + browser re-walk validation
├── contracts/
│   └── ui-states.md     # Phase 1 — per-surface copy/CTA state contract
└── checklists/
    └── requirements.md  # spec quality checklist (already created)
```

### Source Code (repository root)

```text
src/app/chat/page.tsx                 # EDIT — F-02 empty-state CTA → /practice + label
src/app/practice/page.tsx             # EDIT — F-03 conditional "run diagnostic" line
src/app/page.tsx                      # EDIT — F-04 conditional grid description
src/app/chat/__tests__/page.test.tsx       # EDIT/ADD — F-02 test
src/app/practice/__tests__/page.test.tsx   # EDIT/ADD — F-03 test
src/app/__tests__/home-grid.test.tsx       # ADD — F-04 test (home description)
knowledge/architecture.md             # EDIT — F-01 core-flow rewrite
CHANGELOG.md                          # EDIT — changelog entry
```

**Structure Decision**: Existing Next.js App Router layout; changes are localized
to three page components, their co-located tests, and one knowledge doc. No new
modules, routes, or state.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

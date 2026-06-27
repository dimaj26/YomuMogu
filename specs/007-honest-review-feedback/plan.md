# Implementation Plan: Honest Review Feedback on Day One

**Branch**: `007-honest-review-feedback` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-honest-review-feedback/spec.md`

## Summary

Fix 004 C-09. In `src/app/practice/page.tsx` the active-review card shows
`dueActiveWordsCount > 0 ? "N ready" : "Все активные слова повторены! Отличная
работа."` (~line 1285-1289). Split the `else` into two: if the learner has at least
one word in review/learning status → keep the congratulations; otherwise (all-new
deck, never reviewed) → a neutral "haven't started reviewing yet" message pointing
to warm-up/quiz. Signal derived from the already-loaded `words` array
(`w.status === 'review' || w.status === 'learning'`). One message only; nothing else
changes. Ships with tests.

## Technical Context

**Language/Version**: TypeScript / React 19 / Next.js 16 (client component). Docs Markdown.

**Primary Dependencies**: Existing app only. Reads the already-loaded `words`
(`AnkiWord[]` with `status`). No new packages, query, or schema.

**Storage**: No change.

**Testing**: Vitest + @testing-library/react. Extend
`src/app/practice/__tests__/page.test.tsx`: all-new deck → neutral; ≥1
review/learning, none due → praise; ≥1 due → count message.

**Target Platform**: Web app; Windows/PowerShell dev.

**Project Type**: Web application — single-message conditional fix.

**Constraints**: One message on `/practice` only (FR-005); no FSRS/button/count/
other-screen change; Russian UI strings, English docs (FR-007).

**Scale/Scope**: 1 source file + 1 test file.

## Concrete change targets (from source review)

| Item | File / anchor | Change |
|------|---------------|--------|
| Active-review message | `src/app/practice/page.tsx` ~`:1285-1289` | derive `hasActiveWords = words.some(w => w.status === 'review' || w.status === 'learning')`; render: `dueActiveWordsCount > 0` → existing count message; else if `hasActiveWords` → existing congratulations; else → new neutral Russian message via `t()` pointing to warm-up/quiz (e.g. «Повторений пока нет — начните с разминки слева, и слова появятся здесь по расписанию.»). |
| Test | `src/app/practice/__tests__/page.test.tsx` | add cases: all-new deck → neutral text present, congratulations absent; ≥1 learning/review (none due) → congratulations present; ≥1 due → count message present. |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement; `specs/007-honest-review-feedback/`. |
| II. Test-First | ✅ | Three message states covered by added practice-suite cases (FR-006). |
| III. Fail-Fast | ✅ | Pure derivation over loaded words; no new failure path. |
| IV. Layered Boundaries | ✅ | Reads existing component state; no DB/facade change. |
| V. No Placeholders | ✅ | Real conditional + real copy. |
| Stack & Language | ✅ | Russian string via `t()`; docs English. |
| Doc-drift gate | ✅ planned | `CHANGELOG.md` entry in the implementing commit; no schema/API doc affected. |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/007-honest-review-feedback/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/app/practice/page.tsx                     # EDIT — split the no-due message by hasActiveWords
src/app/practice/__tests__/page.test.tsx      # EDIT — add the three message-state cases
CHANGELOG.md                                   # EDIT — changelog entry
```

**Structure Decision**: Localized conditional/copy change in the existing practice
page; co-located test suite extended. No new modules/state.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

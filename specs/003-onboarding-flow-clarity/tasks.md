# Tasks: Onboarding Flow Clarity

**Feature**: `003-onboarding-flow-clarity` | **Plan**: [plan.md](plan.md) |
**Spec**: [spec.md](spec.md)

Fixes 002 findings F-01…F-04. Test-First per the constitution: each UI change ships
with its test (FR-007). Hard constraint: the diagnostics gate is unchanged — no
auto-seed, no new fresh-profile nav into quiz/chat (FR-006). Concrete change anchors
are in [plan.md](plan.md) "Concrete change targets"; required states in
[contracts/ui-states.md](contracts/ui-states.md).

## Phase 1: Setup

- [X] T001 Confirm the dev/test toolchain is ready: `npx vitest --version` works and the existing co-located suites `src/app/chat/__tests__/page.test.tsx` and `src/app/practice/__tests__/page.test.tsx` run green as a baseline before changes.

## Phase 2: Foundational

_No shared foundational work — each story is an independent, localized edit. (Skip.)_

## Phase 3: User Story 1 — Empty-chat recovery → practice (P1) 🎯 MVP

**Goal**: The empty `/chat` state guides the learner to `/practice` (where sessions start).

**Independent test**: Empty `/chat` renders an action navigating to `/practice`, labelled for that destination.

- [X] T002 [US1] In `src/app/chat/__tests__/page.test.tsx`, add a test for the `!session` empty state: it renders the CTA and clicking it calls `router.push('/practice')` (mock `next/navigation` router as the suite already does); assert the label is the practice-destination wording, not "настройки".
- [X] T003 [US1] In `src/app/chat/page.tsx` (empty-state branch ~`:1461-1462`), change `onClick` to `router.push('/practice')` and the label to `t('Перейти к практике', '練習へ')`. Leave session-completion/exit routing (`:770`, `:782`) untouched. Confirm T002 passes.

**Checkpoint**: empty-chat dead-end resolved (F-02).

## Phase 4: User Story 2 — Practice "run diagnostic" explanation (P2)

**Goal**: A fresh-profile learner sees why warm-up is unavailable and how to unlock it; gate intact.

**Independent test**: `!isLocalInitialized` → explanatory line present; initialized → absent.

- [X] T004 [US2] In `src/app/practice/__tests__/page.test.tsx`, add tests: (a) local mode + `!isLocalInitialized` → the "пройдите диагностику" explanatory line is rendered near the warm-up area with a link to `/settings`; (b) local mode + initialized (daily-limit / words-available) → the line is absent and the warm-up button's disabled state is unchanged. Mock the local-init state the way the existing suite sets page state.
- [X] T005 [US2] In `src/app/practice/page.tsx` (new-words card, near the warm-up button ~`:1243-1260`), add a conditional explanatory line rendered only when `deckMode === 'local' && !isLocalInitialized`, with Russian copy via `t()` and a link to `/settings` (mirror the existing tab message at `:1367` / `hasStudyContext` pattern). Keep the warm-up button disabled (gate unchanged). Confirm T004 passes.

**Checkpoint**: silent disabled warm-up now self-explanatory (F-03), gate preserved.

## Phase 5: User Story 3 — Home grid description matches deck state (P2)

**Goal**: The home memory-grid description stops claiming "500 words" before the deck is seeded.

**Independent test**: `!isLocalInit` → description omits the populated-deck claim and points to the diagnostic; `isLocalInit` → existing text.

- [X] T006 [US3] Add `src/app/__tests__/home-grid.test.tsx` (new focused suite, mocking the data layer like the existing page suites): assert the grid description text differs by `isLocalInit` — uninitialized shows "не инициализирована / пройдите диагностику", initialized shows the existing "состояние 500 слов…" text.
- [X] T007 [US3] In `src/app/page.tsx` (grid description ~`:738`), make the description conditional on `isLocalInit` (`:54`): uninitialized → Russian "колода ещё не инициализирована, пройдите диагностику" wording via `t()`; initialized → the existing string. Confirm T006 passes.

**Checkpoint**: cross-screen contradiction resolved (F-04).

## Phase 6: User Story 4 — Architecture core-flow doc rewrite (P3)

**Goal**: Docs present local-first as the primary flow; Anki as opt-in.

**Independent test**: [CP-2.1] reads local-first and self-consistent; Anki labelled opt-in.

- [X] T008 [US4] Rewrite `knowledge/architecture.md` [CP-2.1] "Core User Flow": primary numbered flow = local-first (home/settings → «Пройти диагностику» → AssessmentModal seeds local deck → `/practice` warm-up/quiz → session → `/chat`); add Anki as an explicitly-labelled opt-in branch; remove the numbered-list-vs-prose contradiction. English doc.

**Checkpoint**: source-of-truth doc matches reality (F-01).

## Phase 7: Polish & Cross-Cutting

- [X] T009 Run the touched suites + lint: `npx vitest run src/app/chat/__tests__/page.test.tsx src/app/practice/__tests__/page.test.tsx src/app/__tests__/home-grid.test.tsx` then `npm run test` and ESLint; all green. Validate against [contracts/ui-states.md](contracts/ui-states.md) invariants (gate intact: no auto-seed, no new fresh-profile quiz/chat nav).
- [X] T010 [P] Append a `CHANGELOG.md` entry for feature 003 (onboarding-flow clarity: F-01…F-04 resolved).
- [X] T011 Optional live re-walk per [quickstart.md](quickstart.md): with `npm run dev`, re-check the three fresh-profile surfaces and confirm the gate still holds.
- [X] T012 Run `./venv/Scripts/graphify.exe update .` (source symbols changed), then auto-commit the feature (specs, src, tests, knowledge, CHANGELOG) with a `fix(ux):`/`feat(ux):` subject; do **not** push.

## Dependencies & order

- **Setup (T001)** → user stories.
- **US1 (T002-T003)**, **US2 (T004-T005)**, **US3 (T006-T007)**, **US4 (T008)** are
  mutually **independent** — each touches a different file (chat / practice / home /
  doc). Within each story the test precedes the change (Test-First).
- **Polish (T009-T012)** last.

## Parallel opportunities

- US1, US2, US3, US4 touch disjoint files and can be implemented in any order / in
  parallel. T010 (CHANGELOG) is `[P]` vs other polish.

## MVP scope

**User Story 1 (T002-T003)** — fixing the only true recovery dead-end (empty-chat
CTA) — is the minimum shippable increment. US2-US4 complete the findings set.

## Summary

- Total tasks: **12** (Setup 1, US1 2, US2 2, US3 2, US4 1, Polish 4).
- Per story: US1 = 2, US2 = 2, US3 = 2, US4 = 1.
- Test-First: T002→T003, T004→T005, T006→T007.

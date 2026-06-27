# Phase 0 Research: Onboarding Flow Clarity

No `NEEDS CLARIFICATION` markers remained. The decisions below record the approach
and the constraints inherited from the 002 report and the proposal audit.

## Decision 1 — Preserve the diagnostics gate; fix only signals around it

- **Decision**: Treat the diagnostics-as-gate funnel as correct and untouched. Fix
  only documentation, copy, CTA destinations, and conditional explanatory text.
- **Rationale**: The proposal audit (PA-1) classified the gate as an intentional
  pedagogical pattern and made auto-seeding the deck or adding fresh-profile links
  into quiz/chat a deal-breaker (0 on Compliance). The findings themselves only
  ask for honest signalling, not a funnel change.
- **Alternatives considered**: Auto-seed the starter deck on first load (rejected —
  destroys the AssessmentModal's purpose and the funnel); add direct nav to
  quiz/chat from a fresh profile (rejected — same deal-breaker).

## Decision 2 — Drive conditional copy from existing init flags (no new state)

- **Decision**: Use the flags already present in each page — `isLocalInit`
  (`src/app/page.tsx`) and `isLocalInitialized` (`src/app/practice/page.tsx`) — to
  switch copy. Introduce no new state, hook, or persistence.
- **Rationale**: The signal already exists and already gates other UI on these
  pages (e.g. `page.tsx:300` sets `first-run`; `practice/page.tsx:1201` gates a
  priority hint). Reusing it keeps the change minimal, consistent, and
  automatically correct at the post-diagnostic transition (edge case).
- **Alternatives considered**: A new shared "onboarding state" selector (rejected —
  over-engineering for three copy switches; the flags are already local to each
  surface).

## Decision 3 — F-02 recovery target is `/practice`, not `/settings`

- **Decision**: The empty-chat (`!session`) CTA routes to `/practice` and is
  relabelled "Перейти к практике".
- **Rationale**: Sessions are created in the practice/scenario flow
  (`practice/page.tsx:646` writes `active_session` then routes to `/chat`); the
  audit confirmed `/practice` dominates because it also degrades gracefully for an
  uninitialized deck (it shows the F-03 hint). `/settings` cannot start a session.
- **Scope note**: Only the empty-state branch (`chat/page.tsx:1461`) changes. The
  session-*completion*/exit routing (`:770`, `:782`) is a different flow (after a
  finished session) and is deliberately left as-is.

## Decision 4 — F-03 follows the existing progressive-disclosure pattern

- **Decision**: Add a short explanatory line near the disabled warm-up button,
  shown only when `deckMode === 'local' && !isLocalInitialized`, linking to
  `/settings` (where the diagnostic lives).
- **Rationale**: The practice page already uses conditional soft hints
  (`hasStudyContext` at `:173`/`:1566` hides quests for brand-new users) and
  already has the "пройдите диагностику в настройках" wording in a tab
  (`:1367`). Reusing both keeps the UX idiom and copy consistent. Gating on
  `!isLocalInitialized` ensures it does NOT show in the normal daily-limit case
  (initialized deck, no new words) — satisfying FR-003 / the edge case.
- **Alternatives considered**: Enable the button and show a toast (rejected —
  changes the gate); a tooltip only (rejected — invisible on the page snapshot and
  to first-time users, the very audience this targets).

## Decision 5 — Testing approach (Test-First, FR-007)

- **Decision**: Cover each UI change in the co-located Vitest/RTL suite: F-02 in
  `chat/__tests__/page.test.tsx` (empty state → button navigates to `/practice`),
  F-03 in `practice/__tests__/page.test.tsx` (uninitialized → hint present;
  initialized → hint absent), F-04 in a new `src/app/__tests__/home-grid.test.tsx`
  (description switches on `isLocalInit`).
- **Rationale**: The constitution mandates tests accompany new behavior. Co-located
  suites already exist for chat/practice; the home page lacks one, so a focused
  test file is added for just the grid description to keep it lightweight.
- **Alternatives considered**: Only a manual browser re-walk (rejected — violates
  Test-First); a full home-page render test (kept minimal — assert just the
  conditional description text under each flag value, mocking the data layer like
  the existing page suites do).

## Decision 6 — F-01 is documentation-only

- **Decision**: Rewrite `knowledge/architecture.md` [CP-2.1] so the primary
  numbered flow is local-first and Anki is an explicit opt-in branch; resolve the
  internal contradiction with the section's trailing paragraph.
- **Rationale**: `features.md` ("Adaptive Daily Hub", "Offline Mode") already
  describes local-first as the truth; only the [CP-2.1] numbered list lags. No code
  is involved.
- **Alternatives considered**: Leaving the Anki flow as step 1 with a note
  (rejected — the audit flagged the numbered-list-vs-prose contradiction as the
  actual defect).

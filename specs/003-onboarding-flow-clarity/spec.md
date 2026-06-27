# Feature Specification: Onboarding Flow Clarity (002 findings F-01…F-04)

**Feature Branch**: `003-onboarding-flow-clarity`

**Created**: 2026-06-27

**Status**: Implemented (2026-06-27)

**Input**: Fix the actionable findings from the 002 cognitive-walkthrough report
(F-01–F-04; F-05 excluded as dev-build noise), under the audit's hard constraint:
the diagnostics-as-gate funnel is intentional and must not be broken — fix only
documentation, copy, CTA targets, and conditional explanatory text.

## Overview

The 002 browser walkthrough found that a **fresh-profile learner** meets several
points where the app's wording or navigation contradicts its own behavior or
leaves them at a silent dead-end — even though the underlying onboarding funnel
(run the knowledge diagnostic, which seeds the local 500-word deck, before
practice/quiz/chat unlock) is correct and intentional. This feature makes the
funnel **honest and self-explanatory** without changing the funnel itself.

**Hard constraint (from the proposal audit)**: the diagnostics gate is a
deliberate pedagogical pattern. This feature MUST NOT auto-seed the starter deck
and MUST NOT add direct navigation into `/practice/quiz` or `/chat` from a fresh
profile. Only text, links/CTA destinations, and conditional copy change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recover from an empty chat to where sessions begin (Priority: P1)

A learner who opens conversation practice without an active session is guided to
the place where a session is actually created, instead of being sent somewhere it
cannot be started.

**Why this priority**: This is the only finding that is a true *recovery
dead-end* — the current call-to-action sends the user to the wrong destination,
so they cannot get unstuck by following the UI. Highest user impact.

**Independent Test**: Open conversation practice with no active session; confirm
the on-screen action leads to the practice screen (where sessions are started)
and its label reflects that destination.

**Acceptance Scenarios**:

1. **Given** no active session, **When** the learner opens conversation practice,
   **Then** the empty-state action navigates to the practice screen (not settings)
   and its wording names that destination.
2. **Given** the learner follows that action, **When** they arrive at practice,
   **Then** they are at the screen from which a session can actually be started.

---

### User Story 2 - Understand why "start warm-up" is unavailable (Priority: P2)

A fresh-profile learner on the practice screen, where the primary "start warm-up"
action is unavailable because no words exist yet, sees a short explanation telling
them to run the diagnostic first — so the disabled control is self-explanatory,
not a silent dead-end.

**Why this priority**: The gate is correct, but a disabled button with no reason
strands first-time users. Adding an explanation (mirroring the existing
progressive-disclosure pattern used for quests) removes the dead-end while keeping
the funnel intact.

**Independent Test**: On a fresh profile, view the practice screen; confirm a
short message near the unavailable warm-up action directs the user to run the
diagnostic, with a way to reach it.

**Acceptance Scenarios**:

1. **Given** a fresh profile with no initialized local list, **When** the learner
   views the practice screen, **Then** an explanatory line near the unavailable
   warm-up action tells them to run the diagnostic and offers a way to reach it.
2. **Given** the local list is initialized and words are available, **When** the
   learner views the practice screen, **Then** the explanatory line is absent and
   the warm-up action is available (the gate behaves exactly as before).

---

### User Story 3 - Dashboard memory grid matches the real deck state (Priority: P2)

On the home dashboard, the memory-grid description reflects whether the local deck
has actually been initialized, so it no longer claims "500 words" while other
screens say the list is empty.

**Why this priority**: A cross-screen contradiction (dashboard implies a populated
deck; practice/settings say "not initialized") confuses first-time users about
whether they have any words. Fixing the description restores consistency.

**Independent Test**: On a fresh, uninitialized profile, view the home grid and
confirm its description does not assert a populated 500-word deck; after the deck
is initialized, the description reflects the seeded deck.

**Acceptance Scenarios**:

1. **Given** the local list is not initialized, **When** the learner views the
   home memory grid, **Then** its description indicates the deck is not yet
   initialized (and points to the diagnostic) rather than asserting "500 words".
2. **Given** the local list is initialized, **When** the learner views the home
   memory grid, **Then** its description reflects the seeded deck as before.

---

### User Story 4 - Documentation states the real default flow (Priority: P3)

A developer or AI agent reading the project's architecture documentation finds the
primary, numbered core-user-flow described as the local-first path the app
actually defaults to, with the Anki path documented as an opt-in branch.

**Why this priority**: Lower direct end-user impact, but the documentation is the
source of truth for everyone working on the project; an Anki-first description
that contradicts the local-first default misleads future work.

**Independent Test**: Read the architecture core-flow section; confirm the primary
numbered flow is local-first (home/settings → diagnostic → seeded deck → practice
warm-up/quiz → session → chat) and Anki is an explicitly-labeled opt-in branch.

**Acceptance Scenarios**:

1. **Given** the architecture documentation, **When** a reader consults the core
   user flow, **Then** the primary flow is local-first and self-consistent (no
   contradiction between the numbered steps and the surrounding text).
2. **Given** the same section, **When** a reader looks for the Anki path, **Then**
   it is present as a clearly-labeled opt-in branch, not the default.

---

### Edge Cases

- **Transition moment**: immediately after the diagnostic seeds the deck, the
  practice explanation must disappear and the warm-up action become available, and
  the dashboard grid description must switch to the seeded wording (state derived
  from the existing initialization flag, no manual refresh required).
- **Initialized-but-empty day**: if the local list is initialized but no new words
  remain for today, the warm-up unavailability is the *normal* daily-limit case —
  the fresh-profile "run diagnostic" explanation must NOT appear (it is specific to
  the uninitialized state).
- **Anki source selected**: these copy/CTA changes target the local-first default;
  they must not misfire when an Anki source is active.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The empty conversation-practice state (no active session) MUST direct
  the learner to the practice screen where sessions are started, and its action
  label MUST name that destination.
- **FR-002**: On the practice screen, when the local list is not initialized, the
  app MUST show a short explanatory message near the unavailable warm-up action
  directing the learner to run the diagnostic, with a way to reach it.
- **FR-003**: The practice explanatory message MUST appear only in the
  uninitialized-local-list state — not when the list is initialized (including the
  normal "no new words left today" daily-limit case).
- **FR-004**: The home memory-grid description MUST reflect the real deck state:
  when the local list is not initialized it MUST NOT assert a populated 500-word
  deck and SHOULD point to the diagnostic; when initialized it reflects the deck.
- **FR-005**: The architecture documentation's core-user-flow MUST present the
  local-first path as the primary numbered flow and the Anki path as an
  explicitly-labeled opt-in branch, with no internal contradiction.
- **FR-006**: The diagnostics-as-gate funnel MUST remain unchanged — no auto-seed
  of the starter deck and no new direct navigation into quiz/chat from a fresh
  profile. Changes are limited to documentation, copy, CTA destinations, and
  conditional explanatory text.
- **FR-007**: New user-facing behavior introduced by FR-001–FR-004 MUST ship with
  accompanying automated tests (per the constitution's Test-First principle).
- **FR-008**: All new or changed user-facing strings MUST be in Russian;
  documentation changes MUST be in English (per the constitution's language rule).

### Key Entities *(include if feature involves data)*

- **Local-list initialization state**: the existing signal indicating whether the
  local 500-word deck has been seeded by the diagnostic; drives the conditional
  copy in FR-002, FR-003, and FR-004. (No new data is introduced.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an empty conversation-practice state, a learner can reach the
  screen where a session is started by following exactly one on-screen action.
- **SC-002**: On a fresh profile, 100% of the three fresh-profile surfaces (home
  grid description, practice warm-up area, conversation empty state) communicate a
  consistent message: the deck is not yet initialized and the diagnostic is the
  next step — with no surface asserting a populated deck.
- **SC-003**: After the diagnostic seeds the deck, none of those surfaces still
  show the "not initialized / run diagnostic" messaging (state-driven, no manual
  refresh).
- **SC-004**: A reader of the architecture core-flow can correctly state the app's
  default path as local-first and identify Anki as opt-in, with no contradiction
  in the section.
- **SC-005**: The onboarding funnel is unchanged — a fresh profile still cannot
  reach quiz or chat without running the diagnostic first.

## Assumptions

- **Initialization signal exists**: the local-list initialization flag used by the
  practice and settings screens is available to the practice and home surfaces; no
  new persistence or schema is required.
- **Session origin**: chat sessions are created from the practice/scenario flow;
  the practice screen is therefore the correct recovery destination for an empty
  chat (confirmed during the 002 walkthrough and the proposal audit).
- **Progressive-disclosure precedent**: the practice screen already uses a
  conditional "soft hint" pattern (quests hidden until study context exists); the
  FR-002 explanation follows that established pattern.
- **Scope**: this feature is limited to the four 002 findings F-01–F-04. F-05 (a
  benign dev-build console preload warning) is intentionally out of scope.

# Feature Specification: State-Aware Mascot Greeting

**Feature Branch**: `008-state-aware-mascot`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Fix 004 finding C-10 — the home mascot bubble tells the learner «Перейди
в раздел практики и выбери тему!», but there is no "Практика" navigation entry and
the line ignores the dashboard's adaptive state, misdirecting first-run users.

## Overview

The home dashboard already computes an adaptive state (first-run / newbie /
returning / all-done / resume / anki) and shows a matching headline + primary
button. The mascot speech bubble, however, shows a fixed greeting that tells the
learner to "go to the practice section and pick a topic" — but there is no such
navigation entry, and for a first-run user the real next step is the diagnostic,
not picking a topic. The bubble contradicts the very button next to it. This
feature makes the mascot's greeting mirror the dashboard state so the mascot and
the primary call-to-action always agree on the next step.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mascot points to the real next step (Priority: P1)

A learner reading the mascot bubble is told the same next action that the primary
button offers for their current state — never a step or place that doesn't exist.

**Why this priority**: A guide character that misdirects (to a nonexistent section,
or a wrong first step) actively confuses newcomers and undermines the adaptive hub.

**Independent Test**: View the home dashboard in each state and confirm the mascot's
message matches that state's next step (and never references a "практика" section).

**Acceptance Scenarios**:

1. **Given** a first-run learner (deck not initialized), **When** they view the
   home dashboard, **Then** the mascot points them to the diagnostic (matching the
   primary CTA) and does NOT tell them to "go to the practice section".
2. **Given** a learner who has new words to warm up, **When** they view home, **Then**
   the mascot points to the warm-up (matching the CTA).
3. **Given** a learner with reviews waiting, **When** they view home, **Then** the
   mascot mentions reviews/continuing (matching the CTA).

---

### User Story 2 - Existing greetings preserved (Priority: P2)

A learner with an unfinished chat still sees the resume-session bubble, and a
higher-japanification-level learner still sees the Japanese greeting — these are
unchanged.

**Why this priority**: The fix must be limited to the misdirecting level-0 greeting;
the resume bubble and japanified greetings already work.

**Independent Test**: With an active session, confirm the resume bubble appears; at a
higher japanification level, confirm the Japanese greeting appears.

**Acceptance Scenarios**:

1. **Given** an unfinished chat session, **When** the learner views home, **Then**
   the existing resume-session bubble appears (unchanged).
2. **Given** a higher japanification level, **When** the learner views home, **Then**
   the existing Japanese greeting appears (unchanged).

---

### Edge Cases

- **All-done state** (deck initialized, nothing due, no new): neutral "all done for
  today" message — not a misdirection.
- **Anki / other source**: a safe generic greeting (no local-deck-specific step).
- **Custom bubble text already set** (e.g. mascot click): unchanged — that path
  takes precedence as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The level-0 mascot greeting MUST reflect the dashboard's current
  adaptive state so it names the same next step as the primary call-to-action.
- **FR-002**: The greeting MUST NOT reference a "практика" navigation section (which
  does not exist); first-run MUST point to the diagnostic, newbie to the warm-up,
  returning to reviews/continuing, all-done to a neutral done message, with a safe
  generic fallback for other states.
- **FR-003**: The existing resume-session bubble (unfinished chat) and the Japanese
  greetings for higher japanification levels MUST be unchanged.
- **FR-004**: The custom-bubble-text path (e.g. mascot interaction) MUST keep
  precedence as today.
- **FR-005**: The change MUST be limited to the mascot greeting text — no new
  navigation entry, no change to the CTA logic, FSRS, or other screens.
- **FR-006**: New behavior MUST ship with an automated test (constitution
  Test-First) asserting the first-run bubble points to the diagnostic and does not
  contain «раздел практики».
- **FR-007**: New/changed user-facing strings MUST be Russian (exact wording easily
  adjustable); documentation English.

### Key Entities *(include if feature involves data)*

- **Dashboard state**: the existing adaptive state (first-run / newbie / returning /
  all-done / resume / anki) already computed on the home page; now also drives the
  mascot greeting. No new data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every dashboard state, the mascot's next-step message matches the
  primary CTA's next step (no contradiction).
- **SC-002**: The mascot never references a nonexistent "практика" navigation entry.
- **SC-003**: Resume-session and japanified greetings are unchanged (no regression).
- **SC-004**: No change to navigation, CTA logic, FSRS, or other screens.

## Assumptions

- **State already available**: the home page computes the adaptive state before
  rendering the mascot; it can be supplied to the greeting without new data.
- **Wording adjustable**: exact Russian phrasing is a reasonable default the team
  can tweak; the requirement is state-correctness, not specific copy.
- **Deferred from 004**: C-03 cap/selector, C-07/C-08 competency level + N3–N1
  grammar, C-12 MeCab fallback, C-14 landing, C-15 debug HUD remain out of scope.

# Feature Specification: First-Run "How It Works"

**Feature Branch**: `011-first-run-how-it-works`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Fix 004 finding C-14 — the first-run landing shows only a marketing
headline and a one-line intro before the «Пройти диагностику» CTA, so a newcomer
commits to the diagnostic with no idea what happens next. Add a compact, factual
"how it works" overview shown only on first run.

## Overview

When a brand-new learner lands on the home dashboard (first-run state), they see a
marketing headline, a one-line description, and a «Пройти диагностику (5 мин)»
button — with no preview of the journey they're starting. This feature adds a
compact, factual **«Как это работает»** 3-step overview, shown ONLY in the
first-run state, between the intro and the CTA, mirroring the app's real flow
(diagnostic → warm-up/reviews → AI dialogue). It is purely informational and
additive; it appears on first run and is absent in every other dashboard state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Newcomer understands the journey before committing (Priority: P1)

A first-time learner, before clicking the diagnostic, can read a short 3-step
overview of what the app will have them do, so they commit informed rather than
blind.

**Why this priority**: First-run is where newcomers decide to engage; a blind
commitment to a "5-minute diagnostic" with no context is avoidable friction for the
core target user.

**Independent Test**: On a fresh first-run profile, view the home dashboard; confirm
a compact 3-step "how it works" overview appears (above the diagnostic CTA) with the
three real steps.

**Acceptance Scenarios**:

1. **Given** a fresh first-run profile (deck not initialized), **When** the learner
   views the home dashboard, **Then** a «Как это работает» 3-step overview is shown
   (diagnostic → warm-up/reviews → AI dialogue), positioned before the diagnostic CTA.

---

### User Story 2 - Overview is first-run only (Priority: P2)

A returning/advanced learner (or any non-first-run state) does NOT see the "how it
works" overview — it is only for newcomers and does not clutter the adaptive hub.

**Why this priority**: The block is onboarding context; showing it to established
learners would be noise.

**Independent Test**: With an initialized deck (any non-first-run state), view home;
confirm the overview is absent.

**Acceptance Scenarios**:

1. **Given** an initialized deck (newbie/returning/all-done/resume/anki), **When**
   the learner views home, **Then** the "how it works" overview is NOT shown.

---

### Edge Cases

- **State transition**: once the deck is initialized (state leaves first-run), the
  overview disappears on the next render (state-driven, no manual refresh).
- **Anki / other source**: still not first-run for an initialized/Anki user → not
  shown.
- **Localization/japanification**: follows the same per-level translation approach
  as the surrounding first-run copy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In the first-run dashboard state, the home page MUST show a compact
  «Как это работает» overview of exactly three steps, mirroring the app's real flow:
  (1) short diagnostic that selects the learner's words; (2) warm-up + interval
  reviews (FSRS); (3) practising words in live dialogue with the AI tutor.
- **FR-002**: The overview MUST be positioned in the first-run layout between the
  intro text and the primary «Пройти диагностику» CTA.
- **FR-003**: The overview MUST appear ONLY when the dashboard state is first-run and
  MUST be absent in all other states (newbie / returning / all-done / resume / anki).
- **FR-004**: The overview MUST be static and informational — no new navigation, no
  logic, no FSRS/scheduling/schema change, no change to other screens or the CTA.
- **FR-005**: New behavior MUST ship with an automated test (constitution Test-First)
  asserting the 3-step overview renders on a fresh first-run profile and is absent
  once the deck is initialized.
- **FR-006**: New user-facing strings MUST be Russian (wording adjustable);
  documentation English.

### Key Entities *(include if feature involves data)*

- **Dashboard state**: the existing first-run flag/state on the home page; gates the
  overview's visibility. No new data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A fresh first-run learner sees a 3-step overview of the journey before
  the diagnostic CTA.
- **SC-002**: The overview is absent in every non-first-run state.
- **SC-003**: No change to navigation, the CTA, FSRS, or other screens.

## Assumptions

- **First-run state available**: the home page already computes the first-run state
  used for the adaptive headline/CTA; the overview reuses it.
- **Factual, adjustable copy**: the three steps describe the real flow; exact wording
  is a reasonable default the team can tweak.
- **Deferred from 004**: C-07/C-08 competency level + N3–N1 grammar (root-caused in
  the 004 analysis) and C-12 MeCab fallback remain out of scope.

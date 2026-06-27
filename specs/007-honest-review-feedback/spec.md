# Feature Specification: Honest Review Feedback on Day One

**Feature Branch**: `007-honest-review-feedback`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Fix 004 finding C-09 — the practice "Активное повторение слов" card
praises «Все активные слова повторены! Отличная работа.» even for a learner who
has never reviewed anything (a freshly initialized deck where all words are new).
Distinguish "nothing to review yet" from "you cleared your reviews".

## Overview

On the practice screen, the active-review card shows one of two messages: if there
are cards due now it says how many; otherwise it congratulates the learner with
«Все активные слова повторены! Отличная работа.» ("All active words reviewed! Great
job."). The problem: a brand-new learner who has just initialized the deck has zero
*due* cards simply because they have **never** moved any word into review — yet they
see congratulations for work they never did. This erodes trust in the app's
feedback. This feature makes the message honest: praise only when the learner
genuinely has review cards and has cleared them for now; otherwise show a neutral
"you haven't started reviewing yet" message that points to the warm-up/quiz.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No false praise before any reviewing (Priority: P1)

A brand-new learner who initialized the deck (all words still new) opens practice
and the active-review card does NOT congratulate them; instead it neutrally tells
them they haven't started reviewing yet and where to begin.

**Why this priority**: This is the fix; false praise on first run undermines trust
in every later message the app shows.

**Independent Test**: With a deck whose words are all new (none in review/learning),
view practice; confirm the active-review message is the neutral "not started yet"
copy, not the congratulations.

**Acceptance Scenarios**:

1. **Given** a deck where no word is in review or learning, **When** the learner
   views the active-review card, **Then** it shows the neutral "haven't started
   reviewing yet" message (pointing to warm-up/quiz), not «Все активные слова
   повторены! Отличная работа.».

---

### User Story 2 - Genuine praise still appears when earned (Priority: P1)

A learner who has active cards (in review/learning) but none due right now still
sees the genuine «Все активные слова повторены! Отличная работа.» — the praise is
preserved for when it is actually true.

**Why this priority**: The fix must not remove legitimate positive feedback; only
the false-on-day-one case changes.

**Independent Test**: With at least one word in review/learning but none due now,
view practice; confirm the congratulations message appears.

**Acceptance Scenarios**:

1. **Given** at least one word in review/learning status with none due now, **When**
   the learner views the active-review card, **Then** the congratulations message
   appears as before.
2. **Given** at least one word due now, **When** the learner views the card,
   **Then** the existing "N words ready for review" message appears (unchanged).

---

### Edge Cases

- **All words new (fresh deck)**: neutral message (the core fix).
- **Some review/learning words, none due**: genuine praise (unchanged).
- **Some due now**: count message (unchanged).
- **Card not shown at all** (deck empty / non-local edge): unchanged — this feature
  only changes the text inside the already-shown card.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the learner has cards due now, the active-review card MUST show
  the existing "N cards ready for review" message (unchanged).
- **FR-002**: When the learner has NO cards due now but DOES have at least one word
  in review or learning status, the card MUST show the existing congratulations
  «Все активные слова повторены! Отличная работа.».
- **FR-003**: When the learner has NO cards due now AND NO words in review or
  learning status (e.g. a freshly initialized all-new deck), the card MUST show a
  neutral "you haven't started reviewing yet" message that points to the
  warm-up/quiz — NOT the congratulations.
- **FR-004**: The signal distinguishing FR-002 from FR-003 MUST be derived from the
  already-loaded words (presence of any review/learning word); no new data, query,
  or schema is introduced.
- **FR-005**: The change MUST be limited to this one message on the practice screen —
  FSRS scheduling, the review button, counts, and all other screens MUST be
  unchanged.
- **FR-006**: The new behavior MUST ship with an automated test (constitution
  Test-First) covering all-new (neutral), has-active-none-due (praise), and
  some-due (count) states.
- **FR-007**: New/changed user-facing strings MUST be Russian; documentation English.

### Key Entities *(include if feature involves data)*

- **Active word**: an existing word whose status is review or learning; the presence
  of ≥1 such word distinguishes "cleared your reviews" from "haven't started". No
  new data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A freshly initialized all-new deck shows the neutral message, never the
  congratulations (no false praise on day one).
- **SC-002**: A learner with active-but-not-due cards still sees the congratulations
  (no loss of legitimate praise).
- **SC-003**: The due-count message is unchanged when cards are due.
- **SC-004**: No change to FSRS, the review button/counts, or other screens.

## Assumptions

- **Status signal available**: the loaded practice words carry their FSRS status
  (new / learning / review / mature), so "has any active word" is derivable in the
  component without new data.
- **Neutral copy**: the day-one message points to the existing warm-up/quiz path
  (consistent with the feature-003 onboarding guidance) rather than introducing a
  new flow.
- **Deferred from 004**: C-03 session-size cap/selector and C-07/C-08
  competency-engine level derivation + N3–N1 grammar content remain out of scope
  (C-07/C-08 root cause already documented in the 004 analysis).

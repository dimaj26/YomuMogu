# Feature Specification: Review Session-Size Selector

**Feature Branch**: `010-review-session-size`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Complete 004 finding C-03 (reorder shipped in 006). Give the learner an
explicit choice of how many due cards to review now, instead of being dumped into
the entire backlog at once.

## Overview

The interval review loads the learner's whole due backlog into a single session.
For an advanced learner with a large backlog, the review entry «Начать повторение
[N]» starts all N cards (e.g. 900) at once — overwhelming, with no way to do a
focused batch. Feature 006 already orders the queue weakest/most-overdue first;
this feature lets the learner pick **how many** to do now. A small session-size
selector (20 / 50 / Все, default 20) sits by the review button; the choice caps the
session **after** the 006 ordering, so a capped session always covers the
highest-need cards. «Все» keeps today's no-cap behavior. Because the learner picks
the size, nothing contradicts the [N] count on the button.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Focused review batch (Priority: P1)

A learner with a large due backlog picks a session size (e.g. 20) and reviews that
many of the most-needed cards, instead of facing the entire backlog.

**Why this priority**: The single-giant-session is the core at-scale pain; letting
the learner choose a batch size makes review usable beyond ~50 due.

**Independent Test**: With many due cards, choose a size of 20 and start review;
confirm the session contains 20 cards and they are the highest-need ones (by the
006 ordering).

**Acceptance Scenarios**:

1. **Given** more due cards than the chosen size, **When** the learner starts review
   with size 20, **Then** the session contains exactly 20 cards.
2. **Given** the capped session, **When** it is built, **Then** the 20 cards are the
   highest-need ones (weakest/most-overdue first, per 006) — the cap is applied
   after the ordering.
3. **Given** fewer due cards than the chosen size, **When** review starts, **Then**
   all due cards are shown (the cap does not pad or error).

---

### User Story 2 - "Все" and other modes unchanged (Priority: P2)

A learner who chooses «Все» reviews the full due set exactly as today; the new-word
and unused-target modes and FSRS scheduling/grading are unchanged.

**Why this priority**: The cap must be opt-in via the selector and must not regress
the full-review path or unrelated modes.

**Independent Test**: Choose «Все» → the full due set loads (no cap). Run the
new-word mode → unchanged.

**Acceptance Scenarios**:

1. **Given** «Все» is selected, **When** review starts, **Then** the entire due set
   is loaded (today's behavior, no cap).
2. **Given** the new-word or unused-target mode, **When** it runs, **Then** it is
   unchanged.
3. **Given** a review card is answered, **When** it is graded, **Then** FSRS
   scheduling is unchanged.

---

### Edge Cases

- **Due count below the chosen size**: show all due (no padding/error).
- **No size provided** (e.g. direct URL): default to the standard behavior — either
  the default size or no cap; defined so the quiz never crashes on a missing choice.
- **«Все» selected**: no cap (identical to pre-006-cap behavior, but still ordered).
- **Size selector with zero due**: unchanged "all reviewed" empty state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The practice review entry MUST offer an explicit session-size choice
  (options 20 / 50 / Все, default 20) adjacent to the review button.
- **FR-002**: Starting review with a numeric size MUST limit the session to that many
  due cards; «Все» MUST impose no cap.
- **FR-003**: The cap MUST be applied AFTER the feature-006 weakest/most-overdue-first
  ordering, so a capped session contains the highest-need cards.
- **FR-004**: If the due count is below the chosen size, ALL due cards MUST be shown
  (no padding, no error).
- **FR-005**: The change MUST be limited to the review (default) quiz mode and the
  practice review entry — the new-word and unused-target modes, FSRS
  scheduling/grading, and other screens MUST be unchanged.
- **FR-006**: Because the learner explicitly chooses the size, the practice «Начать
  повторение [N]» count MUST remain the true full due count (no silent contradiction).
- **FR-007**: New behavior MUST ship with automated tests (constitution Test-First):
  a numeric size caps the queue to that many highest-need cards; «Все»/no-limit loads
  the full due set unchanged.
- **FR-008**: New user-facing strings MUST be Russian (sizes/labels/default
  adjustable); documentation English.

### Key Entities *(include if feature involves data)*

- **Session size**: the learner's chosen number of review cards (or "all"); passed
  from the practice entry to the review quiz. No new persisted data required.
- **Review queue**: the due cards, ordered (006) then capped to the session size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a backlog larger than the chosen size, the review session contains
  exactly the chosen number of cards, and they are the highest-need ones.
- **SC-002**: «Все» loads the full due set (no cap), matching today's volume.
- **SC-003**: Below-size backlogs show all due cards without error.
- **SC-004**: New-word/unused-target modes, FSRS grading, and the practice [N] count
  are unchanged.

## Assumptions

- **Order from 006**: the review queue is already weakest/most-overdue-first; the cap
  is a post-ordering slice.
- **Default size**: 20 is a sensible default daily batch; the set of sizes and the
  default are adjustable.
- **No persistence needed**: the chosen size is passed per-session (e.g. via the
  review navigation); persisting a preference is out of scope.
- **Deferred from 004**: C-07/C-08 competency level + N3–N1 grammar (root-caused in
  the 004 analysis), C-12 MeCab fallback, C-14 landing remain out of scope.

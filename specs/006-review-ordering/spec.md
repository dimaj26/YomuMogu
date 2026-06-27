# Feature Specification: Prioritized Review Ordering

**Feature Branch**: `006-review-ordering`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Partial fix for 004 finding C-03 — the FSRS review quiz presents due
cards in a random order, so a learner with a large backlog may never reach the
cards that need it most. Order the review queue weakest/most-overdue first.

## Overview

When a learner starts an interval review, the quiz pulls all their due cards and
presents them in a **random** order. For a learner with a large review backlog,
random order means the most fragile cards (those forgotten most often, with the
weakest memory, and most overdue) are scattered through the session — a learner
who stops partway, or who simply tires, may never reach the cards that most need
review, while easy cards get reviewed first by chance. This feature orders the
review queue so the **cards most in need come first**, making every review session
(and every interrupted session) spend its effort where it matters most. It does
not limit how many cards are in the session (that decision is deferred — see
Assumptions) and changes nothing about scheduling, grading, or other quiz modes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Weakest, most-overdue cards come first (Priority: P1)

A learner with many due cards starts a review and the first cards shown are the
ones most in need — the cards they have lapsed on most, then the cards with the
weakest memory, then the cards that have been waiting the longest — so even a short
session tackles the highest-need cards.

**Why this priority**: This is the whole feature; for a large backlog, ordering by
need is what makes review effective when a learner can't (or won't) clear the
entire queue in one sitting.

**Independent Test**: With a set of due cards of differing lapse counts, memory
strengths, and overdue ages, start a review and confirm the first card shown is the
highest-need one by the defined ordering.

**Acceptance Scenarios**:

1. **Given** several due cards where one has clearly more lapses than the others,
   **When** the learner starts the review, **Then** that most-lapsed card is
   presented first.
2. **Given** due cards with equal lapses but differing memory strength, **When** the
   review starts, **Then** the weakest-memory card comes before stronger ones.
3. **Given** due cards with equal lapses and strength but different overdue ages,
   **When** the review starts, **Then** the most-overdue card comes first.

---

### User Story 2 - Other quiz modes and scheduling are unaffected (Priority: P2)

A learner using the new-word reinforcement mode or the post-chat unused-target
mode, and the FSRS scheduling/grading after each answer, sees no change — only the
order of the interval-review queue changes.

**Why this priority**: The fix must be surgical; reordering review must not
regress new-word practice, the unused-target flow, or scoring/scheduling.

**Independent Test**: Run the new-word mode and confirm its selection/order is
unchanged; answer a review card and confirm grading/scheduling behaves as before.

**Acceptance Scenarios**:

1. **Given** the new-word reinforcement mode, **When** the learner starts it,
   **Then** its card selection and order are unchanged from today.
2. **Given** a review card is answered, **When** it is graded, **Then** FSRS
   scheduling and the rest of the quiz behave exactly as before.

---

### Edge Cases

- **All due cards identical** (same lapses/strength/due): order is stable and the
  session still works (ties broken deterministically; no crash, no duplicates).
- **Single due card**: presented as the only card (ordering is a no-op).
- **No due cards**: unchanged "all reviewed" empty state.
- **Large backlog**: the whole due set is still loaded (no cap in this feature);
  only its order changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The interval-review queue MUST be ordered so the highest-need cards
  come first, using this priority: (1) more lapses first, then (2) weaker memory
  (lower stability) first, then (3) more overdue (earlier due) first.
- **FR-002**: The ordering MUST be deterministic (no random shuffle) so the same due
  set yields the same order, and ties resolve consistently.
- **FR-003**: The change MUST apply ONLY to the interval-review (default) mode of the
  quiz — the new-word reinforcement mode and the unused-target mode MUST be
  unchanged.
- **FR-004**: FSRS scheduling, answer grading, hints, and all other quiz behavior
  MUST be unchanged.
- **FR-005**: This feature MUST NOT limit the number of cards in a review session
  (no cap) — it only reorders the existing due set (the practice screen's
  «Начать повторение [N]» count stays accurate).
- **FR-006**: The new behavior MUST ship with an automated test (constitution
  Test-First) asserting the highest-need due card is presented first.
- **FR-007**: No user-facing strings change; documentation is English.

### Key Entities *(include if feature involves data)*

- **Due card**: an existing review card (status not new, due in the past) with the
  attributes used for ordering — lapse count, memory strength (stability), and due
  time. No new data is introduced.
- **Review queue**: the ordered list of due cards presented in the session; this
  feature changes only its ordering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any due set, the first card presented is the one ranked highest by
  (lapses desc, stability asc, due asc) in 100% of runs (deterministic).
- **SC-002**: The same due set produces the same order on repeated runs (no
  randomness).
- **SC-003**: New-word and unused-target modes, and FSRS grading/scheduling, are
  unchanged (no regression in their existing tests).
- **SC-004**: The full due set is still presented (count unchanged); only order
  differs.

## Assumptions

- **No session cap here**: limiting session size and/or a user-facing session-size
  selector is intentionally **deferred** — a silent cap would contradict the
  practice screen's «Начать повторение [N]» count and needs a product decision.
  This feature only reorders.
- **Ordering keys exist**: due cards already carry lapse count, stability, and due
  time (existing FSRS state); no schema change is needed.
- **Deferred from 004**: C-07 (competency-engine level / balance widget N5) and
  C-08 (JLPT level unlocking + missing N3–N1 grammar) remain out of scope.

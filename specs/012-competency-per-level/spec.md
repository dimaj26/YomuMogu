# Feature Specification: Competency Level Reflects Real Per-Level Coverage

**Feature Branch**: `012-competency-per-level`

**Created**: 2026-06-28

**Status**: Implemented

**Input**: Fix 004 findings C-07 (balance widget stuck at «N5») and C-08 (JLPT level
path stuck/locked) — both caused by the competency engine computing coverage for N5
only. Compute coverage for all levels and derive the learner's real working level
using the rules the app already defines.

## Overview

The app shows the learner's progress through JLPT levels (N5→N1) on the learning
track and labels the practice "balance" widget with their current level. Today both
are stuck: the balance widget always says «N5» and the level path shows N4–N1 as
permanently locked — even for an advanced learner with thousands of words — because
the competency engine only ever measures the learner's coverage of N5. The level
path's own unlock rule (a level is "completed" at high vocabulary + full grammar
coverage) already exists and is correct; it simply never receives coverage data for
N4–N1. This feature computes coverage for **all** levels and derives the learner's
real active level, so the widget and the path reflect reality — N5→N4 unlock as the
learner completes them, and the higher levels honestly show as in-progress (the app
has no N3–N1 grammar content yet, so those can't be "completed" — which the path now
surfaces truthfully instead of a false «N5»).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Advanced learner sees their real level (Priority: P1)

A learner who has progressed beyond N5 sees the balance widget and the learning
track reflect their **actual** working level, not a permanent «N5».

**Why this priority**: Mislabeling every learner as N5 makes the level system
meaningless and demotivating for anyone past the beginning — the core defect.

**Independent Test**: With a learner who has completed N5 (and N4), view the balance
widget and learning track; confirm the active level is the first not-yet-completed
level (e.g. N3), not N5.

**Acceptance Scenarios**:

1. **Given** a learner who meets the existing completion rule for N5 and N4, **When**
   they view the practice balance widget and the learning track, **Then** their
   active level is shown as the first not-yet-completed level (N3), and N5/N4 show as
   completed.
2. **Given** the learning track, **When** the learner has coverage across multiple
   levels, **Then** each level's status (completed / active / locked) reflects that
   level's real coverage, not a single hardcoded level.

---

### User Story 2 - Beginner and regression unchanged (Priority: P1)

A new or N5 learner still sees N5 as their active level; nothing about the existing
N5 experience regresses.

**Why this priority**: The fix must not move a genuine beginner off N5 or break the
existing N5-only behavior/tests.

**Independent Test**: With a learner who has only N5 progress (or none), confirm the
active level is N5 as before.

**Acceptance Scenarios**:

1. **Given** a learner with only N5 coverage (or an empty deck), **When** they view
   the widget/track, **Then** the active level is N5 (unchanged).
2. **Given** the existing competency outputs used elsewhere, **When** the engine
   runs, **Then** previously-relied-on values still behave (no breaking change).

---

### Edge Cases

- **No N3–N1 grammar content**: higher levels can reach high vocabulary coverage but
  never "complete" (grammar coverage stays 0 there) — they honestly show as the
  in-progress / active level at the content wall, not falsely completed or falsely
  locked. This truthfully surfaces the content gap.
- **All levels complete** (hypothetical): the active level is the top level; no crash.
- **Empty / new deck**: active level is N5 (the start), nothing completed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST compute the learner's vocabulary and grammar coverage
  for **all five JLPT levels** (N5–N1), using the same per-level coverage definitions
  the app already uses for N5.
- **FR-002**: The learner's active level MUST be derived as the first level not yet
  "completed" by the app's **existing** completion rule (high vocabulary coverage AND
  full grammar coverage), with no new thresholds introduced.
- **FR-003**: The practice balance widget MUST display this derived active level
  (not a hardcoded «N5»).
- **FR-004**: The learning-track level path MUST receive coverage for all levels so
  each node's completed/active/locked status reflects that level's real coverage.
- **FR-005**: A beginner / N5-only learner MUST still show N5 as active (no regression
  to the existing N5 experience), and existing competency outputs relied on elsewhere
  MUST keep behaving (extend, don't break).
- **FR-006**: The feature MUST NOT change FSRS, chat grammar-scoping, or the
  completion thresholds, and MUST NOT author N3–N1 grammar content.
- **FR-007**: New behavior MUST ship with automated tests (constitution Test-First):
  per-level coverage computed for all levels; active level = first non-completed by
  the existing rule (e.g. N5+N4 complete → active N3); N5-only → N5 (regression).
- **FR-008**: User-facing strings are unchanged (the level label already exists);
  documentation English.

### Key Entities *(include if feature involves data)*

- **Per-level coverage**: for each JLPT level, the learner's vocabulary coverage and
  grammar coverage (already computable per level today). No new data.
- **Active level**: the derived first-not-completed level; drives the balance widget
  label and the learning-track active node.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a learner who has completed N5 and N4, the active level shown is N3
  (not N5) on both the balance widget and the learning track.
- **SC-002**: An N5-only / new learner still shows N5 (no regression).
- **SC-003**: The learning track's per-level statuses reflect real per-level coverage.
- **SC-004**: No change to FSRS, chat grammar-scoping, thresholds, or grammar content.

## Assumptions

- **Existing rules are the policy**: the completion thresholds (high vocabulary AND
  full grammar coverage) already encode the leveling policy; this feature only
  applies them across all levels rather than N5 alone. No new pedagogy decision.
- **Content gap is surfaced, not filled**: because no N3–N1 grammar exists yet, those
  levels remain "in progress" — intended and honest; authoring that curriculum is a
  separate future effort.
- **Deferred from 004**: C-12 MeCab fallback (infrastructure) remains out of scope.

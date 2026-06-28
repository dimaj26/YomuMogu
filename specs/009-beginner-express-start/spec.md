# Feature Specification: Beginner Express-Start in the Diagnostic

**Feature Branch**: `009-beginner-express-start`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Fix 004 finding C-11 — the diagnostic asks the learner to mark words they
already know, but an absolute beginner who knows none has no obvious action; saving
with nothing marked is correct yet non-obvious. Add an explicit "I'm starting from
zero" express path.

## Overview

The knowledge diagnostic asks «Отметьте слова, которые вы уже хорошо знаете» and
offers «Сохранить и начать». For an absolute beginner who knows zero of the shown
N5/N4 words, the right action is to save with nothing marked — but that is not
obvious; a newcomer may hesitate, unsure whether they're expected to recognize
these words. This feature adds a clearly-labelled express button («Я начинаю с
нуля») that does exactly the no-knowledge save — seed the starter deck with all
words new — so a complete beginner has an unambiguous one-click start. It is purely
additive; existing controls are unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete beginner starts in one click (Priority: P1)

An absolute beginner opening the diagnostic sees an explicit option to start from
zero and uses it to seed their deck (everything new) without having to deduce that
"save with nothing checked" is the right move.

**Why this priority**: The absolute beginner is the core target user; an
unobvious-correct-action at the very first gate adds avoidable friction.

**Independent Test**: Open the diagnostic, click the express "start from zero"
button, and confirm the starter deck is seeded with all words new and the flow
proceeds (the same as a save-with-nothing-selected).

**Acceptance Scenarios**:

1. **Given** the diagnostic is open, **When** the learner clicks the express
   "start from zero" button, **Then** the starter deck is seeded (words present),
   all words are new, and the post-save flow proceeds (same as save-with-nothing).
2. **Given** the express path, **When** it runs, **Then** it behaves identically to
   «Сохранить и начать» with no words checked.

---

### User Story 2 - Existing controls unchanged (Priority: P2)

A learner who does want to mark known words still uses «Сохранить и начать» exactly
as before, and «Отмена»/«Закрыть» are unchanged.

**Why this priority**: The fix must be additive only; the triage path and dismissal
must not regress.

**Independent Test**: Mark some words and use «Сохранить и начать»; confirm the
checked words are imported as known and the rest as new, as today.

**Acceptance Scenarios**:

1. **Given** some words are checked, **When** «Сохранить и начать» is used, **Then**
   behavior is unchanged (checked → known, rest → new).
2. **Given** the diagnostic, **When** «Отмена» or «Закрыть» is used, **Then** it
   behaves as today.

---

### Edge Cases

- **Starter deck still loading**: the express button is disabled until the deck is
  available (same guard as «Сохранить и начать»), avoiding an empty import.
- **Express used after some words were checked**: the express path ignores checks
  and starts everything new (it is explicitly "from zero"); this is intended.
- **Re-running the diagnostic on an initialized deck**: existing import semantics
  apply (words already advanced are not reset); the express path imports with an
  empty known-set, matching today's additive import.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The diagnostic MUST offer an explicit express action labelled for a
  complete beginner (e.g. «Я начинаю с нуля») that seeds the starter deck with NO
  words marked as known (all new) and then proceeds via the same post-save flow.
- **FR-002**: The express action MUST be behaviorally identical to «Сохранить и
  начать» with nothing checked (same import call with an empty known-id set, same
  completion callback).
- **FR-003**: The change MUST be purely additive — «Сохранить и начать» (checked →
  known), «Отмена», and «Закрыть» MUST be unchanged.
- **FR-004**: The express action MUST be unavailable while the starter deck is still
  loading (same guard as the existing save), so it cannot trigger an empty import.
- **FR-005**: No FSRS/scheduling/schema change and no change to other screens.
- **FR-006**: New behavior MUST ship with an automated test (constitution
  Test-First) asserting the express button seeds the deck (words present, all new)
  and invokes the completion callback.
- **FR-007**: New user-facing string MUST be Russian (wording adjustable); docs English.

### Key Entities *(include if feature involves data)*

- **Known-word set**: the set of words the learner marks as already known; the
  express path uses an empty set (nothing known). No new data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A complete beginner can seed their deck from the diagnostic in one
  explicit click, without marking anything.
- **SC-002**: The express path yields a deck where all words are new (none marked
  known) and the flow proceeds, identical to save-with-nothing.
- **SC-003**: The existing save (with checks), cancel, and close behaviors are
  unchanged.
- **SC-004**: No FSRS/schema/other-screen change.

## Assumptions

- **Same import path**: the express action reuses the existing starter-deck import
  with an empty known-set; no new persistence logic.
- **Placement**: the express button sits alongside the existing footer actions; exact
  label/wording is an adjustable default.
- **Deferred from 004**: C-03 cap/selector, C-07/C-08 competency level + N3–N1
  grammar, C-12 MeCab fallback, C-14 landing, C-15 debug HUD remain out of scope.

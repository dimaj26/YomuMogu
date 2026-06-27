# Feature Specification: Memory Map Scales to the Real Deck

**Feature Branch**: `005-memory-map-scale`

**Created**: 2026-06-28

**Status**: Implemented (2026-06-28)

**Input**: Fix 004 finding C-02 — the home "Очаги памяти (Сетка Кумико)" heatmap
is hardcoded to the first 500 words, so a learner with a larger deck sees only a
fraction of their vocabulary and a wrong count. Make the map represent the whole
deck and state the real word count.

## Overview

The home dashboard's memory-map heatmap is meant to reflect the learner's whole
vocabulary at a glance. Today it always buckets exactly the first 500 words (50
cells × 10 words) and its caption hardcodes "500 слов". A learner whose deck is
larger than 500 (e.g. an advanced learner with thousands of words) sees only the
first ~12.5% of their deck represented, ordered by insertion, and a caption that
misstates how much they actually have. This feature makes the heatmap bucket the
**entire** deck across its 50 cells and makes the caption reflect the **actual**
word count — without changing scheduling, the 50-cell visual, or any other screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Advanced learner sees their whole vocabulary represented (Priority: P1)

A learner whose deck is larger than 500 words opens the home dashboard and the
memory map represents their entire deck across the grid, with a caption that states
their real word count — instead of silently showing only the first 500.

**Why this priority**: This is the entire fix; a memory map that hides ~88% of an
advanced learner's deck and misstates the count is misleading on the primary
dashboard.

**Independent Test**: With a deck of more than 500 words, view the home map; confirm
the grid's buckets collectively cover the whole deck and the caption shows the real
total (not "500").

**Acceptance Scenarios**:

1. **Given** a deck larger than 500 words, **When** the learner views the home
   memory map, **Then** the 50 cells collectively represent all of the deck's words
   (no words beyond the first 500 are silently dropped) and the caption states the
   actual word count.
2. **Given** a deck of exactly the 500-word starter size, **When** the learner views
   the map, **Then** behavior matches today (50 cells of 10 words; caption states
   500).

---

### User Story 2 - Smaller and uninitialized decks still read correctly (Priority: P2)

A learner with fewer than 500 words, or an uninitialized deck, sees a caption that
matches their real state and a grid that doesn't misrepresent empty space.

**Why this priority**: The count must be honest in both directions, and the
feature-003 uninitialized messaging must be preserved.

**Independent Test**: View the map with (a) an uninitialized deck and (b) a small
initialized deck; confirm the captions are correct in each case.

**Acceptance Scenarios**:

1. **Given** an uninitialized local deck, **When** the learner views the map,
   **Then** the caption still says the deck is not initialized and points to the
   diagnostic (feature-003 behavior unchanged).
2. **Given** an initialized deck smaller than 500 words, **When** the learner views
   the map, **Then** the caption states that real (smaller) count rather than "500".

---

### Edge Cases

- **Deck size not a multiple of 50**: buckets distribute as evenly as possible; the
  last/edge buckets may hold fewer words, and no word is omitted.
- **Very large deck (thousands)**: the grid still shows 50 aggregate cells; each
  cell summarizes a proportional slice of the deck (the visual stays 50 cells).
- **Empty / uninitialized deck**: unchanged feature-003 uninitialized caption; no
  divide-by-zero or misleading "0 words across 50 cells" wording.
- **Exactly 500 words**: identical to today (regression guard).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home memory-map heatmap MUST bucket the learner's entire deck
  across its fixed set of cells, so that no words beyond the first 500 are silently
  excluded from the map.
- **FR-002**: Each cell MUST summarize a proportional slice of the whole deck
  (bucket size derived from the real total), preserving the existing per-cell
  status/stability aggregation semantics.
- **FR-003**: The map's caption MUST reflect the learner's actual total word count
  rather than a hardcoded "500".
- **FR-004**: When the local deck is not initialized, the caption MUST retain the
  feature-003 "not initialized → run diagnostic" messaging (unchanged).
- **FR-005**: The change MUST be limited to the home memory map — scheduling/FSRS,
  the number of cells in the visual, and all other screens MUST be unchanged.
- **FR-006**: The new behavior MUST ship with an automated test (constitution
  Test-First), covering large (>500), exactly-500, small (<500), and uninitialized
  decks.
- **FR-007**: New/changed user-facing strings MUST be Russian; documentation English.

### Key Entities *(include if feature involves data)*

- **Deck word set**: the learner's words for the active profile (existing data); its
  size drives both the bucketing and the caption count. No new data is introduced.
- **Heatmap cell**: one of the fixed grid cells; now summarizes a proportional slice
  of the whole deck rather than a fixed 10-word window.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a deck of N > 500 words, 100% of the deck's words are accounted for
  across the grid's cells (none dropped), and the caption shows N.
- **SC-002**: For a 500-word deck, the map and caption are unchanged from current
  behavior (no regression).
- **SC-003**: For an uninitialized deck, the caption is the feature-003
  not-initialized message (no regression).
- **SC-004**: A learner can read their true vocabulary size from the home map
  caption regardless of deck size.

## Assumptions

- **Fixed 50-cell visual**: the grid keeps its current cell count; only the mapping
  of words→cells and the caption change (confirmed in scope).
- **Aggregation semantics preserved**: per-cell dominant-status and average-stability
  logic stays the same, applied to the proportional slice.
- **Deferred (out of scope)**: 004 findings C-03 (review session-sizing/filtering),
  C-07 (competency-engine level / balance widget showing N5), and C-08 (JLPT level
  unlocking + missing N3–N1 grammar content) are larger/architectural and are not
  part of this feature.

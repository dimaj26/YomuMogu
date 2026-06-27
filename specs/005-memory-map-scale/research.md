# Phase 0 Research: Memory Map Scales to the Real Deck

No `NEEDS CLARIFICATION` remained. Decisions:

## Decision 1 — Dynamic bucket over the whole deck (keep 50 cells)

- **Decision**: Bucket size = `Math.max(1, Math.ceil(words.length / 50))`; cell *k*
  summarizes `words.slice(k*bucket, (k+1)*bucket)`. The 50-cell visual is unchanged.
- **Rationale**: Keeps the familiar Kumiko grid while making it represent the whole
  deck (no words dropped). `Math.max(1, …)` prevents a zero bucket for tiny/empty
  decks. For exactly 500 words bucket=10 → identical to today (regression-safe).
- **Alternatives considered**: Growing the cell count with deck size (rejected —
  changes the visual, out of scope). Showing only due/active words (rejected — the
  map is a whole-deck overview).

## Decision 2 — Caption shows the real count, keep "стартовой колоды" phrasing

- **Decision**: Initialized caption = «50 ячеек отображают состояние {N} слов вашей
  стартовой колоды. …» where N = the size of the same word set the cells are built
  from. Uninitialized caption = unchanged feature-003 text.
- **Rationale**: The local deck *is* the starter deck (category `__local_starter__`),
  so the phrasing stays accurate; only the number becomes truthful. For N=500 the
  text is identical to today.
- **Alternatives considered**: Rewording to "вашей колоды" (rejected — unnecessary
  churn; "стартовой" is still correct for the local deck).

## Decision 3 — Pass the count into MemoryDecayHeatmap

- **Decision**: `MemoryDecayHeatmap` currently takes only `cells`; pass the real
  total word count as a prop (computed in the parent from the same `db.words` read
  that builds the cells) so caption and grid are derived from one source.
- **Rationale**: Avoids a second divergent count; keeps caption and grid consistent
  (the bug was exactly a hardcoded count diverging from reality).
- **Alternatives considered**: Recomputing the count inside the component with a
  separate query (rejected — duplicate read, risk of divergence).

## Decision 4 — Extend the existing co-located test (Test-First)

- **Decision**: Update `home-grid.test.tsx`: change the seeded assertion to the
  dynamic count and add cases — large (>500: all words represented, caption N),
  exactly 500 (regression: caption 500), small (<500: caption N), uninitialized
  (feature-003 text).
- **Rationale**: The suite already mocks the data layer (fake-indexeddb) and renders
  Home; extending it is the natural home for this behavior.
- **Alternatives considered**: A new test file (rejected — duplicates setup).

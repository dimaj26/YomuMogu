# Phase 0 Research: Prioritized Review Ordering

No `NEEDS CLARIFICATION` remained. Decisions:

## Decision 1 — Deterministic "highest-need first" comparator

- **Decision**: Order review-mode due cards by `lapses` desc, then `stability` asc,
  then `due` asc (most forgotten → weakest memory → most overdue first). Replace the
  random shuffle in the review branch only.
- **Rationale**: These three are the standard signals of a fragile card; putting
  them first ensures a short or interrupted session spends effort where it matters.
  Deterministic order (no `Math.random`) makes behavior predictable and testable and
  keeps a resumed session consistent.
- **Alternatives considered**: Keep random (rejected — the bug). Order purely by
  `due` (rejected — ignores fragility: a long-overdue easy card would outrank a
  freshly-due lapsed one). Order by a single FSRS "retrievability" score (rejected —
  not readily available here; the three-key sort is transparent and sufficient).

## Decision 2 — Review mode only; other modes untouched

- **Decision**: Apply the comparator only in the review (default) branch. The `new`
  reinforcement mode keeps its `id`-sorted + quota slice; the unused-target mode
  keeps its behavior. The shared shuffle line is replaced with mode-aware ordering.
- **Rationale**: Scope discipline (FR-003) — new-word order and the post-chat flow
  are out of scope and have their own tests.
- **Alternatives considered**: Apply weakest-first everywhere (rejected — changes
  unrelated modes and their tests).

## Decision 3 — No session cap (deferred)

- **Decision**: Load the full due set as today; only reorder. No cap, no selector.
- **Rationale**: A silent cap would contradict the practice screen's
  «Начать повторение [N]» count (a new inconsistency) and needs a product decision.
  Reordering is a pure, no-regret improvement that stands alone.
- **Alternatives considered**: Cap to a default batch (deferred — needs count
  reconciliation/UX decision); cap + selector (deferred — larger feature).

## Decision 4 — Extend the existing quiz test (Test-First)

- **Decision**: Add a case to `quiz/__tests__/page.test.tsx`: seed ≥3 due cards with
  distinct translations and differing lapses/stability/due; in default (review)
  mode, assert the highest-need card's prompt renders first and a lower-need card is
  not yet shown.
- **Rationale**: The suite already mocks router/searchParams and seeds `db.words`;
  extending it is the natural home and proves determinism.
- **Alternatives considered**: A pure unit test of an extracted comparator (rejected
  for now — the sort is inline; extracting is unnecessary churn, though a future
  refactor could move it to a tested helper).

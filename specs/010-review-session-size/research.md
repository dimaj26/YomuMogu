# Phase 0 Research: Review Session-Size Selector

No `NEEDS CLARIFICATION`. Decisions:

## Decision 1 — Selector + URL limit, cap after the 006 ordering

- **Decision**: A practice-side selector (20/50/Все, default 20) passes the choice
  as `&limit=N` to the review quiz; the quiz caps the due queue with `slice(0, N)`
  **after** the feature-006 weakest/most-overdue-first sort. «Все» → no `limit` → no cap.
- **Rationale**: Slicing the already-ordered queue guarantees the cap keeps the
  highest-need cards (FR-003). Passing via URL needs no persistence and reuses the
  quiz's existing `useSearchParams`. The explicit choice keeps the practice `[N]`
  count truthful — no silent contradiction (FR-006).
- **Alternatives considered**: Silent default cap (rejected — would contradict the
  `[N]` button count without the learner choosing). Persisting a preference (deferred
  — out of scope; per-session URL is simpler). Capping before sort (rejected — would
  drop the most-needed cards).

## Decision 2 — Scope: review mode + practice entry only

- **Decision**: Only the review (default) quiz branch caps; `new`/unused-target
  branches and FSRS grading are untouched. The selector lives by the practice review
  button.
- **Rationale**: Surgical (FR-005); other modes have their own selection logic/tests.

## Decision 3 — Defaults and robustness

- **Decision**: Default size 20; sizes {20, 50, Все}. A missing/invalid `limit` →
  no cap (full set), so a direct `/practice/quiz?mode=review` URL behaves as today.
- **Rationale**: 20 is a sane daily batch; robust default avoids crashes on direct
  navigation. Sizes/default are adjustable (FR-008).

## Decision 4 — Tests (Test-First)

- **Decision**: Quiz tests: seed > N due cards (distinct, with the 006 ordering keys),
  mock `limit=N` → exactly N cards and the first is the highest-need; mock no limit →
  full due set. Mirrors the existing quiz suite (router/searchParams mocked, `db.words`
  seeded).
- **Rationale**: Proves the cap count, the after-sort property, and the «Все» path.

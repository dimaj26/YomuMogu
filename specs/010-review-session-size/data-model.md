# Phase 1 Data Model: Review Session-Size Selector

No schema change. Existing data only.

## Session size (transient)

| Aspect | Detail |
|--------|--------|
| Source | Practice selector (`reviewLimit`: 20 / 50 / 'all', default 20). |
| Transport | `&limit=N` query param on the review navigation (`/practice/quiz?mode=review&limit=N`); «Все» omits `limit`. |
| Consumer | Quiz review branch: `searchParams.get('limit')` → positive integer → cap; else no cap. |
| Persistence | None (per-session). |

## Review queue (order + cap)

| Step | Rule |
|------|------|
| Membership | due cards (status ≠ new, due ≤ now) — unchanged. |
| Order | weakest/most-overdue first (feature 006) — unchanged. |
| Cap | if `limit` is a positive integer → `ordered.slice(0, limit)`; else full set. |
| Below-size | `slice` returns all available (no padding/error). |

No new persisted fields.

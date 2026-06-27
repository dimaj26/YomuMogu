# Phase 1 Data Model: Prioritized Review Ordering

No schema change. Existing data only.

## Due card (existing `LocalWord.active`)

A review card already carries the ordering keys:

| Field | Role in ordering |
|-------|------------------|
| `active.lapses` | Primary key — more lapses = more forgotten = higher need (desc). |
| `active.stability` | Secondary — lower stability = weaker memory = higher need (asc). |
| `active.due` | Tertiary — earlier due = more overdue = higher need (asc). |
| `active.status` | Selection filter (already): not `new` and `due <= now`. Unchanged. |

## Review queue (ordering only)

| Aspect | Rule |
|--------|------|
| Membership | unchanged: all due cards (status ≠ new, due ≤ now). |
| Order | `lapses` desc → `stability` asc → `due` asc (deterministic). |
| Size | unchanged (no cap). |
| Other modes | `new` / unused-target ordering unchanged. |

Comparator (conceptual):

```
sort by:
  b.active.lapses - a.active.lapses      // more lapses first
  || a.active.stability - b.active.stability  // weaker memory first
  || a.active.due - b.active.due         // more overdue first
```

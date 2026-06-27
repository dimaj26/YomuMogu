# Phase 1 Data Model: Honest Review Feedback on Day One

No schema change. Existing data only.

## Active-review message state (derived)

| Input (existing) | Source |
|------------------|--------|
| `dueActiveWordsCount` | already computed in practice page (words not-new, due ≤ now). |
| `hasActiveWords` (new derived bool) | `words.some(w => w.status === 'review' || w.status === 'learning')` over the already-loaded `words`. |

### Message selection

```
if dueActiveWordsCount > 0      -> "У вас есть N слов(а), готовых к повторению…"  (unchanged)
else if hasActiveWords          -> "Все активные слова повторены! Отличная работа." (unchanged praise)
else                            -> neutral "повторений пока нет — начните с разминки…" (new, day-one)
```

No new persisted fields; `hasActiveWords` is a render-time derivation.

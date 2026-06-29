# Phase 1 Data Model: First-Run "How It Works"

No schema change. Existing data only.

## Dashboard first-run state (existing)

| Aspect | Detail |
|--------|--------|
| Source | The home page's `dashState === 'first-run'` (deck not initialized), already used for the adaptive headline/CTA. |
| Drives | Visibility of the «Как это работает» block (shown iff first-run). |
| Change | None — the block lives inside the existing first-run branch. |

## "How it works" block (static content)

| Step | Text (factual, adjustable) |
|------|----------------------------|
| 1 | Короткая диагностика — подберём ваши слова. |
| 2 | Разминка и интервальные повторения (FSRS). |
| 3 | Практика слов в живом диалоге с ИИ-тьютором. |

No persisted fields; purely presentational, render-time only.

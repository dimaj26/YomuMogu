# Phase 1 Data Model: Memory Map Scales to the Real Deck

No schema change. Existing data only.

## Deck word set (existing)

The active profile's words, read via `db.words.where('profileId').equals(activeProfileId)`
(unchanged call). Its **length** now drives both the heatmap bucketing and the
caption count.

| Aspect | Detail |
|--------|--------|
| Source | `db.words` for the active profile (as today). |
| Size (N) | Total words; feeds bucket size and caption. |
| Change | Previously only the first 500 were mapped; now all N are distributed. |

## Heatmap cell (existing shape, new binning)

`{ status, isDue, avgStability }` per cell — unchanged shape and aggregation. Only
the **input slice** changes:

| Field | Rule |
|-------|------|
| bucket size | `Math.max(1, Math.ceil(N / 50))` |
| cell *k* input | `words.slice(k*bucket, (k+1)*bucket)` |
| empty cell | when a cell's slice is empty → existing `{ status:'new', isDue:false, avgStability:0 }` fallback |
| status / isDue / avgStability | unchanged per-cell aggregation over the slice |

## Caption (display)

| State | Text |
|-------|------|
| uninitialized (`!isLocalInit`) | feature-003 "not initialized → run diagnostic" (unchanged) |
| initialized | «50 ячеек отображают состояние **{N}** слов вашей стартовой колоды. …» (N = real total) |

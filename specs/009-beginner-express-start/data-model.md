# Phase 1 Data Model: Beginner Express-Start

No schema change. Existing data only.

## Known-word set (existing)

| Path | Known-id set passed to import | Result |
|------|-------------------------------|--------|
| «Сохранить и начать» (existing) | `checkedNewWordIds` (whatever is marked) | checked → mature/known, rest → new (unchanged). |
| «Я начинаю с нуля» (new) | `new Set()` (empty) | all starter words → new (createDefaultFsrsState). |

Both call `importStarterDeck(profileId, knownIds)` then `onSaved()`. The import is
additive (existing words with status ≠ new are not reset), so re-running is safe.
No new persisted fields.

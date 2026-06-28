# Phase 0 Research: Beginner Express-Start

No `NEEDS CLARIFICATION`. Decisions:

## Decision 1 — Express = save-with-empty-known-set (reuse import)

- **Decision**: Add `handleStartFresh` that calls `importStarterDeck(profileId, new
  Set())` then `onSaved()`, wrapped in the same `isSaving`/try-catch/`onError` as
  `handleSave`. A footer button «Я начинаю с нуля» triggers it.
- **Rationale**: Behaviorally identical to «Сохранить и начать» with nothing checked
  (the already-correct beginner action), just made explicit. Reuses the existing
  additive import — zero new logic/data; safe and consistent.
- **Alternatives considered**: Auto-detect "beginner" and skip the modal (rejected —
  removes user agency / the diagnostic's purpose). A checkbox "I know none" (rejected
  — a one-click button is clearer than a meta-checkbox + save).

## Decision 2 — Same load guard; additive only

- **Decision**: Disable the express button while `starterDeckData.length === 0 ||
  isSaving` (identical to the save button). Leave «Сохранить и начать», «Отмена»,
  «Закрыть» untouched.
- **Rationale**: Prevents an empty import before the deck loads; keeps the change
  purely additive (FR-003/FR-004).

## Decision 3 — Test via the existing modal suite (Test-First)

- **Decision**: Extend `AssessmentModal.test.tsx` (real `importStarterDeck` +
  fakeIndexedDB, as today): wait for deck load, click «Я начинаю с нуля», assert
  `onSaved` called and `db.words` has LOCAL_DECK words all status 'new'.
- **Rationale**: Mirrors the existing save test; proves the express path seeds an
  all-new deck.

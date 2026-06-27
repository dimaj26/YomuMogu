# Phase 0 Research: Honest Review Feedback on Day One

No `NEEDS CLARIFICATION` remained. Decisions:

## Decision 1 — Three-way message from existing state

- **Decision**: Replace the binary `dueActiveWordsCount > 0 ? count : praise` with
  three branches: due>0 → count; else hasActiveWords → praise; else → neutral.
  `hasActiveWords = words.some(w => w.status === 'review' || w.status === 'learning')`.
- **Rationale**: The bug is conflating "no due cards because you caught up" with "no
  due cards because you never started". The review/learning presence is the exact
  discriminator and is already in the loaded `words`. Minimal, honest.
- **Alternatives considered**: Count reviews in the DB (rejected — extra query;
  status presence is sufficient and already loaded). Always show count incl. 0
  (rejected — loses the earned praise).

## Decision 2 — Neutral copy points to the existing warm-up/quiz

- **Decision**: Day-one message is a neutral Russian line that points to the warm-up
  (left block) / quiz — consistent with feature-003 onboarding guidance — not a new
  flow.
- **Rationale**: Keeps the learner on the established path (diagnose → warm-up →
  quiz → review) without inventing UI.
- **Alternatives considered**: A CTA button (rejected — the warm-up CTA is already
  adjacent; a sentence suffices and stays minimal).

## Decision 3 — Scope: this one message only

- **Decision**: Change only the active-review card's no-due message. The due-count
  message, the review button, counts, FSRS, and other screens are untouched.
- **Rationale**: Surgical fix (FR-005); avoids regressions.

## Decision 4 — Extend the practice test suite (Test-First)

- **Decision**: Add three cases to `practice/__tests__/page.test.tsx`: all-new →
  neutral; review/learning-not-due → praise; due → count.
- **Rationale**: The suite already seeds `db.words` and renders practice; natural
  home; proves all three states.

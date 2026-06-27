# Contract: Onboarding Surface Copy/CTA States

Defines the required user-facing behavior of each touched surface, by state. Tests
(FR-007) assert these; the 002 walkthrough re-run validates them in the live app.
All visible strings are Russian (FR-008).

## Surface 1 — Conversation practice, empty state (`/chat`, `!session`) [F-02]

| State | Required behavior |
|-------|-------------------|
| No active session | Shows the empty state with a single primary action that **navigates to `/practice`** and is labelled to name that destination (e.g. «Перейти к практике»). It MUST NOT route to `/settings`. |

- Unchanged: the empty-state condition (`!session`) and the session-completion/exit
  routing elsewhere in the page.

## Surface 2 — Practice new-words card (`/practice`) [F-03]

| State | Required behavior |
|-------|-------------------|
| Local mode, **not initialized** (`deckMode === 'local' && !isLocalInitialized`) | A short explanatory line is visible near the warm-up action, telling the user to run the diagnostic, with a link/way to reach it (`/settings`). The warm-up button remains disabled (gate intact). |
| Local mode, **initialized**, no new words left today (daily limit) | The explanatory line is **absent**. The existing daily-limit messaging applies. The warm-up disabled-state reason is the daily limit, not onboarding. |
| Local mode, **initialized**, new words available | Explanatory line absent; warm-up button enabled (unchanged behavior). |

- The line MUST be conditioned on `!isLocalInitialized` specifically (not on
  `newWordsCount === 0`), so it never appears for an initialized deck (FR-003).

## Surface 3 — Home memory grid description (`/`) [F-04]

| State | Required behavior |
|-------|-------------------|
| **Not initialized** (`!isLocalInit`) | The grid description does NOT assert a populated "500 words" deck; it indicates the deck is not yet initialized and points to the diagnostic. |
| **Initialized** (`isLocalInit`) | The grid description reflects the seeded deck (the existing "состояние 500 слов…" wording). |

## Surface 4 — Architecture core-flow doc (`knowledge/architecture.md` [CP-2.1]) [F-01]

| Requirement | Detail |
|-------------|--------|
| Primary flow | The numbered core-user-flow is **local-first**: home/settings → «Пройти диагностику» → AssessmentModal seeds the local deck → `/practice` warm-up/quiz → session → `/chat`. |
| Anki path | Present as an explicitly-labelled **opt-in** branch, not step 1. |
| Self-consistency | No contradiction between the numbered steps and the surrounding prose. |

## Invariants (apply to all surfaces) [FR-006 / SC-005]

- [ ] No auto-seed of the starter deck.
- [ ] No new direct navigation into `/practice/quiz` or `/chat` from a fresh profile.
- [ ] A fresh profile still cannot reach quiz/chat without running the diagnostic.
- [ ] After the diagnostic seeds the deck, none of Surfaces 1–3 show "not
      initialized / run diagnostic" messaging.

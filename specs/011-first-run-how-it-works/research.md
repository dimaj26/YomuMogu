# Phase 0 Research: First-Run "How It Works"

No `NEEDS CLARIFICATION`. Decisions:

## Decision 1 — Static 3-step block inside the existing first-run branch

- **Decision**: Insert a compact «Как это работает» heading + 3 numbered steps inside
  the `dashState === 'first-run'` fragment, after the intro paragraph and before the
  CTA. The existing branch gates visibility — no extra condition.
- **Rationale**: The first-run branch is already the exact place that renders only
  for newcomers; reusing it guarantees the block is first-run-only (FR-003) with the
  minimal change. Static markup keeps it additive (FR-004).
- **Alternatives considered**: A separate component (over-engineering for 3 lines).
  A modal/tour (rejected — heavier; a static block is enough and non-blocking).

## Decision 2 — Factual steps mirroring the real flow

- **Decision**: (1) короткая диагностика → подберём ваши слова; (2) разминка +
  интервальные повторения (FSRS); (3) практика слов в живом диалоге с ИИ-тьютором.
- **Rationale**: Matches the actual onboarding funnel (diagnostic → warm-up/quiz →
  chat), so the preview is truthful, not marketing fluff. Wording adjustable (FR-006).
- **Alternatives considered**: Benefit-led marketing copy (rejected — the finding is
  about *what happens*, a factual preview, not more marketing).

## Decision 3 — Test in the Home suite (Test-First)

- **Decision**: Extend `home-grid.test.tsx`: first-run (no deck) → the «Как это
  работает» heading + step phrases present; initialized deck → absent.
- **Rationale**: That suite already renders Home with providers and toggles
  first-run via deck seeding; natural home; proves both visibility states.

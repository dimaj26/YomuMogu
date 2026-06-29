# Phase 0 Research: Competency Level Per-Level Coverage

No `NEEDS CLARIFICATION`. Decisions:

## Decision 1 — Reuse the existing completion rule + constants (no new thresholds)

- **Decision**: A level is "completed" iff `lexCoverage ≥ LADDER_COMPLETE_LEX_COVERAGE`
  (0.8) AND `grammarCoverage ≥ LADDER_COMPLETE_GRAMMAR_COVERAGE` (1.0) — the exact rule
  and constants `LearningTrack.isLevelCompleted` already uses. `deriveActiveLevel`
  returns the first non-completed level in N5→N1 order.
- **Rationale**: The leveling policy is already encoded in the codebase; the only bug
  is that coverage was never computed for N4–N1. Reusing the rule means **no pedagogy
  decision** and guarantees the balance widget + learning track agree. This is why
  the earlier "needs a decision" brief is superseded.
- **Alternatives considered**: A new lex-only threshold (rejected — invents a policy
  the app already has). Changing the constants (rejected — out of scope).

## Decision 2 — Compute coverage for all levels with existing helpers

- **Decision**: `computeAllLevelCoverages` loops the 5 levels calling the existing
  `computeLexCoverage(words, lvl)` and `computeGrammarCoverage(progressMap, lvl)`.
- **Rationale**: Those helpers already work per level (lex from `jlpt:nX`-tagged
  mature/review words; grammar from `grammar_progress` for that level's rules). No new
  computation logic.
- **Alternatives considered**: Caching/persisting coverages (rejected — compute on
  load as today; cheap).

## Decision 3 — Honest degradation at the N3–N1 grammar wall

- **Decision**: Because no N3–N1 grammar rules exist, `computeGrammarCoverage` returns
  0 there, so those levels never "complete" — a learner with high N3 vocabulary shows
  N3 as the **active** (in-progress) level, not falsely completed and not falsely
  «N5». No grammar content is authored.
- **Rationale**: This surfaces the content gap truthfully and motivates authoring it
  later, without fabricating curriculum now (FR-006). It's strictly more honest than
  today's hardcoded N5.
- **Alternatives considered**: Lex-only completion for N3+ (rejected — would mark
  levels "done" without the grammar the app's own rule requires; dishonest).

## Decision 4 — Keep `buildCompetencyProfile` intact; add helpers

- **Decision**: Add `computeAllLevelCoverages` + `deriveActiveLevel` as new exports;
  leave `buildCompetencyProfile`'s signature/behavior (and its tests) unchanged. The
  practice page uses the new helpers for `macroLadderProfile`; `buildCompetencyProfile`
  may still supply `recentCorrectionRate`/advice.
- **Rationale**: Non-breaking (FR-005); the v1 stub's `level: 'N5'` simply stops being
  the source of the displayed active level.

## Decision 5 — Tests (Test-First)

- **Decision**: Extend `profile.test.ts`: (a) `computeAllLevelCoverages` returns an
  entry per level with correct lex/grammar; (b) `deriveActiveLevel` → first
  non-completed (seed N5+N4 complete → 'N3'); (c) N5-only/empty → 'N5' (regression).
- **Rationale**: Pure-unit, deterministic, fast; proves the policy without rendering.

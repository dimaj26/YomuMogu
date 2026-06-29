# Phase 1 Data Model: Competency Level Per-Level Coverage

No schema change. Existing data + types only.

## Per-level coverage (existing types, fully populated)

`Partial<Record<JlptLevelId, LevelCoverage>>` where `LevelCoverage = { lexCoverage,
grammarCoverage }` (already defined in `LearningTrack.tsx`). Today only N5 is
populated; this feature populates all of N5–N1.

| Level | lexCoverage | grammarCoverage |
|-------|-------------|-----------------|
| N5 | `computeLexCoverage(words,'N5')` | `computeGrammarCoverage(progress,'N5')` (rules exist) |
| N4 | …'N4' | …'N4' (rules exist) |
| N3 | …'N3' | 0 (no rules → never completes) |
| N2 | …'N2' | 0 |
| N1 | …'N1' | 0 |

## Active level (derived)

| Rule | Value |
|------|-------|
| completion | level complete iff `lex ≥ 0.8` AND `grammar ≥ 1.0` (existing constants). |
| active | first level in N5→N1 order that is NOT complete. |
| all complete | `'N1'`. |
| none / empty | `'N5'`. |

Feeds `macroLadderProfile.activeLevelId` → BalanceWidget label + LearningTrack active
node. No persisted fields added.

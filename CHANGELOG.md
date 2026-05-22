# YomuMogu Changelog

All notable changes to the YomuMogu project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.0] - 2026-05-22
### Changed
- Integrated "Strict Sensei" mode rules into the conversational Gemini system prompts (`src/lib/gemini/prompts.ts`), adding behavior constraints for strict tone, no superficial praise, objective feedback, and topic adherence.
- Upgraded Japanese difficulty level instructions (1-5) in `src/lib/gemini/prompts.ts` to include simulated slow speech and level-appropriate vocabulary/complexity (short sentences for L1-L2, clear desu/masu for L3, advanced/fluent structures for L4-L5).

---

## [1.2.0] - 2026-05-22
### Added
- Root `CHANGELOG.md` for high-level version history and project change tracking.
- `CMD-4` command routing inside the `yomumogu-docs-update` skill to handle automated changelog updates.
- Operational constraint `[PL-8.12]` and coding rule `[CP-3.10]` mapping changelog update requirements.

### Changed
- Excluded `CHANGELOG.md` from the mandatory pre-read paths of daily Route A tasks to optimize token consumption and prevent context bloat.

---

## [1.1.0] - 2026-05-22
### Added
- Permanent diagnostic and sandbox script registry [scratch/SCRATCH_LOG.md](file:///c:/YomuMogu/scratch/SCRATCH_LOG.md) to track all temporary code and prevent residual resource pollution.
- Operational constraint `[PL-8.11]` and coding rule `[CP-3.9]` enforcing logging of all scratch files.
- Safe Anki Integration Testing Guidelines in `README.md` warning developers to use separate, unsynced Anki profiles.

### Fixed
- Residual test deck pollution issues by removing old hardcoded test references and implementing clean, isolated run guidelines.

---

## [1.0.0] - 2026-05-22
### Added
- Core bilateral synchronization between local Anki Desktop (AnkiConnect on port 8765) and client-side IndexedDB database (Dexie.js).
- Bilateral review sync coordinator with query deduplication and bulk fetching of card review histories.
- FSRS mathematical scheduler approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) to preserve pre-existing mature card intervals.
- Day boundary alignment shifting schedule resets to 4:00 AM local time matching Anki Desktop.

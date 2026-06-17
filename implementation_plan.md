# RNA-Blueprint — Chunk C (re-scoped): remove the dead `exposure_log` mining system

> Route A (RNA-1). Executor: **Claude (this agent)**.
> Scope: pure cleanup. Delete the isolated, non-functional `exposure_log` counter + its stub "часто встречались" card. Keep the already-working chat summary tap-to-add (`handleAddSingleWord`). Media tap-to-add and `addWord` dedup guard are **deferred to Chunk B** (not in scope here).
> Authorization: settled model `_nogit_roadmap.md` §2.6/§2.7.C + this session's three-agent necessity audit (exposure_log feeds nothing live; its "Add" button is a stub `alert`).

---

## 1. Base DNA (environment / runtime constraints)

- OS: Windows 10 / PowerShell.
- Stack: Next.js 16 App Router, TypeScript strict, React 19, Dexie.js (IndexedDB schema currently at **version(6)**, `exposure_log` introduced there). No new dependencies.
- Runtime: deletion only; one Dexie schema migration (v6 → v7) drops the table for existing users. All DB access stays behind the existing SSR guard.
- Verification tooling: `npm run test` (vitest, offline) **and** `npx tsc --noEmit` (vitest does NOT typecheck — this is the lesson from Chunk A, where a test-fixture type error slipped past green tests).

## 2. Task RNA (logic, risks, edge cases)

**Logic.** `exposure_log` is a closed, isolated loop: written only from chat (`recordExposure`, `chat/page.tsx:889`), read only by `getMiningCandidates`, surfaced only in one summary card whose "Add" button is a stub (`console.log` + `alert("в разработке")`, `chat/page.tsx:2048`). It does not feed FSRS, content recommendation, or word intake. Removing it loses zero live functionality and deletes a user-facing false promise.

**Note — this is a DELETION, not a bug-fix/feature.** Classic TDD red-first does not apply (no new behaviour to assert). The correctness gate is: full suite stays green, `tsc` clean, and a grep for every removed symbol returns zero references. The existing `exposureService.test.ts` is removed because it tests removed code.

**Risks & mitigations:**
- Dexie migration: a v7 with `exposure_log: null` drops the table on upgrade. Standard, low risk; no other table touched; the data was never consumed so loss is irrelevant. → add `this.version(7).stores({ exposure_log: null })`.
- Dangling type references: `ExposureEntry` is imported/re-exported in `db.ts:6,10` and the field `exposure_log!` declared at `db.ts:18`; the chat page imports the type at `:11`. → remove all; `tsc` will catch any miss.
- `EXPOSURE_STOPLIST` (exposureService.ts:6) has **no external consumers** (grep-confirmed) → deleted with the file. (Chunk B will define its own particle filter for media tap-to-add if needed.)
- Removing the stub card must not disturb the adjacent working blocks in the summary screen (the "unused target words quiz" card at `chat/page.tsx:2064` immediately follows). → surgical removal of lines 2036–2062 only.
- Interval Registry edit (`[PL-10]` СИСТЕМА 7): normally value changes need Route B; here we **remove a whole system**, authorized by the settled model decision (§2.6/§2.7) — not a value tweak.

**Edge cases:** existing users mid-session on v6 (migration handles silently); summary screen renders with no mining card (already conditional on `miningCandidates.length > 0`, so empty state is already handled).

## 3. Contextual Constraints (CC)

- **[CC-1] Dexie schema migration [PL-3.4]** — table removal via additive `version(7)`; never mutate an existing version block.
- **[CC-2] Interval Registry [PL-10 / CP-3.7]** — removing `EXPOSURE_MINING_THRESHOLD` / СИСТЕМА 7; authorized as a system removal per settled model, not a value change.
- **[CC-3] Module registry integrity [PL-2.2 / CP-3.7]** — deleting `exposureService.ts` (+ its test) requires CMD-1 doc sync.
- **[CC-4] Russian comments/logs/UI [CP-3.2]** — any touched code keeps Russian comments; this plan doc stays English.
- **[CC-5] Test coverage [CP-3.6]** — remove the test of removed code; suite must stay green; chat page test loses its exposure seeding/assertions.
- **[CC-6] No new dependencies [CP-3.1].**
- **[CC-7] dangerouslySetInnerHTML scope [PL-8.4]** — untouched (we only delete a card).

## 4. Proposed Changes (by component)

**Data layer**
- `src/core/exposureService.ts` `[DELETE]` — whole file (`recordExposure`, `getMiningCandidates`, `EXPOSURE_STOPLIST`).
- `src/core/db.ts` `[MODIFY]` — add `this.version(7).stores({ exposure_log: null })`; remove field `exposure_log!: Table<ExposureEntry>` (`:18`); remove `ExposureEntry` from the import (`:6`) and the `export type` (`:10`).
- `src/core/types.ts` `[MODIFY]` — remove `ExposureEntry` interface (`:85`).
- `src/core/intervals.ts` `[MODIFY]` — remove `EXPOSURE_MINING_THRESHOLD` + СИСТЕМА 7 comment (`:38-39`).

**UI**
- `src/app/chat/page.tsx` `[MODIFY]` — remove: imports (`:10` service, `:11` type), state `miningCandidates` (`:151`), the mining-load `useEffect` (`:273-286`), the `recordExposure` + `getMiningCandidates` block (`~:889`, `~:896` — read surrounding handler first, preserve the rest of the analysis flow), and the mining card (`:2036-2062`).

**Tests**
- `src/core/__tests__/exposureService.test.ts` `[DELETE]` — whole file.
- `src/app/chat/__tests__/page.test.tsx` `[MODIFY]` — remove `exposure_log` seeding (`:1372-1374+`) and any assertion on the "часто встречались" card.

**Docs (Route C / CMD — after code is green)**
- `PROJECT_LOGIC.md` `[MODIFY]` — drop registry rows `:327-328`, the `exposure_log` table block in [PL-3.4] `:558`, СИСТЕМА 7 row in [PL-10] `:841`.
- `CONTEXT_PROMPT.md` `[MODIFY]` — adjust the "Word Queue Science & Exposure Mining" feature line ([CP-2.2]).
- `CHANGELOG.md` `[MODIFY]` — new entry documenting removal.

## 5. Execution Steps (chunked 3–5; report after each chunk)

**Chunk 1 — data layer removal (steps 1–5):**
1. `[PL-3.4]` `db.ts`: add `version(7).stores({ exposure_log: null })`; remove `exposure_log!` field + `ExposureEntry` import/re-export. [CC-1]
2. `[PL-3.3]` `types.ts`: remove `ExposureEntry` interface.
3. `[PL-10]` `intervals.ts`: remove `EXPOSURE_MINING_THRESHOLD` + СИСТЕМА 7 comment. [CC-2]
4. `exposureService.ts` `[DELETE]`; `exposureService.test.ts` `[DELETE]`. [CC-3]
5. `npx tsc --noEmit` → expect errors ONLY from `chat/page.tsx` (still references removed symbols); confirms blast radius before touching UI.

→ **REPORT.**

**Chunk 2 — UI + test cleanup (steps 6–9):**
6. `[CP-3.8]` `chat/page.tsx`: remove imports, `miningCandidates` state, mining `useEffect`, the `recordExposure`/`getMiningCandidates` block (read handler context first), and the card `:2036-2062`. [CC-4][CC-7]
7. `[CP-3.6]` `chat/__tests__/page.test.tsx`: remove exposure seeding + mining-card assertions. [CC-5]
8. `npm run test` → all green; `npx tsc --noEmit` → 0 errors.
9. Grep gate: `recordExposure|getMiningCandidates|miningCandidates|EXPOSURE_MINING_THRESHOLD|EXPOSURE_STOPLIST|ExposureEntry|exposure_log|exposureService` → only CHANGELOG/PROJECT_LOGIC/CONTEXT_PROMPT (docs, handled next).

→ **REPORT.**

**Chunk 3 — docs + commit (steps 10–11):**
10. `[CMD-1/CMD-2/CMD-4]` Sync `PROJECT_LOGIC.md`, `CONTEXT_PROMPT.md`, `CHANGELOG.md` via `yomumogu-docs-update`. (Route C: no git ops mid-route.) [CC-3]
11. `[GW-1]` Local commit (include the still-uncommitted Chunk-A `tsc` fix in `scheduler.test.ts`). No push.

→ **REPORT.**

## 6. Verification & TDD reproducer

This is a deletion, so the gate is **regression-green + reference-clean**, not red-first:

**Automated:**
- `npm run test` → full suite green (count drops by the removed `exposureService.test.ts` cases; expect ~471 vs prior 474).
- `npx tsc --noEmit` → 0 errors (mandatory — vitest does not typecheck).
- Grep for all removed symbols → zero references in `src/` (docs handled in Chunk 3).

**Manual:**
1. Open a chat, finish a session, reach the summary screen → the "Часто встречались" card is gone; the unused-target-words quiz card and per-word "+" (`handleAddSingleWord`) still render and work.
2. Fresh load with an existing profile (was on Dexie v6) → app opens without error; `exposure_log` table dropped, other tables (`words`, `reviews`, `ui_words`, `grammar_progress`) intact and data preserved.

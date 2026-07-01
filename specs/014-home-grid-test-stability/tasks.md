# Tasks 014: home-grid test stability

Sequential — each task builds on the previous. One commit at the end (test-only change).

## Phase A — reproduce & confirm the mechanism

- [X] **T001** Confirm the cost driver before changing anything.
  1. Run the file in isolation, timed: `npx vitest run src/app/__tests__/home-grid.test.tsx` — expect green, note duration.
  2. Reproduce the load sensitivity: `npx vitest run` (full suite) 3–5× OR run the file with parallel pressure. Capture at least one timeout on the 500/550 case, OR confirm the isolated-vs-loaded duration gap.
  - **Accept**: written confirmation in the commit message / this file that the failure is a timeout under load, not a value mismatch. If it does NOT reproduce as a timeout, STOP and re-diagnose — the mock fix assumes perf, not pollution.
  - **Result**: isolated run 8/8 green, 14.46s. Full-suite run reproduced 3/3 — same test (`:87`, 500-word case) times out at ~35s wall-clock (25s configured timeout exhausted under worker contention), never a wrong value. Confirms timeout-under-load, not state pollution — proceed with the mock fix.

## Phase B — in-memory words-table mock

- [X] **T002** Add a reusable in-memory `db.words` mock and wire it into the file.
  1. Create a small helper (e.g. `src/test-utils/mockWordsTable.ts`, or colocated in the test file if cleaner) backing `db.words` with a plain array. Implement exactly the methods the code paths use — start with: `bulkPut(rows)`, `clear()`, and a chainable `where(field).equals(value)` returning an object with `.toArray()` and `.count()`. Comments in Russian.
  2. In `home-grid.test.tsx` replace real `@/core/db` usage with `vi.mock('@/core/db', () => ({ db: { words: <mock> } }))`. Keep `seedWords` writing through the mock's `bulkPut`; keep `beforeEach` `db.words.clear()`.
  3. Remove the now-dead in-file fake-indexeddb re-install (`:1-6`). Do NOT touch `vitest.setup.ts`.
  - **Accept**: `npx vitest run src/app/__tests__/home-grid.test.tsx` is green 8/8 and runs materially faster than the T001 isolated baseline. Any `not implemented` throw from the mock is resolved by adding that method (faithfully), not by weakening an assertion.
  - **Result**: colocated in the test file via `vi.hoisted` (module-scope const inside `vi.mock` factory needs hoisting). Gap found and closed: `JpUIProvider` also reads `db.ui_words` (`where().equals().toArray()/.put()/.delete()`), not just `db.words` — extended to a generic `createMockTable()` factory used for both tables (`toArray`, `count`, `delete`, `filter(pred)`). 8/8 green, 4.31s total (845ms test phase) — down from 14.46s isolated / ~35s under load.

- [X] **T003** Tighten timeouts to fail-fast.
  Lower the per-assertion/`it` timeouts in this file (25 s / 20 s / 12 s / 15 s / 30 s) to ≤5 s now that runtime is deterministic. Keep assertions unchanged.
  - **Accept**: file green with all timeouts ≤5 s.
  - **Result**: all 7 timeout occurrences (3× `it(..., N)`, 4× `{ timeout: N }`) lowered to 5000ms. 8/8 green, 4.00s total.

## Phase C — verify determinism & commit

- [X] **T004** Prove the flakiness is gone.
  1. Loop the FULL suite 20× and assert `home-grid.test.tsx` passes every time. PowerShell:
     `1..20 | ForEach-Object { npm run test 2>&1 | Select-String "home-grid" }` — or run `npx vitest run` 20× and confirm no failure in this file. (If 20× is too slow, 10× is the floor.)
  2. Confirm the rest of the suite is unaffected (same pass count as before, minus any pre-existing unrelated flakiness).
  - **Accept**: 0 failures of this file across the loop; full suite green.
  - **Result**: 20/20 full-suite runs, `home-grid.test.tsx` 0 failures. Unrelated pre-existing flakiness surfaced elsewhere (out of 014's scope, spec.md explicitly excludes it): `settings/page.test.tsx` "F5" case timed out 3/20 (fixed 5000ms `testTimeout`, unrelated file), `MediaInteractivePlayer.test.tsx` 1/20, `AssessmentModal.test.tsx` 1/20. Flagged separately below, not fixed here.

- [X] **T005** Commit (test-only).
  `test(home): de-flake home-grid via in-memory words mock (014, follows 013)`. Stage the test file, the mock helper, and `specs/014-**`. **Do not push** (explicit user approval required). The spec-sync guard is satisfied by the staged `specs/014-**` docs.
  - **Accept**: clean tree; spec.md Status → Implemented; all boxes above checked.
  - **Result**: no separate mock helper file was needed — mock colocated in the test file per plan's "or colocated" option (single consumer, no shared-surface risk).

## Fallback (only if T002 proves the mock leaky/low-fidelity)

Abandon the mock; instead move the 3 heavy cases to `home-grid.slow.test.tsx` and run
them under a non-parallel vitest project (`fileParallelism: false`) still reached by
`npm run test`. Verify vitest-4 actually removes cross-file contention for that project
before relying on it. Keep timeouts generous in that path. Document the switch in plan.md.

# Tasks 014: home-grid test stability

Sequential — each task builds on the previous. One commit at the end (test-only change).

## Phase A — reproduce & confirm the mechanism

- [ ] **T001** Confirm the cost driver before changing anything.
  1. Run the file in isolation, timed: `npx vitest run src/app/__tests__/home-grid.test.tsx` — expect green, note duration.
  2. Reproduce the load sensitivity: `npx vitest run` (full suite) 3–5× OR run the file with parallel pressure. Capture at least one timeout on the 500/550 case, OR confirm the isolated-vs-loaded duration gap.
  - **Accept**: written confirmation in the commit message / this file that the failure is a timeout under load, not a value mismatch. If it does NOT reproduce as a timeout, STOP and re-diagnose — the mock fix assumes perf, not pollution.

## Phase B — in-memory words-table mock

- [ ] **T002** Add a reusable in-memory `db.words` mock and wire it into the file.
  1. Create a small helper (e.g. `src/test-utils/mockWordsTable.ts`, or colocated in the test file if cleaner) backing `db.words` with a plain array. Implement exactly the methods the code paths use — start with: `bulkPut(rows)`, `clear()`, and a chainable `where(field).equals(value)` returning an object with `.toArray()` and `.count()`. Comments in Russian.
  2. In `home-grid.test.tsx` replace real `@/core/db` usage with `vi.mock('@/core/db', () => ({ db: { words: <mock> } }))`. Keep `seedWords` writing through the mock's `bulkPut`; keep `beforeEach` `db.words.clear()`.
  3. Remove the now-dead in-file fake-indexeddb re-install (`:1-6`). Do NOT touch `vitest.setup.ts`.
  - **Accept**: `npx vitest run src/app/__tests__/home-grid.test.tsx` is green 8/8 and runs materially faster than the T001 isolated baseline. Any `not implemented` throw from the mock is resolved by adding that method (faithfully), not by weakening an assertion.

- [ ] **T003** Tighten timeouts to fail-fast.
  Lower the per-assertion/`it` timeouts in this file (25 s / 20 s / 12 s / 15 s / 30 s) to ≤5 s now that runtime is deterministic. Keep assertions unchanged.
  - **Accept**: file green with all timeouts ≤5 s.

## Phase C — verify determinism & commit

- [ ] **T004** Prove the flakiness is gone.
  1. Loop the FULL suite 20× and assert `home-grid.test.tsx` passes every time. PowerShell:
     `1..20 | ForEach-Object { npm run test 2>&1 | Select-String "home-grid" }` — or run `npx vitest run` 20× and confirm no failure in this file. (If 20× is too slow, 10× is the floor.)
  2. Confirm the rest of the suite is unaffected (same pass count as before, minus any pre-existing unrelated flakiness).
  - **Accept**: 0 failures of this file across the loop; full suite green.

- [ ] **T005** Commit (test-only).
  `test(home): de-flake home-grid via in-memory words mock (014, follows 013)`. Stage the test file, the mock helper, and `specs/014-**`. **Do not push** (explicit user approval required). The spec-sync guard is satisfied by the staged `specs/014-**` docs.
  - **Accept**: clean tree; spec.md Status → Implemented; all boxes above checked.

## Fallback (only if T002 proves the mock leaky/low-fidelity)

Abandon the mock; instead move the 3 heavy cases to `home-grid.slow.test.tsx` and run
them under a non-parallel vitest project (`fileParallelism: false`) still reached by
`npm run test`. Verify vitest-4 actually removes cross-file contention for that project
before relying on it. Keep timeouts generous in that path. Document the switch in plan.md.

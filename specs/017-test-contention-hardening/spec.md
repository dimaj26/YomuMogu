# Feature 017: test-suite contention hardening (closes the 014→016 arc)

**Status**: Implemented | **Branch**: `017-test-contention-hardening` | **Source**: root-cause diagnosis + proposal-auditor (PA-1) verdict, 2026-07-02

## The real root cause (proven, not assumed)

Features 014–016 chased what looked like six independent flaky test files by
mocking `@/core/db` per file. That was **symptomatic**. A clean-machine
diagnostic settled it: the full suite ran **13/13 green** (8× at default
parallelism + 5× sequential) with nothing else competing for CPU.

The flakiness was **external CPU contention**, not a test defect:
- `vitest.config.ts` set no `poolOptions` → vitest forks workers across **all 16 cores**; default `testTimeout` = 5000 ms.
- graphify's `.husky/post-commit` **and** `.husky/post-checkout` auto-rebuild a 2300+ node graph — a heavy all-cores job — after every commit/checkout (log: `~/.cache/graphify-rebuild.log`).
- The session's commit/checkout-heavy workflow kept graphify rebuilding in the background during full-suite loops → 16 vitest + 16 graphify workers on 16 cores → operations exceed 5000 ms → random timeouts (never wrong values).

## Decision (proposal-auditor PA-1, Optimality 0–6)

| Option | Score | Verdict |
|---|---|---|
| Cap parallelism `maxForks: 8` (B) | **5** | Chosen base — kills self-oversubscription, keeps timeout signal sharp |
| `GRAPHIFY_SKIP_HOOK` parity in post-checkout (C) | **4** | Chosen supplement — hits the true cause; post-checkout lacked the guard post-commit already had |
| Raise global `testTimeout` to ~15s (A) | 2 | Rejected — masks perf regressions; testTimeout is the *detector*, not a tuning knob |
| Do nothing (D) | 3 | Honest but no CI/other-machine protection |
| Keep per-file `@/core/db` mocking (E) | 2 | Rejected as strategy — N-file footprint, breaks Abstraction Integrity, loses real-DB coverage |

## What was done

- **B** — `vitest.config.ts`: `poolOptions: { forks: { maxForks: 8 } }`. `testTimeout` deliberately left at default so genuine slow-code regressions still fail.
- **C** — `.husky/post-checkout`: added the `[ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] && exit 0` guard that `post-commit` already had (line 18), so benchmark/test runs can silence both hook branches.

## Out of scope / notes

- The 014–016 mocks are **kept** (committed, green, lighter tests = extra robustness) but are no longer the strategy. Not reverted — reverting would re-introduce fake-indexeddb cost for zero benefit.
- Product code untouched.

## Success criteria (met)

- Full suite green with `maxForks: 8` (551/551, run under `GRAPHIFY_SKIP_HOOK=1`).
- No `testTimeout` inflation; regression-detection sensitivity preserved.
- No product code changed; both edits are one line each.

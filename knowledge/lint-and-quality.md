---
name: lint-and-quality
description: Code-quality and lint enforcement — ESLint 9 flat config, architectural boundaries, test-quality gate, Python Ruff, pre-commit and CI.
---

# Code Quality & Lint Enforcement

Formerly `PROJECT_LOGIC.md` [PL-9.5]. The machine-enforced architectural boundaries here formalize [constraints](constraints.md) [PL-8].

- **Config**: `eslint.config.mjs` (ESLint 9 flat config) extends `eslint-config-next` `core-web-vitals` + `typescript`. All lint tooling is in `devDependencies` only (never shipped).
- **Ignores**: `.next/`, `out/`, `build/`, `next-env.d.ts`, and `scratch/**` (temporary diagnostic scripts, see [coding-rules](coding-rules.md) CP-3.9 — not part of the codebase).
- **Test relaxation block**: `__tests__/`, `*.test.{ts,tsx}`, `*.spec.{ts,tsx}`, `tests/`, and Vitest setup files disable `no-explicit-any`, `no-unused-vars`, `ban-ts-comment` (mocks/fixtures legitimately use `any`).
- **`react-hooks/set-state-in-effect` = `warn`** (not error): conflicts with the project-mandated SSR/init pattern (deferred `localStorage` reads and DOM measurement in `useEffect`, see [constraints](constraints.md) / CP-3.4). Visible but non-blocking.
- **Baseline cleared**: the legacy `any` baseline has been fully typed away — `eslint .` reports **0 errors** (only ~94 non-blocking warnings remain, mostly the `set-state-in-effect` SSR pattern and `exhaustive-deps`). The handful of genuinely-unavoidable `any` are kept behind documented `eslint-disable` comments (isomorphic Node `require` in `logger.ts`, the untyped `window.YT` global, the polymorphic `calculateNextFsrsState`, and the undocumented YouTube InnerTube search JSON).
- **Pre-commit** (`.husky/pre-commit` → `lint-staged`, config in `package.json`): runs `eslint --no-warn-ignored` on **staged** `*.{ts,tsx}`, plus Ruff on **staged** `*.py` (`ruff check --fix` + `ruff format`). Errors block the commit; warnings do not.
- **CI** (`.github/workflows/lint.yml`): on `pull_request` / `push` to `main`, lints only files **changed vs the base commit** (`git diff`), so the frozen baseline never reds CI while new code must be clean. (Python is pre-commit-only for now — 2-file surface, no CI job yet.)
- **Architectural boundaries** (machine-enforced invariants, formalizing [PL-8]): `no-restricted-syntax` bans direct `localStorage` outside `lib/profile.ts` ([CP-3.4]); `no-restricted-imports` bans `@google/genai` outside `lib/gemini/**` ([CP-3.3]). Allow-overrides: `lib/profile.ts`, `components/DebugDrawer.tsx` (dev storage inspector), `lib/gemini/**`, and the test zone (placed after the boundary block so it wins). `sessionStorage` is out of scope (no registry helper). The two legacy Gemini routes (`api/chat/analyze`, `api/anki/add`) are grandfathered via a file-scoped override in the config (they already use `withRetry`; left untouched on purpose).
- **Test-quality gate** (`eslint-plugin-vitest`, test files only): `expect-expect`, `no-disabled-tests`, `valid-expect` (`maxArgs: 2`, allows vitest's `expect(value, message)`), `no-identical-title` — all `error`. Blocks empty/assertion-less/disabled/duplicate-title tests.
- **Python quality** (`ruff.toml`): Ruff linter + formatter for `src/services/tokenizer/server.py` and `src/lib/dict/lookup.py`. Conservative rule set (`F` + `E4/E7/E9`), `target-version py311`, `line-length 100`. Installed in the local `venv`.

## Aethel workflow guards (spec/process layer)
Run by `prompt_linter.py` / `aethel lint` via `.husky/pre-commit` (alongside `lint-staged`; disjoint surfaces). Enforce levels live in `aethel.toml` and are **escalated to blocking** as of CHANGELOG 1.68.0:
- **`[sync] enforce = "error"`** — a commit that stages code (`*.ts/.tsx/.py/.js/.jsx/.go/.rs/.java/.sql`, minus `*test*`/`*spec*`/`*.md`) but no spec file (`CONTEXT.md`, `AETHEL.md`, `knowledge/*`) is **blocked** (Route C drift). Escape hatch for a genuinely spec-irrelevant commit: `AETHEL_SKIP_SYNC=1 git commit ...`.
- **`[sync] require_changelog = "error"`** — staging `AETHEL.md` (a `rule_files` entry) without staging `CHANGELOG.md` is **blocked** (same `AETHEL_SKIP_SYNC` hatch).
- **`[consistency] enforce = "error"`** — if AETHEL.md's managed `aethel-core` block diverges from the installed library core, commits are **blocked** until `aethel update` re-syncs.
- **`[consistency] version_skew_enforce = "warn"`** — left non-blocking on purpose: revision skew means the library moved ahead (upstream lag), not a workspace defect; it nags to run `aethel update` without blocking.
- Other always-on checks (knowledge-index integrity, agent/skill registry, plan/task/walkthrough stage) already fail the commit on real violations.

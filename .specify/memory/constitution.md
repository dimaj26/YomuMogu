# YomuMogu Constitution

The governing principles for YomuMogu development under the spec-kit
Spec-Driven-Development workflow. This document is the project's architectural
DNA: every spec, plan, and implementation must comply. Architecture/domain
detail lives as reference in `knowledge/` (index: `../../CONTEXT.md`).

## Core Principles

### I. Spec-Driven Flow
Task requests are handled through spec-kit: `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) → `/speckit-implement`. Each feature gets a branch and a `specs/NNN-slug/` directory (`spec.md`, `plan.md`, `tasks.md`). No production code is written before its spec and plan exist and have passed their review gate. Trivial one-line fixes may skip the full cycle but still follow every other principle.

### II. Test-First (NON-NEGOTIABLE)
For a reported bug, first write a failing test that reproduces it, confirm it fails, then fix. For new behavior, tests accompany the implementation. Vitest (unit/integration) and Playwright (e2e) are the suites; the suites must stay green (see `knowledge/testing.md`).

### III. Fail-Fast Error Handling
Never swallow exceptions silently. Log with tracebacks and propagate where appropriate. No empty `catch` blocks, no broad catches that hide failures.

### IV. Layered Boundaries
Database/IndexedDB access goes through service/domain facades only — never query the raw DB context from UI or API-handler layers. State machines transition only after validating pre-conditions and logging the transition. These boundaries are enforced by ESLint architectural rules (`knowledge/lint-and-quality.md`).

### V. No Placeholders in Prod
Do not commit placeholders, dry-run mocks, or unhandled `TODO`s to the main branch. Shipped code is real code.

## Additional Constraints (stack & language)

- **Platform**: Windows. All terminal commands use **PowerShell** syntax. Call the project venv directly: `./venv/Scripts/python.exe`.
- **Stack**: Next.js 16 / React 19 / TypeScript; FSRS scheduler (one `active` curve); Google Gemini for conversation practice. See `knowledge/architecture.md`.
- **Language**: technical docs and `SKILL.md` files in **English**; code comments, logs, and user-facing UI strings in **Russian** — except Japanese learning content. (`knowledge/coding-rules.md`)
- **Code quality**: ESLint + Ruff run on staged files at commit (errors block). Keep them green.
- **Knowledge graph**: after changes that add/rename/delete symbols, run `./venv/Scripts/graphify.exe update .` to keep `graphify-out/` fresh.

## Development Workflow & Quality Gates

- **Pre-commit pipeline (husky)**: the staged-commit hook runs three steps in order — (1) `npx lint-staged` (ESLint + Ruff, errors block); (2) the doc-drift gate below; (3) `scripts/graph_doc_sync.py`, a non-gating refresh of the graph's semantic doc layer that always exits 0 (see `knowledge/graphify-workflow.md`).
- **Doc-drift gate (machine-enforced)**: `scripts/spec_sync_guard.py` (pre-commit) blocks a commit that stages source code without a spec/doc update in the same commit (`specs/**`, `knowledge/**`, this constitution, `CONTEXT.md`, or `CHANGELOG.md`). Bypass a genuinely doc-irrelevant commit with `SKIP_SPEC_SYNC=1`.
- **Keep knowledge in sync**: when code changes a schema, API surface, module layout, or domain rule, update the matching `knowledge/*.md` topic (and its `CONTEXT.md` link) in the same commit. Record notable decisions as ADRs under `knowledge/decisions/NNNN-*.md`; append human-readable changes to `CHANGELOG.md`.
- **Git**: imperative commit subjects with a type prefix (`feat:`/`fix:`/`docs:`/`refactor:`/`chore:`/`test:`). Auto-commit after each completed, coherent milestone — do not ask for commit approval. **`git push` requires explicit user approval and is never automatic.**

## Governance

This constitution supersedes ad-hoc practice. Amendments are made via `/speckit-constitution` (or a direct edit) and must bump the version and update any dependent templates under `.specify/templates/`. Complexity must be justified against these principles in `plan.md`.

**Version**: 1.1.1 | **Ratified**: 2026-06-27 | **Last Amended**: 2026-07-02

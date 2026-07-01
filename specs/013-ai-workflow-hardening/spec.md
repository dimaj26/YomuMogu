# Feature 013: AI-workflow hardening (audit remediation)

**Status**: Planned | **Branch**: `013-ai-workflow-hardening` | **Source**: 2026-07-02 workflow audit (Fable session)

## Problem

A general audit of the AI-development infrastructure found that the central
enforcement mechanism (graphify PreToolUse hooks) is silently dead, the
spec-sync guard has a loophole that defeats its purpose, the paid graph
semantic pass cannot use the owner's Claude subscription, and several smaller
drift/bloat issues accumulate maintenance cost.

## What (user stories)

- **US1**: As the AI developer, the graphify-first hooks actually fire, so code
  exploration goes through the graph instead of raw grep/Read.
- **US2**: As the project owner, the spec-sync pre-commit guard cannot be
  satisfied by an arbitrary `.md` file — only by real spec/doc artifacts.
- **US3**: As the project owner, the batched semantic graph pass (pre-push)
  runs through the Claude Code subscription (`claude-cli` backend, Haiku) with
  zero API spend.
- **US4**: As the AI developer, permission settings, memory files, CLAUDE.md
  pointers, constitution wording, and graphify-out snapshots carry no stale or
  redundant entries.

## Out of scope

- Any `src/` product code. No behavior change for end users.
- graphify package internals (venv site-packages stay untouched).

## Success criteria

- Hook self-test: reading a `src/**/*.ts` file injects the graphify reminder; reading `specs/**/*.md` does not.
- `spec_sync_guard.py`: commit staging `src/x.ts` + `notes.md` (repo root) is **blocked**; + `knowledge/x.md` passes.
- `graph_doc_sync.py --push` invokes graphify with `--backend claude-cli` and model `haiku` (verified by log/dry-run), and still never blocks a push.
- All existing tests stay green; lint clean.

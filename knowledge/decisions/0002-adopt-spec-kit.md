---
name: adr-0002-adopt-spec-kit
description: We replaced the Aethel protocol with GitHub spec-kit as the SDD handler.
---

# ADR 0002 — Adopt Spec Kit (Spec-Driven Development)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Supersedes:** ADR 0001 (informal)

## Context

YomuMogu originally used the **Aethel protocol** (`AETHEL.md`, `aethel.toml`,
`.aethel/`, prompt linter) for structured development governance. Over time
several problems emerged:

- **Maintenance burden.** Aethel required its own CLI (`aethel-cli`), a
  prompt linter, session lifecycle files, and agent-skills bridge — all
  custom, with a single maintainer.
- **Orphaned artifacts.** Knowledge topics like `agents.md`,
  `session-lifecycle.md`, `skills.md`, and `spec-kit-bridge.md` existed only
  to describe Aethel machinery, not the product.
- **Community lock-in.** Aethel was purpose-built for this project; no
  external best practices, no reusable templates, no ecosystem.
- **Skill duplication.** `/speckit-*` commands (from GitHub spec-kit)
  replicated most Aethel routes (Route B → `-specify`, Route D → `-clarify`,
  `implementation_plan.md` → `-plan`, `task.md` → `-tasks`), creating
  ambiguity about which to use.

At the same time, **GitHub spec-kit** (published September 2025) had matured
into an open-source, multi-agent SDD toolkit with 28K+ GitHub stars, 11+
AI-agent integrations, and an active community.

## Decision

Replace Aethel governance with **GitHub spec-kit** (Spec-Driven Development)
as the sole task-request handler.

Specifically:

- **Remove:** `AETHEL.md`, `aethel.toml`, `prompt_linter.py`,
  `.aethel/` scratch, and Aethel-only knowledge topics.
- **Remove:** `aethel-cli` from the project venv.
- **Install:** `specify` CLI (`uv tool install specify-cli`) and run
  `specify init --here --integration claude --script ps`.
- **Install:** 11 `/speckit-*` skills under `.claude/skills/`.
- **Retain:** The surviving principles (Test-First, Fail-Fast, Layered
  Boundaries, No-Placeholders, Doc-Drift Gate, Git discipline) are rewritten
  into `.specify/memory/constitution.md` v1.0.0.
- **Retain:** Pre-existing code-quality gates (`lint-staged` ESLint+Ruff)
  and graphify hooks — untouched.
- **Retain:** The `knowledge/` architecture tree as reference, scrubbed of
  Aethel governance terminology and dead links.
- **Gate:** `scripts/spec_sync_guard.py` — a lightweight replacement for
  Aethel's `[sync]` linter — blocks commits that stage source without a
  spec/doc update in the same commit.

The migration is **complete** — no hybrid mode, no Aethel fallback. spec-kit
owns the full SDD cycle.

## Consequences

- **Single workflow.** All task requests go through
  `/speckit-specify` → (`-clarify`) → `-plan` → `-tasks` → (`-analyze`) → `-implement`.
- **Community templates.** spec-kit provides battle-tested spec/plan/tasks
  templates, extension hooks, and workflow orchestration.
- **Multi-agent ready.** The same `.specify/` works with Claude, Copilot,
  Gemini CLI, Codebuddy, and OpenCode.
- **Loss of Aethel-specific features.** We lose the Aethel prompt linter,
  session lifecycle tracking, and the automatic governance-audit route (Route D).
  These are replaced by the spec-sync drift guard and manual review gates.
- **Knowledge tree trimmed.** ~4 Aethel-only knowledge topics removed;
  remaining topics updated to remove Aethel terminology.

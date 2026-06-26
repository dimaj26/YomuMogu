---
name: spec-kit-bridge
description: How GitHub spec-kit (/speckit-* skills, .specify/, specs/) is bridged INTO the Aethel orchestrator — phase→route mapping, artifact authority, and gates. Aethel stays master.
---

# Spec-Kit Bridge (spec-kit → Aethel)

[GitHub spec-kit](https://github.com/github/spec-kit) is installed as an **optional task-request handler** that feeds the existing Aethel protocol. It does **not** replace [AETHEL.md](../AETHEL.md): on any conflict, **Aethel wins** (the managed core owns routing, gates, and taboos). spec-kit supplies a structured Spec-Driven-Development (SDD) front-end whose phases map onto Aethel routes; Aethel's session artifacts and commit gates remain authoritative.

## What was installed
- **CLI**: `specify-cli` via `uv tool install` (launcher at `~/.local/bin/specify`; `uv` itself under `~/AppData/Roaming/Python/Python311/Scripts`). Not on PATH by default — call by full path.
- **`.specify/`** (tracked): `templates/` (spec/plan/tasks/checklist/constitution), `scripts/powershell/*` (PowerShell flavour, per the project's PowerShell-only rule), `memory/constitution.md`, `extensions/`, `workflows/`, integration manifests.
- **`.claude/skills/speckit-*`** (git-ignored, local-only — matches the File-map "skills are local" rule): 11 skills — `constitution`, `specify`, `clarify`, `plan`, `tasks`, `analyze`, `checklist`, `implement`, `converge`, `taskstoissues`, `agent-context-update`. Invoked as `/speckit-<name>`.
- **`specs/NNN-<slug>/`**: created on first `/speckit-specify` (holds `spec.md`, `plan.md`, `tasks.md`, …). Tracked when present.

## Phase → Route mapping
| spec-kit phase | Aethel equivalent | Authority |
|---|---|---|
| `/speckit-constitution` | AETHEL.md §5 taboos + project rules | **Aethel.** `.specify/memory/constitution.md` defers to AETHEL.md — it is not a second rulebook. |
| `/speckit-specify` | Route B research → the "what" | spec-kit `spec.md` is an optional aid; the binding "what" still flows into the Route B plan + Route C spec. |
| `/speckit-clarify` | Route D — Ambiguity (grill-me, **one round**) | Aethel's one-round limit caps spec-kit's clarification loop. |
| `/speckit-plan` | Route B `implementation_plan.md` (RNA-Blueprint §2) | `implementation_plan.md` is authoritative; `plan.md` may seed it but the RNA-Blueprint format + CC tags are required. |
| `/speckit-tasks` | Route B `task.md` (ordered checklist) | `task.md` is authoritative. |
| `/speckit-analyze` / `/speckit-checklist` | Plan/Checklist/report linting (`aethel lint`) | Aethel linter is the gate that must pass. |
| `/speckit-implement` | Route B execution (3–5-step chunks) + GW-1 auto-commit | Aethel chunking + GW-1 + `[sync]` guard + graphify-update apply. |
| (no spec-kit phase) | Route B `walkthrough.md` + `aethel done`; Route C `CONTEXT.md`/`knowledge/` | **Mandatory** regardless of spec-kit use. |

## Rules of the bridge
1. **Aethel routing decides first.** A task request is still categorized A/B/C/D by AETHEL §1. spec-kit is only reached for Route B-shaped work, and only when the SDD front-end adds value.
2. **Aethel artifacts are authoritative.** The session's `implementation_plan.md` / `task.md` / `walkthrough.md` (RNA-Blueprint, §2) and the Route C knowledge spec (`CONTEXT.md` + `knowledge/*.md`) are mandatory and binding. Anything under `specs/` is a supporting aid, never a substitute, and must not contradict the knowledge index.
3. **Aethel gates are non-negotiable.** Linter green before commit, `[sync]` drift guard, GW-1 imperative commits, mandatory auto-commit, `graphify update .` after symbol changes — all still apply to spec-kit-produced changes.
4. **No second constitution.** Keep `.specify/memory/constitution.md` as a thin deferral to AETHEL.md so the two never diverge (same stub pattern as `CLAUDE.md`/`AGENTS.md`).

## Pitfalls
- `specify`/`uv` are **not on PATH** — invoke by full path.
- spec-kit's bundled scripts are the **PowerShell** flavour (`.specify/scripts/powershell/`); ignore the `bash/` variants under extensions.
- `.claude/skills/speckit-*` are git-ignored, so they will not appear in a clean clone — re-run `specify init --here --force --integration claude --script ps` to reinstall them. `.specify/` (tracked) is enough to drive the workflow manually.

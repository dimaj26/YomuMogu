---
name: spec-kit-reference
description: Working reference for GitHub spec-kit in this repo — the specify CLI, the /speckit-* skills, the SDD workflow scenarios, the .specify/ + specs/ layout, constitution role, template resolution, and project-specific gotchas (PowerShell, PATH).
---

# spec-kit Reference

[GitHub spec-kit](https://github.com/github/spec-kit) is the task-request workflow for this repo (Spec-Driven Development). The binding rules are in the [constitution](../.specify/memory/constitution.md); this file is the operational command/scenario reference. Source of truth for *what is installed*: `.specify/` (tracked) + `.claude/skills/speckit-*` (local). Installed CLI build at the time of adoption: `specify-cli 0.11.10.dev0`.

## The `/speckit-*` skills (this is how you drive work)
Invoked as slash commands; skills live under `.claude/skills/speckit-*` (note **hyphens**, e.g. `/speckit-specify`). The 11 installed:

| Skill | Purpose | Phase |
|---|---|---|
| `/speckit-constitution` | Create/update project principles in `.specify/memory/constitution.md`; keep dependent templates in sync | setup |
| `/speckit-specify <desc>` | Create the feature spec — the **what & why**, not the tech. Creates branch + `specs/NNN-slug/spec.md` | 1 |
| `/speckit-clarify` | Ask ≤5 targeted questions to de-risk ambiguous areas; encode answers into the spec. Run **before** plan | 2 (opt) |
| `/speckit-plan` | Technical plan from the spec — stack, architecture, design docs (`plan.md`, `research.md`, `data-model.md`, contracts) | 3 |
| `/speckit-tasks` | Generate dependency-ordered `tasks.md` (parallelizable items marked) | 4 |
| `/speckit-analyze` | Cross-artifact consistency/coverage check across spec/plan/tasks (non-destructive) | 5 (opt) |
| `/speckit-checklist` | Generate a custom quality checklist for the feature | (opt) |
| `/speckit-implement` | Execute `tasks.md` to build the feature | 6 |
| `/speckit-converge` | Assess the codebase vs spec/plan/tasks; append remaining unbuilt work to `tasks.md` | recovery |
| `/speckit-taskstoissues` | Convert tasks into dependency-ordered GitHub issues | (opt) |
| `/speckit-agent-context-update` | Refresh the managed spec-kit section in agent context files (CLAUDE.md `<!-- SPECKIT -->` block) | maint |

## Workflow scenarios
- **New feature (full)**: `/speckit-specify "<what>"` → review the spec → `/speckit-plan` → review the plan → `/speckit-tasks` → `/speckit-implement`. Add `/speckit-clarify` before plan when the ask is fuzzy; `/speckit-analyze`/`/speckit-checklist` before implement for higher confidence.
- **Trivial fix**: the constitution allows skipping the full cycle for one-liners — still obey code-quality + spec-sync gates.
- **Resuming / drift recovery**: `/speckit-converge` re-derives what's left and appends tasks.
- **Hand off to issues**: `/speckit-taskstoissues` after `/speckit-tasks`.

Each `/speckit-*` skill self-checks prerequisites via `.specify/scripts/powershell/check-prerequisites.ps1` (e.g. plan requires `spec.md`; implement requires `plan.md` + `tasks.md`). There are **no git hooks** from spec-kit — enforcement is the skills + their review gates + the constitution (plus this repo's own `spec_sync_guard.py`, see [lint-and-quality](lint-and-quality.md)).

## The `specify` CLI
Installed via `uv tool install`; launcher at `~/.local/bin/specify` (**not on PATH** — call by full path). Sub-commands:

| Command | Use |
|---|---|
| `specify init . --here --force --integration claude --script ps` | how this repo was initialized (PowerShell scripts) |
| `specify check` / `specify integration list` | environment + available agent integrations |
| `specify self check` / `self upgrade [--dry-run] [--tag vX.Y.Z]` | update the CLI |
| `specify extension search\|add <name>` | add new commands/workflows |
| `specify preset search\|add <name>` | customize existing templates/terminology |
| `specify bundle search\|info\|install\|list\|update\|remove` | role-based component stacks |

## `.specify/` + `specs/` layout
- `.specify/memory/constitution.md` — governing principles (the rulebook).
- `.specify/templates/` — `spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md`, `constitution-template.md`; `overrides/` is project-local highest-priority.
- `.specify/scripts/powershell/` — `check-prerequisites.ps1`, `create-new-feature.ps1`, `setup-plan.ps1`, `setup-tasks.ps1`, `common.ps1` (PowerShell flavour; ignore the `bash/` variants under extensions).
- `.specify/workflows/speckit/workflow.yml` — the `specify → plan → tasks → implement` pipeline with review gates.
- `specs/NNN-slug/` — per feature: `spec.md`, `plan.md`, `tasks.md`, plus optional `research.md`, `data-model.md`, `contracts/`, `quickstart.md`. Created by `/speckit-specify`.

**Template resolution** (first match wins): project `overrides/` → presets → extensions → spec-kit core.

## Constitution role
The constitution is the architectural DNA referenced during specify/plan/implement: code-quality, testing, boundaries, language/stack, git policy, decision governance. `/speckit-constitution` edits it (and re-syncs templates) — do not let `specs/` contradict it.

## Gotchas (this repo)
- **PowerShell-only** + `--script ps`: use the `powershell/` scripts; call `specify`/`uv` by full path (not on PATH).
- Spec content = **what/why**; defer tech to `/speckit-plan`. The agent can over-engineer — validate plan assumptions.
- Run `/speckit-clarify` before planning on fuzzy asks to cut rework.
- `.claude/skills/speckit-*` are git-ignored → reinstall in a clean clone via `specify init … --integration claude --script ps`; `.specify/` (tracked) drives the manual flow regardless.

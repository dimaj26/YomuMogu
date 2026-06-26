---
name: skills
description: Registry of workspace-local Skill-tool capabilities (SKILL.md files under .agents/plugins/) and their status.
---

# Skills Registry

Workspace-local skills live under `.agents/plugins/yomumogu-plugin/skills/<name>/SKILL.md` and are loaded by reading the `SKILL.md` before use. This registry tracks them and their status. Delegatable agents are listed separately in [agents](agents.md); the project's coding/workflow rules are in [AETHEL.md](../AETHEL.md).

| Skill | Status | Purpose | Notes |
|---|---|---|---|
| `proposal-analysis` | **Active** | Architectural audit & design-evaluation engine (Optimality Scale 0–6, Triple Dialectic, PA-1/APA-1 reference modes). | Also registered as an agent — see [agents](agents.md). Path: `.agents/plugins/aethel-plugin/skills/proposal-analysis/SKILL.md` (aethel-maintained template; the old `yomumogu-plugin` duplicate was removed at the 1.7.0 upgrade). |
| `docs-update` | **Retired** | Former `CMD-1..4` documentation-sync engine that edited the legacy `PROJECT_LOGIC.md` / `CONTEXT_PROMPT.md` monoliths. | Removed. Replaced by **Route C** in [AETHEL.md](../AETHEL.md): edit the relevant `knowledge/*.md` topic file + fix its `CONTEXT.md` link in the same commit (enforced by the `[sync]` drift guard). |
| `speckit-*` (11) | **Active** | GitHub spec-kit SDD front-end: `/speckit-constitution`, `-specify`, `-clarify`, `-plan`, `-tasks`, `-analyze`, `-checklist`, `-implement`, `-converge`, `-taskstoissues`, `-agent-context-update`. | Installed via `specify init` under `.claude/skills/speckit-*` (git-ignored, local-only), so **outside** `.agents/plugins/` → not seen by `check_agent_registry` and not registered in [agents](agents.md). Bridged INTO Aethel (Aethel wins) — see [spec-kit-bridge](spec-kit-bridge.md). |

> Note: aethel's `check_agent_registry` linter treats plugin `SKILL.md` files under `.agents/plugins/` as agent entries, so any active skill **there** must also appear in [agents](agents.md) to stay non-orphan. The `speckit-*` skills live under `.claude/skills/` instead, so this rule does not apply to them.

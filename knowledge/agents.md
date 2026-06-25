---
name: agents
description: Closed registry of delegatable sub-agents. Route D may only delegate to an agent listed here — not in this registry means it does not exist.
---

# Agent Registry

This is the **closed source of truth** for delegatable agents (AETHEL.md Route D). If an agent is not listed here, it does not exist — never invent or spawn an unlisted agent. Migrated from the legacy `AGENTS.md` subagents registry; definitions also live under `.claude/agents/`.

## proposal-auditor
- **Role**: Pedagogical & Architectural Auditor.
- **When to use**: Route D analysis — auditing an architectural or pedagogical proposal/plan/design (project-mode `PA-1` referencing the knowledge tree, or abstract-mode `APA-1` against industry standards). Never writes code; structured analysis only.
- **Behavior**: Conducts structured proposal audits running the `proposal-analysis` engine — Phase 0 setup, Triple Dialectic (Thesis / Antithesis / Synthesis scored 0–6), outputs a Russian verdict using exact templates.
- **Definition**: `.claude/agents/proposal-auditor.md`. Tools: Read only.

## proposal-analysis
- **Role**: Architectural audit & design-evaluation engine (the Optimality-Scale / Triple-Dialectic logic that `proposal-auditor` runs). Plugin-packaged form of the auditor, usable directly.
- **When to use**: Route D analysis via `PA-1` (project mode, reference = knowledge tree) or `APA-1` (abstract mode, industry standards). Read-only; structured analysis only.
- **Behavior**: Optimality Scale 0–6 across Compliance / Value / Footprint, two reference modes, exact Russian verdict patterns.
- **Definition**: [proposal-analysis SKILL.md](../.agents/plugins/yomumogu-plugin/skills/proposal-analysis/SKILL.md).

## test-runner-and-debugger
- **Role**: Test Execution & Auto-Debugger.
- **When to use**: Unit/integration tests fail, or compilation/TypeScript type errors block progress.
- **Behavior**: Runs Vitest (`npm run test`) or `npx tsc --noEmit`, parses errors, applies minimal localized fixes to files marked `[MODIFY]` in the current plan. **Strictly forbidden** from editing test files (`*.test.ts`, `*.test.tsx`) or configs. Max 3 debug iterations, then stops and reports to the parent. Observes all Russian comment/logging/coding rules in [coding-rules](coding-rules.md).
- **Definition**: `.claude/agents/test-runner-and-debugger.md`. Tools: Read, Edit, Bash.

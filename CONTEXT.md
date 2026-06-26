# YomuMogu — Project Context Index

YomuMogu is a Japanese language-learning web app (Next.js 16 / TypeScript / React 19) that pairs an FSRS-scheduled vocabulary deck (offline starter deck + optional local Anki) with Google Gemini AI conversation practice. This is the curated entry map to the project's structured knowledge — each link points at an atomic topic file under `knowledge/`. Design decisions are append-only ADRs under `knowledge/decisions/`.

---

## Architecture & Layout
- [Architecture & stack](knowledge/architecture.md) — identity, stack table, directory tree, and the core user flow.
- [Module registry](knowledge/module-registry.md) — authoritative per-file role table (update on any file add/remove/rename).
- [Data schema](knowledge/data-schema.md) — localStorage namespace, core TypeScript interfaces, IndexedDB schema, YouTube cache.

## API & Integrations
- [API route contracts](knowledge/api-contracts.md) — Anki, Gemini, dict, and media routes; ChatResponse/HintResponse shapes.
- [Gemini patterns](knowledge/gemini-patterns.md) — withRetry, structured output, language taboos, furigana, concealment, input enforcement, adaptive routing, grammar scoping.
- [Anki integration](knowledge/anki-integration.md) — AnkiConnect protocol, status classification, AI note creation, bilateral FSRS sync.

## Domain Rules
- [Progression & intervals](knowledge/progression-and-intervals.md) — decorative XP invariant and the `core/intervals.ts` registry of all timing systems.
- [Constraints](knowledge/constraints.md) — hard architectural taboos (PL-8).
- [Coding rules](knowledge/coding-rules.md) — role, conventions (language/stack, Gemini, storage, API, testing, files, components), and response expectations.
- [Design system](knowledge/design-system.md) — palette, typography, 3D buttons, ruby/furigana styling.

## Quality & Process
- [Testing](knowledge/testing.md) — Vitest/Playwright configs, commands, categories, counts.
- [Lint & quality](knowledge/lint-and-quality.md) — ESLint 9, architectural-boundary rules, test-quality gate, Ruff, pre-commit/CI.
- [Agent registry](knowledge/agents.md) — closed list of delegatable sub-agents (Route D).
- [Skills registry](knowledge/skills.md) — workspace-local Skill-tool capabilities and their status.
- [Session lifecycle](knowledge/session-lifecycle.md) — Route B session mechanics (start/switch/done/abandon, archival).

## Features
- [Implemented features](knowledge/features.md) — one-line registry of shipped features.

## Decisions (ADRs)
- [ADR 0001 — record architecture decisions](knowledge/decisions/0001-record-architecture-decisions.md) — why we keep ADRs.

## Strategic context (strictly-local, git-ignored — not present in clean clones)
- [Learning philosophy](_nogit_philosophy.md) — dual-curve→single-curve FSRS rationale, context mining, fluency-first, grammar DAG, Science-First framework.
- [Roadmap](_nogit_roadmap.md) — completed milestones, scaling program (P0–P4), DX backlog, future concepts.
- [Science-First research digest](_nogit_research_science_first.md) — the SLA/memory/lexicon/motivation evidence base behind the design.

<!--
The legacy monoliths PROJECT_LOGIC.md and CONTEXT_PROMPT.md were removed after migration;
their content now lives in the knowledge/ topic files linked above. Their legacy [PL-x.y] /
[CP-x.y] indices are preserved as headings inside those files (and recalled in each file's
"Formerly ..." note), so older plans citing those tags still resolve.
-->

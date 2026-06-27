# YomuMogu — Project Context Index

YomuMogu is a Japanese language-learning web app (Next.js 16 / TypeScript / React 19) that pairs an FSRS-scheduled vocabulary deck (offline starter deck + optional local Anki) with Google Gemini AI conversation practice. This is the curated entry map to the project's structured knowledge — each link points at an atomic topic file under `knowledge/`. Design decisions are append-only ADRs under `knowledge/decisions/`.

---

## Workflow
Task requests are handled via **spec-kit** Spec-Driven Development: `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) → `/speckit-implement`. The binding rulebook is the [constitution](.specify/memory/constitution.md); the cross-agent entry is [AGENTS.md](AGENTS.md). This index and the `knowledge/` tree are the architecture reference.
- [spec-kit reference](knowledge/spec-kit-reference.md) — the `specify` CLI, the `/speckit-*` skills, workflow scenarios, `.specify/`+`specs/` layout, gotchas.

## Architecture & Layout
- [Architecture & stack](knowledge/architecture.md) — identity, stack table, and the core user flow.
- [Directory layout](knowledge/directory-layout.md) — the full `src/` App Router tree.
- Module registry (per-file roles, update on any file add/remove/rename) — split by layer:
  - [core/infra](knowledge/module-registry-core.md) — core/, plugins/anki/, extension/, resources/, services/, scripts/.
  - [app & UI](knowledge/module-registry-app.md) — app/ pages + api/ routes, components/, hooks/, tests/e2e/.
  - [lib/](knowledge/module-registry-lib.md) — media, gemini, grammar, jlpt, quiz, chat, words, science, balance, dict.
- [Data schema](knowledge/data-schema.md) — localStorage namespace, core TypeScript interfaces, IndexedDB schema, YouTube cache.

## API & Integrations
- [API route contracts](knowledge/api-contracts.md) — Anki, Gemini, dict, and media routes; ChatResponse/HintResponse shapes.
- [Gemini patterns](knowledge/gemini-patterns.md) — withRetry, structured output, language taboos, furigana, concealment, input enforcement, adaptive routing, grammar scoping.
- [Anki integration](knowledge/anki-integration.md) — AnkiConnect protocol, status classification, AI note creation, bilateral FSRS sync.

## Domain Rules
- [Progression & intervals](knowledge/progression-and-intervals.md) — decorative XP invariant and the `core/intervals.ts` registry of all timing systems.
- [Constraints](knowledge/constraints.md) — hard architectural taboos (PL-8).
- [Coding rules](knowledge/coding-rules.md) — role, general conventions (language/stack, comments, files, components, scratch, changelog, git), response expectations.
- [Coding rules — integrations](knowledge/coding-rules-integrations.md) — Gemini, profile/storage, API routes, testing conventions.
- [Design system](knowledge/design-system.md) — palette, typography, 3D buttons, ruby/furigana styling.

## Quality & Process
- [Testing](knowledge/testing.md) — Vitest/Playwright configs, commands, categories, counts.
- [Lint & quality](knowledge/lint-and-quality.md) — ESLint 9, architectural-boundary rules, test-quality gate, Ruff, pre-commit/CI.
- [Graphify workflow](knowledge/graphify-workflow.md) — code indexed as a queryable graph; the graphify-first reading protocol and its carve-out.
- [Graphify reference](knowledge/graphify-reference.md) — command surface (query/path/explain/affected/update/exports), build-pipeline logic, outputs, integrity guarantees, scenarios.
- [Local delegation](knowledge/local-delegation.md) — how the agent offloads fitting self-contained sub-tasks to local Ollama (qwen2.5-coder:7b-16k) via claude-code-router.

## Features
- [Implemented features](knowledge/features.md) — one-line registry of shipped features.

## Decisions (ADRs)
- [ADR 0001 — record architecture decisions](knowledge/decisions/0001-record-architecture-decisions.md) — why we keep ADRs.
- [ADR 0002 — adopt spec-kit](knowledge/decisions/0002-adopt-spec-kit.md) — migration from Aethel to spec-kit SDD.

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

---
name: graphify-workflow
description: How the repo is indexed as a queryable code graph by graphify, and the graphify-first reading protocol (read code through the graph; files outside it are read directly).
---

# Graphify Workflow (Code Knowledge Graph)

The codebase is indexed as a queryable knowledge graph by **graphify** (PyPI `graphifyy`, CLI `graphify`; a dev/AI-assistant tool, not an app runtime dep). The behavioral rule lives in [AETHEL.md](../AETHEL.md) under "Codebase reading protocol — graphify-first"; this topic is the operational reference.

## What the graph covers

`graphify .` runs tree-sitter AST extraction over the **code** corpus and **semantic LLM extraction** over the **docs** (markdown spec, README, CHANGELOG), then writes `graphify-out/` (git-ignored, rebuilt locally — never committed):

- `graph.json` — the queryable graph (code symbols + doc concepts, linked).
- `GRAPH_REPORT.md` — named communities + key concepts (from the labeling pass).
- `manifest.json`, `.graphify_analysis.json` — build metadata.
- `cache/` — per-file extraction cache (makes rebuilds fast/incremental; unchanged files are not re-sent to the LLM).

**Backend.** Doc/image semantic extraction needs an LLM. The repo uses the **DeepSeek** backend (`DEEPSEEK_API_KEY` in the environment; the `openai` package is the client). Code-only builds need no key. `graphify update .` re-extracts code offline with no LLM.

## The carve-out — what is NOT in the graph

graphify honours `.gitignore` + `.graphifyignore` and always skips `venv/`, `node_modules/`, `.git/`. Everything excluded is read **directly** — there is no graph node for it:
- Strategic git-ignored docs: `_nogit_philosophy.md`, `_nogit_roadmap.md`, `_nogit_research_science_first.md`.
- Scratch/secrets/binaries: `.aethel/`, `.claude/`, `.agents/`, `.env*`, `jitendex/`.
- Images (`.graphifyignore`): DeepSeek is text-only; switch to a vision backend (claude-cli/gemini) to index them.

Tracked **code and markdown docs ARE indexed** — query the graph for spec questions too, not just code. When unsure whether a path is indexed, query it — a miss means "not in the graph → read it directly".

## Commands

| Goal | Command |
|---|---|
| Build / rebuild the graph | `graphify .` |
| Refresh after code edits (offline, no LLM) | `graphify update .` |
| Ask a structural question | `graphify query "how does chat reach the dictionary?"` |
| Explain a node + neighbors | `graphify explain "scheduler"` |
| Shortest path between two nodes | `graphify path "calculateNextFsrsState" "db"` |
| Reverse impact of a change | `graphify affected "intervals"` |

Run via the venv-installed CLI (`venv/Scripts/graphify.exe` on Windows). Keep the graph fresh: rebuild/`update` after adding, renaming, or deleting symbols — a stale graph is a process smell.

## Indexing images too (optional)

Images are excluded by `.graphifyignore` because DeepSeek is text-only. To index them (icons, screenshots, diagrams) drop the image lines and switch to a vision backend — `claude-cli` (routes through the local Claude Code CLI, no API key, billed to the plan) or `gemini`. Not required for code/doc navigation.

**See also:** [directory-layout](directory-layout.md) (the `src/` tree the graph indexes), [architecture](architecture.md) (high-level module map).

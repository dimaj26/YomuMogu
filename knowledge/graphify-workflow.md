---
name: graphify-workflow
description: How the repo is indexed as a queryable code graph by graphify, and the graphify-first reading protocol (read code through the graph; files outside it are read directly).
---

# Graphify Workflow (Code Knowledge Graph)

The codebase is indexed as a queryable knowledge graph by **graphify** (PyPI `graphifyy`, CLI `graphify`; a dev/AI-assistant tool, not an app runtime dep). The behavioral rule lives in [AETHEL.md](../AETHEL.md) under "Codebase reading protocol — graphify-first"; this topic is the operational reference.

## What the graph covers

`graphify .` runs tree-sitter AST extraction over the **code** corpus and writes `graphify-out/` (git-ignored, rebuilt locally — never committed):

- `graph.json` — the queryable graph (current build: ~765 nodes, ~1834 edges, 41 communities over 226 TS/JS/Python files).
- `manifest.json`, `.graphify_analysis.json` — build metadata.
- `cache/` — per-file extraction cache (makes rebuilds fast/incremental).

**Scope is code-only by design.** `.graphifyignore` (committed) excludes doc/text formats (`*.md`, `*.txt`, `*.yml`, `*.html`, …) and images so the build needs **no LLM API key** — it runs fully offline and deterministically. graphify also honours `.gitignore` and always skips `venv/`, `node_modules/`, `.git/`.

## The carve-out — what is NOT in the graph

Anything excluded above is read **directly**, as before — there is no graph node for it:
- Markdown spec/docs: `AETHEL.md`, `CONTEXT.md`, `knowledge/*.md`, `README.md`, `CHANGELOG.md` (already well-structured here; the index IS the doc map).
- Strategic git-ignored docs: `_nogit_philosophy.md`, `_nogit_roadmap.md`, `_nogit_research_science_first.md`.
- Scratch/secrets/binaries: `.aethel/`, `.claude/`, `.agents/`, `.env*`, `jitendex/`.

When unsure whether a path is indexed, query it — a miss means "not in the graph → read it directly".

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

## Optional: richer semantic graph

To also index docs/images/PDFs semantically (community names, doc↔code links), drop the `.graphifyignore` excludes and provide an LLM key (`DEEPSEEK_API_KEY` / `GEMINI_API_KEY` / …). The DeepSeek backend additionally needs the `openai` package (`pip install openai`). This costs API calls and is **not** required for code navigation, which the offline graph already serves.

**See also:** [directory-layout](directory-layout.md) (the `src/` tree the graph indexes), [architecture](architecture.md) (high-level module map).

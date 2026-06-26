---
name: graphify-workflow
description: How the repo is indexed as a queryable code graph by graphify, and the graphify-first reading protocol (read code through the graph; files outside it are read directly).
---

# Graphify Workflow (Code Knowledge Graph)

The codebase is indexed as a queryable knowledge graph by **graphify** (PyPI `graphifyy`, CLI `graphify`; a dev/AI-assistant tool, not an app runtime dep). The graphify-first reading protocol (read code through the graph; query before opening files) is stated in [AGENTS.md](../AGENTS.md); this topic is the operational reference.

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
- Scratch/secrets/binaries: `.claude/`, `.agents/`, `.env*`, `jitendex/`.
- Images (`.graphifyignore`): DeepSeek is text-only; switch to a vision backend (claude-cli/gemini) to index them.

Tracked **code and markdown docs ARE indexed** — query the graph for spec questions too, not just code. When unsure whether a path is indexed, query it — a miss means "not in the graph → read it directly".

## Commands

| Goal | Command |
|---|---|
| Build / rebuild the graph | `graphify .` |
| Refresh after code edits (offline, no LLM) | `graphify update .` |
| Apply semantic re-extraction after **doc** edits (LLM) | `graphify . --update` (= `/graphify --update`) |
| Ask a structural question | `graphify query "how does chat reach the dictionary?"` |
| Explain a node + neighbors | `graphify explain "scheduler"` |
| Shortest path between two nodes | `graphify path "calculateNextFsrsState" "db"` |
| Reverse impact of a change | `graphify affected "intervals"` |

Run via the venv-installed CLI (`venv/Scripts/graphify.exe` on Windows). Keep the graph fresh: rebuild/`update` after adding, renaming, or deleting symbols — a stale graph is a process smell.

## Keeping the graph fresh (hooks + doc-sync)

`graphify hook install` registers `.husky/post-commit` + `post-checkout`, but those call `_rebuild_code` — **code + doc AST structure only, offline**. They do NOT re-run the **semantic** LLM pass for changed docs, and they clear graphify's native `needs_update` flag — so spec edits (`CONTEXT.md`, `knowledge/**`, `.specify/memory/constitution.md`) would otherwise leave the graph's semantic doc nodes silently stale.

[scripts/graph_doc_sync.py](../scripts/graph_doc_sync.py) (wired into `.husky/pre-commit`, non-gating) closes that gap: on staged spec-`.md` changes it sets the native `needs_update` flag, then launches a **detached** `graphify . --update` (semantic re-extraction). The detached child owns the flag — **cleared on success, kept on failure** — so freshness is automatic but a failed run stays visible to `graphify check-update` / `/graphify`. Bypass with `GRAPHIFY_SKIP_DOC_SYNC=1`. Quality-critical extraction stays on the DeepSeek backend, not local Ollama (see [local-delegation](local-delegation.md)).

## Indexing images too (optional)

Images are excluded by `.graphifyignore` because DeepSeek is text-only. To index them (icons, screenshots, diagrams) drop the image lines and switch to a vision backend — `claude-cli` (routes through the local Claude Code CLI, no API key, billed to the plan) or `gemini`. Not required for code/doc navigation.

**See also:** [directory-layout](directory-layout.md) (the `src/` tree the graph indexes), [architecture](architecture.md) (high-level module map).

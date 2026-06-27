---
name: graphify-reference
description: Command and concept reference for graphify — the CLI surface (build/update/query/path/explain/affected/exports), the build pipeline logic (AST vs semantic, god nodes, communities, audit trail), and usage scenarios. Project-specific backend/hooks/carve-out are in graphify-workflow.
---

# graphify Reference

graphify turns a folder of code/docs into a queryable knowledge graph (`graphify-out/`). This file is the command + concept cheat-sheet; the project-specific backend, hooks, and carve-out (what is / isn't indexed) live in [graphify-workflow](graphify-workflow.md). PyPI package `graphifyy`, CLI `graphify`; in this repo call the venv binary **`./venv/Scripts/graphify.exe`**. The `/graphify` skill runs the full extraction pipeline (it can dispatch LLM subagents); the bare CLI verbs below are offline/cheap unless noted.

## Command surface
| Goal | Command |
|---|---|
| Build / rebuild the whole graph (LLM semantic pass on docs) | `graphify .` |
| Refresh after code edits — **offline, no LLM, no cost** | `graphify update .` |
| Re-run the semantic LLM pass after **doc** edits | `graphify . --update` (= `/graphify --update`) |
| Ask a structural question (BFS, broad context) | `graphify query "how does chat reach the dictionary?"` |
| Trace a specific path (DFS) / cap tokens | `graphify query "…" --dfs` / `--budget 1500` |
| Shortest path between two nodes | `graphify path "calculateNextFsrsState" "db"` |
| Explain a node + its neighbors | `graphify explain "scheduler"` |
| Reverse impact of a change | `graphify affected "intervals"` |
| Is the graph stale? (reads the `needs_update` flag) | `graphify check-update` |
| Re-cluster the existing graph only | `graphify . --cluster-only` |
| Add an external URL into the corpus | `graphify add <url> [--author …]` |
| Watch & auto-rebuild on code change (offline) | `graphify . --watch` |
| Install/refresh git rebuild hooks | `graphify hook install` |
| Exports | `--svg`, `--graphml`, `--neo4j[-push]`, `--falkordb[-push]`, `--wiki`, `--obsidian`, `--mcp` |

**Daily loop here:** after editing symbols run `graphify update .` (keeps `graph.json` fresh, no API cost); query through `graphify query/explain/path/affected` *before* opening source files (the graphify-first PreToolUse hook enforces this — see [graphify-workflow](graphify-workflow.md)).

## How the build works (pipeline logic)
Two extraction passes merge into one graph:
- **Structural (AST)** — tree-sitter over code files. Deterministic, free, offline. This is all `graphify update .` re-runs.
- **Semantic (LLM)** — extracts concepts/relationships from docs (markdown spec, README, CHANGELOG) and, optionally, images. Costs tokens; this repo uses the **DeepSeek** backend for the CLI (`DEEPSEEK_API_KEY`); the `/graphify` skill instead uses the host agent / Gemini if a key is set. Code-only builds need no key.

Then: **build** the graph → **cluster** (community detection; `PYTHONHASHSEED=0` pins it deterministic) → **analyze**: surface **god nodes** (high-centrality hubs), **surprising connections** (cross-community bridges), **cohesion** scores, and **suggested questions**.

## Outputs (`graphify-out/`, git-ignored, rebuilt locally)
- `graph.json` — the queryable graph (code symbols + doc concepts, linked). Its existence is what the graphify-first hook keys on.
- `GRAPH_REPORT.md` — named communities, god nodes, surprising connections, suggested questions, token cost.
- `graph.html` — interactive viz (auto-aggregates to community view above ~5000 nodes).
- `manifest.json`, `.graphify_analysis.json`, `cache/` — build metadata + per-file extraction cache (fast incremental rebuilds), `cost.json` (cumulative token tracker), `.graphify_python` / `.graphify_root` (resolved interpreter + scan root).

## Integrity & honesty guarantees
- **Audit trail**: every edge is tagged `EXTRACTED` (found in source), `INFERRED`, or `AMBIGUOUS` — never invent an edge.
- **Shrink-guard (#479)**: `to_json` refuses to overwrite `graph.json` with a *smaller* graph (guards against a botched incremental run wiping the graph). Intentional shrink (deleted files) needs a full rebuild `--force`.
- **Health check**: a read-only gate flags dangling/missing endpoints, self-loops, collapsed edges — surfaced, never auto-aborts.
- **Freshness flag**: `needs_update` is set when docs change and cleared on a successful re-extract (kept on failure, so staleness stays visible to `check-update`).

## Scenarios
- **"Where/what/how" about the code** → `graphify query "…"` (don't grep first). Cite `source_location` from the output.
- **"What breaks if I change X"** → `graphify affected "X"`.
- **"How does A connect to B"** → `graphify path "A" "B"`.
- **After a refactor** → `graphify update .` (offline) before relying on queries again; a stale graph is a process smell.
- **After editing the spec/docs** → the pre-commit `graph_doc_sync.py` fires a detached `graphify . --update`; or run it manually.
- **Index a whole external repo** → `/graphify https://github.com/<owner>/<repo>`.

**See also:** [graphify-workflow](graphify-workflow.md) (backend, hooks, the index/carve-out and the graphify-first reading rule).

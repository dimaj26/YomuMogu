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

[scripts/graph_doc_sync.py](../scripts/graph_doc_sync.py) (non-gating) closes that gap, split across two hooks so the **paid** semantic pass runs once per push rather than (almost) every commit — the spec-sync guard forces a doc edit into nearly every code commit, so a per-commit `--update` meant paying on nearly every commit:

- **`.husky/pre-commit` → `--mark-only`:** on staged spec-`.md` changes, only sets the native `needs_update` flag. Cheap, offline, **no API cost**. The flag accumulates dirtiness across commits and stays visible to `graphify check-update` / `/graphify`.
- **`.husky/pre-push` → `--push`:** if the flag is set, launches a **detached** `graphify . --update` (semantic re-extraction). graphify's per-file cache re-embeds only the docs that actually changed, so all the doc churn since the last successful update collapses into **one paid pass**. The detached child owns the flag — **cleared on success, kept on failure** — so freshness is automatic but a failed run stays visible.
  - If the `claude` CLI is on `$PATH`, this pass runs with `--backend claude-cli` — billed to the Claude Code Pro/Max subscription, not `ANTHROPIC_API_KEY` — using `GRAPHIFY_CLAUDE_CLI_MODEL` (default `haiku`; Opus/Sonnet is overkill for structured extraction). Without `claude` on `$PATH` it falls back to auto-detect by API key (DeepSeek, per below).

Bypass either with `GRAPHIFY_SKIP_DOC_SYNC=1`. Need a fresh graph locally before pushing (e.g. to query it)? Run `graphify . --update` manually. Manual/ad-hoc runs (no `--backend` flag) still auto-detect the DeepSeek backend, not local Ollama (see [local-delegation](local-delegation.md)).

## Indexing images too (optional)

Images are excluded by `.graphifyignore` because DeepSeek is text-only. To index them (icons, screenshots, diagrams) drop the image lines and switch to a vision backend — `claude-cli` (already used for the pre-push doc pass when available, see above) or `gemini`. Not required for code/doc navigation.

**See also:** [directory-layout](directory-layout.md) (the `src/` tree the graph indexes), [architecture](architecture.md) (high-level module map).

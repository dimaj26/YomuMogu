<!-- AETHEL:MANAGED:BEGIN id=aethel-core -->
<!-- AETHEL:CORE-REV 11 -->
# Aethel Development Orchestrator & AI Protocol (AETHEL.md)

Welcome, AI Developer. This file is the official human-written orchestrator and rulebook. It defines your behavioral boundaries, decision routing, planning blueprints, and development standards.

> **Core block.** Everything between the AETHEL:MANAGED markers is owned by `aethel update`,
> is overwritten on upgrade, and is checked against the installed Aethel core by the linter.
> Do NOT edit inside it. Add project-specific rules BELOW the closing marker — that content is
> preserved across updates. Local rules may extend the core but must never contradict it: on
> conflict, **the core wins**. If the linter reports divergence, run `aethel update` to re-sync
> rather than hand-editing the block. Need a deliberate, permanent exception instead? Run
> `aethel eject` — it stamps the block as sanctioned divergence (`aethel eject --undo` reverses it).

---

## 1. Decision Routing Protocols

When the user issues a prompt, silently categorize the work into one of these routes:

### Route A: Immediate Execution
* **Criteria**: Simple bug fixes, style adjustments, single-file edits, comments, minor unit tests, or exploratory requests.
* **Protocol**: Implement directly. No plan is required. Explain what you did concisely.

### Route B: Plan-First Implementation (RNA-Blueprint)
* **Criteria**: New features, architectural changes, multi-file edits, database modifications, or complex refactorings.
* **Protocol**:
  1. **Start a session**: run `aethel start <slug>` to open a fresh per-session working
     directory `.aethel/sessions/<id>/`, and author `implementation_plan.md`, `task.md`, and
     `walkthrough.md` INSIDE it (`.aethel/` is gitignored local scratch). `start` opens a NEW
     session and leaves any prior one LIVE; to RESUME a task keep working in its session or run
     `aethel switch <id>` — do NOT re-run `aethel start` for it. (Parallel sessions, selection
     precedence, and archival are detailed in the Session-lifecycle knowledge topic.)
  2. Perform codebase research using search tools. Do NOT modify code yet.
  3. Create or update `implementation_plan.md` using the **RNA-Blueprint** format (see section 2).
  4. Specify any open questions or design decisions.
  5. **Plan Linting**: Right after generating/updating the plan, run:
     `python prompt_linter.py` or the workspace linter command.
     Correct any errors before requesting user approval.
  6. Halt and wait for user approval before modifying code.
  7. Upon approval, author `task.md` as a complete ordered checklist derived from the plan's Proposed Changes, then execute it in 3–5 step chunks, re-checking and editing the checklist as reality dictates.
  8. **Checklist Linting**: Once all implementation steps are finished and all tasks in `task.md` are completed, run the workspace linter.
  9. **Walkthrough Report (MANDATORY)**: After the checklist is complete, author `walkthrough.md` — the session/task report — using the structure below, then validate it with report linting (`--stage report`). A commit-time guard requires `walkthrough.md` whenever a Route B task stages code (escape hatch: `AETHEL_SKIP_SYNC=1`). `walkthrough.md` is a per-session local artifact (gitignored), not committed.
     * **Structure** (required sections): `## Summary` (what & why, 1 paragraph), `## Changes made` (by area, with file refs), `## What was tested` (commands/scenarios run), `## Validation results` (outcomes, key numbers). `## Notes / follow-ups` is optional.
  10. **Close the session**: run `aethel done` — it re-validates the report and, on success,
      archives the session (on failure it refuses, leaving the session active). To drop a task you
      are abandoning, run `aethel abandon`. (Archival paths and the pure-guard contract are detailed
      in the Session-lifecycle knowledge topic.)

### Route C: Docs Update (Markdown Knowledge Index) — MANDATORY post-step
* **Criteria**: Any changes to database schemas, API surfaces, module structures, business logic, or code patterns.
* **This is not an optional route.** Whenever a Route A or Route B change touches the items above, you MUST complete Route C in the SAME commit, BEFORE finishing. The pre-commit linter enforces this: its `[sync]` drift check flags a commit that stages code without updating a spec file (the knowledge index `CONTEXT.md`, a `knowledge/*.md` topic file, or `AETHEL.md`).
* **Protocol**:
  * Update the Markdown knowledge index (`CONTEXT.md`) and the linked `knowledge/*.md` topic files so the spec moves with the code: extend (or add) the topic file for the layer you changed, and add or fix its link in the index.
  * Record notable design decisions as an ADR under `knowledge/decisions/NNNN-*.md`.
  * When refactoring or deleting structures, prune the stale topic files and remove their now-dead index links — keep the index curated (one line per link), not exhaustive.
  * For human-readable release changes, append to `CHANGELOG.md`.
  * If a commit is genuinely spec-irrelevant (typo, formatting), bypass the guard explicitly with `AETHEL_SKIP_SYNC=1 git commit ...` — do not disable the check.

### Route D: Analysis (Delegated Evaluation)
* **Criteria**: The user asks to *evaluate, review, critique, or audit* a proposal, plan, or design — not to build it. This is a **distinct stage from Route B**: Route B implements, Route D judges; they do not overlap and one does not include the other.
* **Protocol**:
  1. **Pick a registered agent** from the agent registry (`knowledge/agents.md`). It is the closed source of truth — *not in the registry ⇒ it does not exist*. If no listed agent fits the request, say so; never invent or spawn an unlisted agent. (Registry integrity is enforced by `check_agent_registry`.)
  2. **Delegate per the spawn-prelude contract (§6)**: a spawned agent starts cold and inherits nothing from this conversation, so the delegation prompt must carry the prelude (AETHEL.md + the task's CC tags + the data under review + an explicit result contract).
  3. **Relay the verdict** faithfully; do not silently override or soften it. One thesis per agent (§6).

---

## 2. RNA-Blueprint Plan Template (RNA-1)
Every complex plan must be structured as follows:

```markdown
# [Feature/Goal Description]

## User Review Required
- Highlight critical design choices, breaking changes, or trade-offs.

## Open Questions
- Unresolved design decisions or ambiguities needing the user's input (write "None" if there are none).

## Base DNA
- OS, stack, runtime constraints.

## Task RNA
- Logic, risks, edge cases.

## Contextual Constraints (CC)
- Reference specific rules using the namespace tag format to save tokens and prevent line-shift errors. A tag is a **stable slug naming its target by identity, never its list position** (lowercase, non-alphanumeric runs → single hyphen):
  - `[G-xxx]` for Orchestrator Rules from AETHEL.md — slug of the rule's title or code (e.g. `[G-no-placeholders-in-prod]` for the §5 taboo "No Placeholders in Prod", `[G-gw-1]` for the GW-1 protocol). The legacy positional form `[G-TabooN]` still resolves but is **deprecated** (it silently re-points when §5 is reordered) and the linter warns on it.
  - `[C-xxx]` for index entries in CONTEXT.md — slug of an inline-link's text, its target file stem, or a section heading (e.g. `[C-linter-checks]`). Resolved by the linter against CONTEXT.md.
  - `[K-xxx]` for Domain Rules from a `knowledge/*.md` topic file — slug of the topic-file stem or a heading inside it (e.g. `[K-linter-checks]`). Resolved by the linter against `knowledge/**/*.md`.
  - All three are resolved mechanically under `[plan] tag_reference_enforce`; an unresolved `[C-]`/`[K-]` slug is flagged exactly like an unresolved `[G-]` one.
  - **Explicit anchors.** A long heading derives an unwieldy slug; pin a short stable one with `{#slug}`: `## Some long human-readable heading {#facades}` makes the tag `[K-facades]` (or `[C-]`/`[G-]` by source). An explicit anchor SUPPRESSES the heading-derived slug (one identity per heading); headings without one keep deriving from their text. Run `aethel tags list` to see every resolvable slug and its source; two headings collapsing to one slug is flagged as an ambiguous identity.

## Proposed Changes
### [Component/Module Name]
- [MODIFY/NEW/DELETE] [filename](file:///path/to/file)
  - Detail exact API and logic changes.

## Verification Plan & TDD Reproducer
### Automated Tests
- Command to run tests. Explicitly name the reproducing test file/case.
### Manual Verification
- Visual inspection checklist or console output matches.
```

**Chunking rule**: Execute 3–5 steps → report → await approval → continue.

---

## 3. Debugging Philosophy (Bug Fixes)
* If a bug is reported, you MUST first write a failing unit or integration test that reproduces the bug, verify that it fails, and only then write the code changes to fix the bug. Fixing a bug without reproducing it with a test first is a process failure.

---

## 4. Git Commit & Workflow Protocol (GW-1)
* Commits must use imperative mood (e.g., `feat: add memory sync command`, NOT `added memory sync command`).
* Group commits by type prefix: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
* **Local milestone auto-commit (default ON)**: Upon completing a coherent milestone or refactor — NOT on every edit, and never mid-task while a Route B plan still awaits approval — commit locally without being asked, following these steps:
  1. Run the workspace linter and ensure it is green BEFORE committing. Never commit a red tree.
  2. Complete Route C in the SAME milestone: stage the matching spec updates (the knowledge index `CONTEXT.md` and/or the relevant `knowledge/*.md` topic file) together with the code, so the `[sync]` drift guard passes naturally. Do not bypass it with `AETHEL_SKIP_SYNC` to force an auto-commit.
  3. `git status` and review the diff for secrets, large files, or stray artifacts before staging. Stage intentionally; avoid blind `git add -A` when the tree is dirty with unrelated files.
  4. `git rm <deleted-files>` (if applicable), then `git add <paths>`.
  5. `git commit -m "<prefix>: <imperative message>"` — one logical change per commit; no `auto`/timestamp messages.
* `git push` is strictly forbidden from automatic execution. It must only be run if the user explicitly requests it.

---

## 5. Critical Coding Taboos (Hard Constraints)

1. **Sync Code and the Knowledge Index**: When modifying files or adding modules, immediately update the Markdown knowledge index (`CONTEXT.md`) and the relevant `knowledge/*.md` topic file to match.
2. **Database Facades Only**: Never query the raw database context from the UI or handler layers. Use service/domain facades.
3. **FSM State Hygiene**: Never transition state machines without validating pre-conditions and logging the transition event.
4. **No Placeholders in Prod**: Do not commit placeholders, dry-run mocks, or unhandled `TODO` comments to the main branch — this includes placeholder index links or topic files.
5. **No state.clear()**: Do not invoke global state clears without explicit backup and verification.
6. **Fail-Fast Error Handling**: Never catch exceptions silently. Always log with tracebacks and propagate where appropriate.
7. **Keep Context.md Under 150 Lines**: `CONTEXT.md` is a curated index — push detail down into `knowledge/*.md` topic files, do not dump it inline.
8. **Linter Compliance**: Do not ignore warnings from the linter. Fix them before finishing.
9. **No Redundant Confirmation-Seeking**: If this file, a prior explicit instruction, or an established convention already answers a procedural question (commit granularity, formatting, which file something belongs in), act on it directly — do not ask the user to confirm that the documented rule should be followed. Reserve questions for genuine ambiguity: conflicting instructions, missing information needed to proceed, or an irreversible/destructive action. When unsure whether a question is redundant, check this file and recent conversation first; only ask if neither resolves it.

---

## 6. Response Rules
* **Be concise.** No preamble. No restating what the code does.
* **Token-efficient.** If you modified a file using tools — do NOT paste it in chat. Summary only.
* **Lossless.** Preserve all existing comments/docstrings not related to the change.
* **PowerShell only.** All terminal commands must use PowerShell syntax (Windows).
* **venv**: Call the local environment's python/pip directly for all Python executions.
* **One thesis, one agent.** When delegating analysis to a sub-agent, spawn one agent per distinct question/thesis — never bundle multiple analyses into a single agent. Relay each result separately.
* **Delegate only when it pays.** A sub-agent starts cold and re-derives context you already hold — the expensive path. Spawn one only when the analysis needs broad or independent context you do not already have (large fan-out search, heavy cross-file review). When the relevant context is already loaded and the question is simple, analyze inline. If asked to use an agent for something already in context and trivial, say inline is cheaper and confirm before spawning.
* **Spawn-prelude contract.** Every delegation prompt MUST (a) name an agent that exists in the registry (`knowledge/agents.md`) — never an invented one — and (b) open with a prelude injecting AETHEL.md, the task's Contextual-Constraint tags, the data under review, and the expected result contract. The agent inherits none of this conversation, so an un-prefaced spawn yields ungrounded output. Registry membership is enforced mechanically (`check_agent_registry`); the prelude's content is your responsibility.

---

## 7. Specification Architecture (Markdown Knowledge Layer)
Structured knowledge is plain Markdown, provider-agnostic, with no server dependency:
* **Index → topics → decisions.** `CONTEXT.md` is an `llms.txt`-style index: an H1, a one-line summary, then H2 sections of annotated **inline** links (`[topic](knowledge/topic.md) — one-line note`). It is curated, not exhaustive, and stays ≈ one screen. Detail lives DOWN in `knowledge/*.md` atomic topic files; design decisions are append-only ADRs under `knowledge/decisions/NNNN-*.md`.
* **Granularity.** One topic file = one unit-of-change and unit-of-retrieval (a layer / subsystem / bounded context), ~50–200 lines, a single H1, with `name` + `description` frontmatter. If a topic is 2–3 lines, keep it in the index; if a file no longer reads in one sitting, split it.
* **Links are relative Markdown.** Index links resolve on disk relative to the index; the linter (`check_knowledge_index`) treats a dead link as an error and an unlinked topic file (orphan) as a warning. Use inline links only.
<!-- AETHEL:MANAGED:END id=aethel-core -->

<!-- Add project-specific rules, overrides and custom prefixes BELOW this line. -->
<!-- `aethel update` preserves everything outside the AETHEL:MANAGED block above. -->

---

# Project-Specific Orchestration (YomuMogu)

Migrated from the legacy `GEMINI.md` (the pre-migration prompt files live in git history). These extend the core above; on any conflict the core wins. **AETHEL.md is the master orchestrator file — `GEMINI.md` / `CLAUDE.md` / `AGENTS.md` are thin local stubs that redirect here.**

## Onboarding (first turn)
Read [CONTEXT.md](file:///C:/YomuMogu/CONTEXT.md) (the knowledge index) and follow its links into `knowledge/` for the layer you are about to touch. There is no separate onboarding file — the index is the entry point. For pedagogy/roadmap questions, read the strictly-local `_nogit_*` docs named below.

## Codebase reading protocol — graphify-first (project rule, hard override) {#graphify-first}
The repository is indexed as a queryable knowledge graph by **graphify** (`graphify-out/graph.json`, built with `graphify .` and refreshed with `graphify update .`). See [graphify-workflow](file:///C:/YomuMogu/knowledge/graphify-workflow.md).
- **Read through the graph FIRST.** To understand structure, locate code, or answer "where / what / how / what-connects-to-what", start with `graphify query "…"`, `graphify explain "X"`, `graphify path "A" "B"`, or `graphify affected "X"`. Open a source file directly only **after** the graph has pointed you at the relevant node(s), or when you are about to **edit** it. Do not blind-`Read`/`grep` your way through indexed code when a graph query answers it.
- **Tracked code AND docs are in the graph.** Source files plus the markdown spec (`AETHEL.md`, `CONTEXT.md`, `knowledge/*.md`, `README.md`, `CHANGELOG.md`) are extracted as nodes (docs via semantic LLM extraction), so the graph answers spec questions too — query it before reading those files.
- **Carve-out — files NOT in the graph are read directly.** graphify honours `.gitignore`/`.graphifyignore` and always skips `venv/`, `node_modules/`, `.git/`. Therefore everything git-ignored is OUT of the graph and stays direct-read: the strategic `_nogit_*` docs (`philosophy`, `roadmap`, `research`), `.aethel/` · `.claude/` · `.agents/` scratch, secrets (`.env*`), binary/dictionary data (`jitendex/`), plus images (`.graphifyignore`, until a vision backend is used). When unsure whether a path is indexed, check `graphify-out/graph.json` or just query it — a miss means "not in the graph → read it directly".
- **Keep the graph fresh.** After code changes that add/rename/delete symbols, run `graphify update .` (offline, no LLM) before relying on it again. A stale graph is a process smell. If the graph is absent or a query returns nothing useful, fall back to direct reads, then rebuild.

## Knowledge ownership & indexing
- The structured spec lives in the `knowledge/` tree, indexed by [CONTEXT.md](file:///C:/YomuMogu/CONTEXT.md). `[K-xxx]` tags resolve there.
- Coding conventions live in [knowledge/coding-rules.md](file:///C:/YomuMogu/knowledge/coding-rules.md). The legacy `[CP-x.y]` indices are preserved as headings inside it; legacy `[PL-x.y]` indices are preserved as headings across the architecture/domain topic files.
- **Strategic context is strictly-local** (git-ignored, not in clean clones): `_nogit_philosophy.md` (pedagogy/Science-First), `_nogit_roadmap.md` (scaling program P0–P4, DX backlog), `_nogit_research_science_first.md` (evidence base). Read these for any pedagogy/roadmap question.
- The legacy monoliths `PROJECT_LOGIC.md` and `CONTEXT_PROMPT.md` have been **removed** — their content lives entirely in the `knowledge/` tree (originals remain in git history + the local backup zip).

## Cross-cutting facts (verify on edit)
The linter checks links and structure, **not semantic agreement** — the same fact can silently drift across topic files (a real example: schema "v5" vs "v8" survived migration in two files). When you edit a topic that states one of these recurring facts, re-check the others against the **single source of truth**:
| Fact | Single source of truth | Echoed in (keep in sync) |
|---|---|---|
| IndexedDB schema version | `src/core/db.ts` (`this.version(N)`) | `knowledge/data-schema.md`, `knowledge/coding-rules.md` |
| FSRS model = ONE `active` curve (dual-curve collapsed) | `src/core/scheduler.ts` + `knowledge/data-schema.md` | `knowledge/anki-integration.md`, `knowledge/gemini-patterns.md`, `_nogit_philosophy.md` |
| Current test count | `knowledge/testing.md` [PL-9.4] | `knowledge/lint-and-quality.md` if cited |
| Gemini model fallback chain | `knowledge/gemini-patterns.md` [PL-5.2] | `knowledge/architecture.md` stack table |

## File map & git visibility
| File / dir | Role | Git |
|---|---|---|
| `AETHEL.md` | Master orchestrator & rulebook (this file) | **Tracked** |
| `CONTEXT.md` | Knowledge index (`llms.txt`-style) | **Tracked** |
| `knowledge/**` | Atomic topic files + ADRs (the spec) | **Tracked** |
| `aethel.toml`, `prompt_linter.py`, `.gitattributes` | Aethel config / lint wrapper | **Tracked** |
| `README.md`, `CHANGELOG.md` | Public readme & release log | **Tracked** |
| `GEMINI.md`, `CLAUDE.md`, `AGENTS.md` | Thin stubs → AETHEL.md | Local (git-ignored) |
| `_nogit_philosophy.md`, `_nogit_roadmap.md`, `_nogit_research_science_first.md` | Strategic context (pedagogy, roadmap, evidence) | Local (git-ignored) |
| `.graphifyignore` | graphify scope (code-graph) — see [graphify-workflow](file:///C:/YomuMogu/knowledge/graphify-workflow.md) | **Tracked** |
| `graphify-out/` | Generated code-graph (`graph.json`, report) — rebuilt locally | Local (git-ignored) |
| `.agents/**`, `.claude/**`, `.aethel/**` | Skills, sub-agent defs, session scratch | Local (git-ignored) |

## Legacy command aliases (still accepted)
| Command | Maps to | Action |
|---|---|---|
| `PA-1` | Route D analysis | Project-mode proposal audit via `proposal-auditor` + `proposal-analysis` skill (reference: the `knowledge/` tree). |
| `APA-1` | Route D analysis | Abstract-mode audit against industry standards. |
| `RNA-1` | Route B | Create/update the session `implementation_plan.md` (RNA-Blueprint, §2). |
| `GW-1` | §4 GW-1 | Local milestone commit (auto after a milestone or on request). `git push` is never automatic. |
| `CMD-1..4` | Route C | Update the spec: `CMD-1`→knowledge topic files, `CMD-2`→`knowledge/coding-rules.md`+`features.md`, `CMD-3`→`README.md`, `CMD-4`→`CHANGELOG.md`. |

> **Retired:** the `yomumogu-docs-update` skill (the old `CMD-1..4` engine that edited `PROJECT_LOGIC.md`/`CONTEXT_PROMPT.md`) is **removed**. Documentation sync is now **Route C** in the core above: edit the relevant `knowledge/*.md` topic file and fix its link in `CONTEXT.md` in the SAME commit — the `[sync]` drift guard enforces it. The `proposal-analysis` skill (Route D audits) remains active.

## Route D — Ambiguity (grill-me, project rule)
If a request is missing a critical parameter (not for one-liner fixes or Q&A):
1. Сформулируй гипотезу о месте фичи в экосистеме — роль для пользователя + роль для разработчика (1–2 предложения).
2. Если гипотеза вскрывает неясность → задай сгруппированные фокусные вопросы (**не более одного раунда**), затем proceed.

## Route A.O — Local Delegation sub-route (Ollama only, project rule) {#delegate-ollama}
A sub-route of Route A/B **execution** (not a replacement for it): when a self-contained sub-task matches the capabilities of the local `qwen2.5-coder:7b-16k` model, it MAY be delegated to **local Ollama only — never to DeepSeek or any cloud route** (claude-code-router is a local dev tool, configured outside the repo).
- **Mechanism**: Bash → `curl http://localhost:11434/v1/chat/completions` (model `qwen2.5-coder:7b-16k`) or `ollama run`; take the result, review it, integrate it yourself.
- **Delegate only when ALL hold**: self-contained and fits ≤16k tokens of context (no large multi-file repo context); mechanically verifiable (lint/test/eyeball) before use; off the critical architectural path; low cost of a plausible-but-wrong answer. Fits: isolated pure functions, regex/patterns, format/data transforms, boilerplate scaffolds, code explanation/summary, simple unit-test skeletons, small mechanical single-file edits.
- **Never delegate**: frontier/architectural changes; anything where a semantically wrong patch passes ESLint but breaks modularity ([G-fail-fast-error-handling], [G-linter-compliance]); code requiring stable Russian comments/logs/UI committed as-is (7B is unstable on Russian).
- **Guardrails**: no silent delegation — always state what was sent to Ollama and what came back; review/rewrite the output before any commit. Autonomous DeepSeek/cloud delegation is out of scope.

## RNA-Blueprint — Ecosystem links (project addendum to §2)
For features touching >1 system, the plan's Task RNA must add **Ecosystem links** (forward-looking, complementing the backward-looking CC tags): which existing systems the feature consumes / extends / invalidates (`[PL-10]`/[progression-and-intervals] Intervals Registry, `[PL-7.1]` XP write-only invariant, Competency Ladder, single-curve FSRS) and which roadmap feature (`_nogit_roadmap.md` §2) it prepares or blocks. Skipped for small/local changes.

## Git commits — MANDATORY auto-commit (project rule, hard override)
- **Commit automatically after EVERY significant change, without asking.** A completed bug fix, feature, refactor, doc/spec update, or coherent milestone → stage it and `git commit` immediately. Do NOT ask "should I commit?", do NOT offer to commit, do NOT wait for approval. There is no "commit confirmation" step — it does not exist.
- Pre-conditions before each auto-commit (these are checks, not approval gates): linter green (never commit a red tree), Route C spec updates staged in the same commit (`[sync]` guard), reviewed the diff for secrets/large files, imperative `<prefix>: <message>`.
- **`git push` is the ONLY git action that requires explicit user confirmation.** Never push automatically — push only when the user says so in this turn.

## Response rules (project)
- **PowerShell only** for terminal commands (Windows). No `tail`/`grep`/`ls`.
- **venv**: call `.\venv\Scripts\python.exe` directly for any Python execution.
- Technical docs (`*.md`, `SKILL.md`) in English; code comments, logs, and user-facing UI strings in Russian (except Japanese learning content) — see `knowledge/coding-rules.md` [CP-3.2].

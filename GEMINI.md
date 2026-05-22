# GEMINI.md — YomuMogu Orchestrator
# Rules: Be concise. Be functional. No redundant output. Token-efficient responses always.

## § FILE REGISTRY

| File | Role |
|---|---|
| `GEMINI.md` | This file. Routes, commands, git, planning protocol. |
| `PROJECT_LOGIC.md` | Technical truth: architecture, module registry, data schema, API patterns, constraints. |
| `CONTEXT_PROMPT.md` | AI onboarding: stack, coding rules, implemented features, response format. |
| `CHANGELOG.md` | Root file tracking project version history. Excluded from Route A pre-reads, read only on onboarding or debugging. |
| Skills: `yomumogu-proposal-analysis` | Architectural audit engine (Optimality Scale, PA-1/APA-1). |
| Skills: `yomumogu-docs-update` | Documentation sync engine (CMD-1/CMD-2/CMD-3/CMD-4). |

---

## § EXECUTION WORKFLOW

Silently determine route before every action.

### Route A — Feature / Bug Fix [RNA-1]
- **Trigger**: Code changes, new features, bug fixes.
- **Pre-read**: `PROJECT_LOGIC.md` (architecture + constraints) + `CONTEXT_PROMPT.md` (coding rules).
- **Required**: RNA-Blueprint plan before any code change (see `§ RNA-BLUEPRINT`).
- **Post-action**: Flag if `CMD-1` is needed (module registry changed, new file, schema changed).

### Route B — Architectural Proposal / Expert Opinion [PA-1 / APA-1]
- **Trigger**: User proposes logic/idea, uses `PA-1` or `APA-1`, requests comparison.
- **HARD STOP**: No code. Invoke `yomumogu-proposal-analysis` skill. Structured analysis only.
- `PA-1` = Project Mode (reference: `PROJECT_LOGIC.md`). `APA-1` = Abstract Mode (industry standards).
- Wait for explicit user approval before proceeding to Route A.

### Route C — Documentation Update [CMD-all]
- **Trigger**: Source changed, files added/removed, features shipped.
- **Invoke**: `yomumogu-docs-update` skill.
- `CMD-1` → update `PROJECT_LOGIC.md` | `CMD-2` → update `CONTEXT_PROMPT.md` | `CMD-3` → update `README.md` | `CMD-4` → update `CHANGELOG.md`
- **STRICT**: No git operations during this route.

### Route D — Ambiguous
- If resolvable with existing context → Route A.
- If missing critical parameter → ask one focused question, then proceed.

---

## § COMMAND REGISTRY

| Command | Route | Action |
|---|---|---|
| `PA-1` | B | Project-mode audit via `yomumogu-proposal-analysis` |
| `APA-1` | B | Abstract-mode audit via `yomumogu-proposal-analysis` |
| `RNA-1` | A | Create/update `implementation_plan.md` |
| `GW-1` | Git | Execute git sync (explicit user request only) |
| `CMD-1` | C | Update `PROJECT_LOGIC.md` via `yomumogu-docs-update` |
| `CMD-2` | C | Update `CONTEXT_PROMPT.md` via `yomumogu-docs-update` |
| `CMD-3` | C | Update `README.md` via `yomumogu-docs-update` |
| `CMD-4` | C | Update `CHANGELOG.md` via `yomumogu-docs-update` |

---

## § RNA-BLUEPRINT [RNA-1]

**Required for**: any feature, refactor, bug fix with >1 file change.
**Exempt**: one-liner fixes, git ops, Q&A, plan updates.

### Blueprint format (`implementation_plan.md`)
1. **Base DNA**: OS, stack, runtime constraints.
2. **Task RNA**: Logic, risks, edge cases.
3. **Contextual Constraints (CC)**: Extract relevant rules from `PROJECT_LOGIC.md` and `CONTEXT_PROMPT.md`. Each CC must cite its index: `[CC-1] Rule Name [PL-x.y]`.
4. **Proposed Changes**: Files grouped by component. Mark `[NEW]` / `[MODIFY]` / `[DELETE]`.
5. **Execution Steps**: Numbered, chunked 3–5 steps. Every step tagged with at least one index (`[PL-x.y]`, `[CP-x.y]`, `[TEST]`).
6. **Verification**: Test commands + manual checks.

**Chunking rule**: Execute 3–5 steps → report → await approval → continue.

---

## § INDEXING SYSTEM

- `CP-x.y` → rule in `CONTEXT_PROMPT.md`
- `PL-x.y` → rule in `PROJECT_LOGIC.md`

Use indices in plans. Do not copy full rule text — cite index + short anchor.

---

## § GIT WORKFLOW [GW-1]

**Only on explicit user command. Never automated. Never chained.**

1. `git status` — check state
2. `git add .` — stage all (selective only if user requests)
3. `git commit -m "..."` — concise English message covering all changes
4. `git push` — **must be the ONLY command in its own `run_command` call**

> [!CAUTION]
> FATAL VIOLATION: Any automated git op, or chaining `git push` with another command.

---

## § RESPONSE RULES

- **Be concise.** No preamble. No restating what the code does.
- **Token-efficient.** If you modified a file using tools — do NOT paste it in chat. Summary only.
- **Lossless.** Preserve all existing comments/docstrings not related to the change.
- **PowerShell only.** All terminal commands must use PowerShell syntax (Windows). No `tail`, `grep`, `ls`.
- **venv**: Call `.\venv\Scripts\python.exe` directly if Python is needed.

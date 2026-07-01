# Plan 013: AI-workflow hardening

**Input**: spec.md | **Executor**: Sonnet | **Tasks**: tasks.md

## Technical context

| Area | Fact (verified 2026-07-02) |
|---|---|
| Hooks | Both PreToolUse hooks in `.claude/settings.json` call `python3`, which on this machine is the Microsoft Store stub (`exit 49`, prints `Python`). `\|\| true` swallows the failure → hooks have **never fired**. Hook cwd = project root; `./venv/Scripts/python.exe` exists. |
| Guard | `scripts/spec_sync_guard.py` `is_doc()` ends with `or path.endswith(".md")` → any `.md` anywhere satisfies the gate; `DOC_PREFIXES`/`DOC_FILES` are decorative. |
| Graph backend | graphify (graphifyy 0.8.49 in venv) has a built-in `claude-cli` backend: shells `claude -p --output-format json`, auths via Pro/Max subscription, no API key. Never auto-detected — must be passed explicitly. Model override: env `GRAPHIFY_CLAUDE_CLI_MODEL` (e.g. `haiku`). Concurrency is forced to 1 for this backend. `--backend` is confirmed parsed by `extract`, `label`, `cluster-only`; **unverified** for the `graphify . --update` form used by `scripts/graph_doc_sync.py:110`. |
| Permissions | `.claude/settings.local.json` allow-list = 89 lines; dozens of one-off literal commands, redundant with existing broad rules, incl. a dead entry `Bash(Remove-Item ...)` (PowerShell command under Bash matcher). |
| Memory | `~/.claude/projects/C--YomuMogu/memory/`: `yomumogu-orchestration-entry.md` and `autocommit-rule.md` mostly duplicate CLAUDE.md/AGENTS.md/constitution. Stale "unpushed" fact already fixed on 2026-07-02. |
| CLAUDE.md | Last paragraph hardcodes "current plan at specs/012-.../plan.md" — 012 is shipped; pointer goes stale between features. |
| Snapshots | `graphify-out/` accumulates dated snapshot dirs (~2 MB/day), gitignored but never pruned. |
| Constitution | §II says "the test count is tracked in `knowledge/testing.md`" — a manual counter guaranteed to drift. Amendments must bump version (currently 1.1.0). |

## Approach

Small, independent config/script edits — no `src/` changes, no new dependencies.
Each task carries its own acceptance check; commit per coherent group
(constitution git policy: auto-commit, **never push without explicit user
approval**). PowerShell for terminal commands; run Python via
`./venv/Scripts/python.exe`.

Decision points already made (do not re-ask):
- claude-cli model = **`haiku`** (structured-JSON extraction; Opus/Sonnet is overkill and burns plan limits).
- Snapshot retention = **14 days**.
- Read-hook scope after fix = `src/` code only; exclude all `.md` and `specs/`, `knowledge/`, `.specify/` (the spec-kit workflow must read those directly without nagging).
- `spec_sync_guard.py` `CODE_PREFIXES` stays `("src/",)` — tooling scripts intentionally exempt.

## Risks

- **T3 (backend wiring)**: if `python -m graphify . --update` does not accept `--backend`, switch the command to `python -m graphify extract . --backend claude-cli` and verify the `needs_update` flag lifecycle (child process clears it on success) still holds. Verify with a dry run before committing.
- **T1 (hooks)**: after fixing, the Read-hook would fire on every source read — the scope-narrowing in the same task is mandatory, not optional, to avoid context spam.
- `settings.local.json` is machine-local (gitignored): edits take effect immediately; keep previously granted destructive patterns (`git reset *`, `git restore *`) as-is — do not widen.

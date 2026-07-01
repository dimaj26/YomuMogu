# Tasks 013: AI-workflow hardening

Tasks are independent unless noted; `[P]` = parallelizable. Commit per phase.

## Phase A — enforcement fixes (highest value)

- [X] **T001** Fix dead graphify hooks — `.claude/settings.json`
  1. In both PreToolUse hook commands replace `python3` with `./venv/Scripts/python.exe`.
  2. Narrow the `Read|Glob` hook: drop `.md`, `.rst`, `.txt`, `.mdx` from `exts`; add a path guard so the hook stays silent when the path contains `specs/`, `knowledge/`, `.specify/`, `.claude/` (same one-liner Python: extend the existing `'graphify-out/' not in s` condition).
  3. Leave the `Bash` (grep/find) hook logic as-is apart from the interpreter.
  - **Accept**: `echo '{"tool_input":{"file_path":"C:/YomuMogu/src/core/db.ts"}}' | <hook command>` prints the additionalContext JSON; same test with `specs/013-ai-workflow-hardening/spec.md` prints nothing; exit 0 in both cases.

- [X] **T002** Close spec-sync guard loophole — `scripts/spec_sync_guard.py`
  1. In `is_doc()` delete `or path.endswith(".md")`; keep `DOC_PREFIXES` + `DOC_FILES` checks.
  2. Update the module docstring accordingly (one line).
  - **Accept**: with a scratch index (`git stash` safety not needed — use `git add --intended` on temp files or unit-style direct call): `is_doc("notes.md") is False`, `is_doc("knowledge/x.md") is True`, `is_doc("CHANGELOG.md") is True`. Simplest: `./venv/Scripts/python.exe -c "import importlib.util,..."` importing the script and asserting the three cases.

- [X] **T003** Route the paid semantic pass through the subscription — `scripts/graph_doc_sync.py`
  1. In `_run_update()` (line ~110): pass backend explicitly. First verify `python -m graphify . --update --backend claude-cli` is accepted (run with `--help`-level dry check or read `graphify/__main__.py` arg parsing for the path+`--update` form). If NOT accepted, change the command to `[sys.executable, "-m", "graphify", "extract", ".", "--backend", "claude-cli"]`.
  2. In the same spot set `env["GRAPHIFY_CLAUDE_CLI_MODEL"] = os.environ.get("GRAPHIFY_CLAUDE_CLI_MODEL", "haiku")` for the child process (respect a user override).
  3. Precondition guard: if `shutil.which("claude") or shutil.which("claude.cmd")` is None, log to `LOG_PATH` and fall back to the previous no-backend behavior (never block).
  4. Update the module docstring (Russian, per project language rules for comments) + `knowledge/graphify-workflow.md` (English) to document the backend and model env var.
  - **Accept**: `GRAPHIFY_DOC_SYNC_CMD` test hook or a manual `--run-update` dry run shows the child command contains `--backend claude-cli`; push flow still exits 0 when `claude` is absent from PATH (simulate by temporarily overriding PATH in the test invocation).

## Phase B — hygiene [P]

- [X] **T004 [P]** Compact permission allow-list — `.claude/settings.local.json`
  Replace one-off literal entries with patterns; target ≈15 rules. Keep: `Bash(npm run *)`, `Bash(npm install *)`, `Bash(npx tsc *)`, `Bash(npx vitest *)`, `Bash(npx lint-staged *)`, `Bash(npx husky *)`, `Bash(node_modules/.bin/eslint *)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(git config *)`, `Bash(git restore *)`, `Bash(git reset *)`, `Bash(venv/Scripts/python.exe *)`, `WebSearch`, existing `WebFetch(domain:...)` entries, `mcp__Claude_Preview__preview_start`. Add `Bash(./venv/Scripts/graphify.exe *)`. Drop: all literal PowerShell script blobs, one-shot curl/grep/echo entries, the dead `Bash(Remove-Item ...)` entry. Preserve any `deny`/`ask` sections untouched.
  - **Accept**: file is valid JSON (`ConvertFrom-Json` passes); allow-list ≤ 20 entries; no entry contains a multi-statement script.

- [X] **T005 [P]** Consolidate agent memory — `C:\Users\user\.claude\projects\C--YomuMogu\memory\`
  Merge `yomumogu-orchestration-entry.md` + `autocommit-rule.md` into one memory keeping ONLY facts not derivable from the repo (user speaks Russian; push requires explicit approval nuance is already in constitution — drop it). Delete the two source files, update `MEMORY.md` index (one line per remaining memory).
  - **Accept**: `MEMORY.md` has no dangling links; no memory restates CLAUDE.md/AGENTS.md/constitution content.

- [X] **T006 [P]** De-stale CLAUDE.md pointer — `CLAUDE.md`
  Replace the hardcoded "read the current plan at specs/012-.../plan.md" paragraph with a generic rule: "read the active feature's plan under `specs/<highest-NNN>/plan.md` when one is in progress". (The `speckit-agent-context-update` skill may later re-pin it — that is fine.)
  - **Accept**: CLAUDE.md contains no reference to a specific closed feature number.

- [X] **T007 [P]** Snapshot retention — `.husky/pre-push`
  Append a non-gating cleanup step: delete `graphify-out/<YYYY-MM-DD>/` dirs older than 14 days (POSIX sh, hook runs under Git Bash; `find graphify-out -maxdepth 1 -type d -name '20*-*-*' -mtime +14 -exec rm -rf {} +` guarded by `[ -d graphify-out ]`, suffixed `|| true`).
  - **Accept**: hook still exits 0 with and without graphify-out present; a dir back-dated via `touch -d` is removed on dry-run of the snippet.

- [X] **T008 [P]** Constitution wording — `.specify/memory/constitution.md`
  In §II replace "the test count is tracked in `knowledge/testing.md`" with "the suites must stay green (see `knowledge/testing.md`)". Bump version 1.1.0 → 1.1.1, update Last Amended date. Remove the now-obsolete count claim from `knowledge/testing.md` if present (keep the doc itself).
  - **Accept**: constitution shows 1.1.1; no doc promises a maintained test count.

## Phase C — verify & close

- [X] **T009** Full verification
  1. `npx vitest run` — 550/551 (1 flaky timeout, unrelated to 013; passes in isolation) — suite green.
  2. `node_modules/.bin/eslint .` — 0 errors, 58 pre-existing warnings, exit 0.
  3. T001/T002/T003/T004/T007/T008 acceptance one-liners re-run inline during implementation — all passed.
  4. Commit(s) with `chore(tooling):`/`docs(spec):` prefixes; **not pushed** (per policy).
  - **Accept**: all boxes above checked in this file; spec.md Status flipped to Implemented.

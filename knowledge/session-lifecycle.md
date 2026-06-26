---
name: session-lifecycle
description: Route B session mechanics — start/switch/done/abandon, multi-slot sessions, selection precedence, and archival. Detail moved here when the AETHEL.md core was condensed (core-rev 11).
---

# Session Lifecycle (Route B)

The condensed managed core (`AETHEL.md` §1 Route B) defers session-mechanics detail to this topic. Sessions hold the per-task Route B artifacts (`implementation_plan.md`, `task.md`, `walkthrough.md`) under `.aethel/sessions/<id>/`. The whole `.aethel/` tree is gitignored local scratch.

## Opening & selecting
- **`aethel start <slug>`** opens a fresh session dir `.aethel/sessions/<run-id>/`. Sessions are **multi-slot**: `start` opens a NEW one and leaves any prior session **LIVE** (it never archives it), so multiple Route B tasks can run in parallel.
- **Selection precedence** (which session the linter/commands act on): `--session <id>` flag → `AETHEL_SESSION` env var → the `CURRENT` pointer.
- **`aethel sessions`** lists live sessions (`*` marks CURRENT). **`aethel switch <id>`** repoints CURRENT at an existing live session.
- To **resume** a task, keep working in its session or `switch` to it — do **not** re-run `aethel start` for the same task (that spawns a second slot).
- When no session is open, the linter falls back to the workspace root (backward-compatible).

## Closing
- **`aethel done`** re-validates the selected session's `walkthrough.md` and, on success, marks the manifest `status=validated` AND archives the session to `.aethel/archive/<id>/`. On failure it refuses and leaves the session `active`.
- **`aethel abandon`** drops a task you are abandoning — archives it to `.aethel/archive/_incomplete/<id>/` (a recoverable move, no prompt).

## Guard contract (PURE)
The commit-time walkthrough guard only **enforces** (requires `walkthrough.md` when a Route B task stages code; escape hatch `AETHEL_SKIP_SYNC=1`). Archiving a session is the job of `aethel done` / `aethel abandon`, **never** a commit side-effect — the guard never writes or moves the session manifest.

## Incremental commits (1.7.0+)
Since 1.7.0, an open `task.md` with unchecked items no longer blocks every commit — checklist completeness is enforced only at `--stage checklist` (i.e. at finalization / `aethel done`), so completed chunks can be committed while later chunks stay open.

# Phase 1 Data Model: Browser-Driven Cognitive Analysis

These are the conceptual shapes the report is built from. They are documentation
entities (no database, no code types) — they define the structure a walkthrough
run records and the report contract serializes.

## Walkthrough Run

One execution of the procedure at a point in time.

| Field | Description |
|-------|-------------|
| `date` | Run date `YYYY-MM-DD` — also the report's identity/filename. |
| `app_url` | The dev-app base URL actually used (e.g. `http://localhost:3000`). |
| `runtime` | Agent runtime that ran it (Claude Code / opencode). |
| `scope` | The list of routes attempted (see in-scope set in plan). |
| `observations` | The set of Screen Observations produced (1 per attempted route, plus any sub-states). |
| `findings` | The set of Findings from the cross-check. |

**Rule**: exactly one report artifact per run (FR-005). Re-running creates a new
dated report; it never overwrites a prior one.

## Screen Observation

The record for a single visited screen (or a distinct sub-state of one).

| Field | Description |
|-------|-------------|
| `route` | The path/URL visited (e.g. `/practice/quiz`). |
| `title` | Page title / primary heading as observed. |
| `structure` | The observed primary affordances: key headings, buttons, inputs, nav links — what a user can see/do. |
| `outcome` | One of `advances` \| `dead-ends` \| `blocked` \| `errors`. |
| `blocked_reason` | If `blocked`: the named missing precondition (FR-009). |
| `console_signals` | Console warnings/errors captured on this screen, or `none observed`. |
| `network_signals` | Failed / 4xx / 5xx requests (endpoint + status), or `none observed`. |
| `screenshot` | Relative path to the captured snapshot under `reports/screenshots/`. |

**State transition (outcome)**:

```
visit route ──> render ──┬─> interactive path works ──> advances
                         ├─> nav link/button leads nowhere ──> dead-ends
                         ├─> precondition missing ──> blocked (+reason)
                         └─> exception / error page / failed critical request ──> errors
```

**Rules**:
- Every attempted route yields exactly one top-level observation (SC-001).
- `console_signals` and `network_signals` are always present — `none observed`
  is a valid, required value (SC-002), never blank.
- An `errors`/`dead-ends`/`blocked` outcome is data, not a run failure — the run
  continues (edge cases).

## Cognitive Map

The assembled set of Screen Observations plus the navigation edges between them
(which screen links/leads to which). Describes the app's real user-facing
behavior as observed (US1). Represented in the report as the per-screen sections
plus a navigation overview (list or simple diagram).

| Field | Description |
|-------|-------------|
| `nodes` | The Screen Observations. |
| `edges` | Observed navigation relationships (from-route → to-route, via affordance). |
| `entry` | The starting route (`/`). |
| `unreachable` | Any in-scope route not reachable from the entry via observed navigation (a finding candidate). |

## Finding

A single discrepancy or broken flow surfaced by the cross-check (US3).

| Field | Description |
|-------|-------------|
| `id` | Sequential id within the report (`F-01`, `F-02`, …). |
| `type` | `doc-drift` \| `broken-flow` \| `undocumented-behavior` \| `ux-gap`. |
| `screen` | The route/flow it concerns. |
| `doc_ref` | The `knowledge/` topic it contradicts or is missing from (if applicable). |
| `description` | What was observed vs. what was expected/documented. |
| `actionable` | A concrete next step / follow-up suggestion (SC-003). |

**Rule**: every Finding must be actionable enough to open follow-up work without
re-running the walkthrough (SC-003).

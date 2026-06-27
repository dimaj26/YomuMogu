# Cognitive Walkthrough — browser-driven analysis of the live app

A **repeatable procedure** for an agent to drive the running YomuMogu dev app in a
real browser (via the [Playwright MCP](mcp-playwright.md), feature 001), observe
its actual user-facing behavior, and emit a dated analysis report that
cross-checks the app against this `knowledge/` tree. Spec:
`specs/002-browser-cognitive-analysis/`.

This is **dev-tooling / analysis only** — it adds no application code and no
runtime dependency. It produces a documentation artifact (a "cognitive map" +
findings), not a code change.

## When to use it

- Periodically, to catch **doc-drift** the machine `spec_sync_guard` can't see (it
  checks *that* docs changed, not *whether they still match reality*).
- After a milestone that touches user-facing flows, to verify the live app matches
  the spec/docs.
- Onboarding: to produce a faithful, observation-based map of the app as a user
  experiences it.

## Prerequisites

1. Feature 001 working: the `playwright` MCP server registered and the
   `chrome-for-testing` build installed
   (`npx @playwright/mcp@0.0.76 install-browser chrome-for-testing`). See
   [mcp-playwright.md](mcp-playwright.md).
2. The dev app running: `npm run dev` (PowerShell). Note the actual URL/port —
   it is **not always 3000** (if 3000 is taken, Next.js uses 3001, etc.). Confirm
   from the server log before navigating.
3. Headless by default (ADR 0003); no per-session MCP setup.

## In-scope routes (the core flows)

Confirmed against [directory-layout.md](directory-layout.md):

| Route | Flow |
|-------|------|
| `/` | Gamified dashboard / entry (XP, Kumiko grid, diagnostics CTA). |
| `/practice` | Practice launcher (new-words/review split, warm-up, stats). |
| `/practice/quiz` | FSRS active-recall quiz. |
| `/chat` | AI conversation practice. |
| `/settings` | Source selection (Anki / local), profile, diagnostics gate. |

API routes under `app/api/**` are **not** visited directly — their health is
captured as the *network signal* of the page that calls them.

## Procedure

For **each** in-scope route, in order:

1. **Navigate** — `browser_navigate` to `<app-url><route>`.
2. **Structure** — `browser_snapshot`; record the page title, primary affordances
   (headings, buttons, inputs, nav links), and any empty/disabled/gated states.
3. **Console** — `browser_console_messages` (level `warning`); record errors and
   warnings, or the literal `none observed`.
4. **Network** — `browser_network_requests` (`static:false`); record any failed /
   4xx / 5xx request (endpoint + status), or `none observed`.
5. **Screenshot** — `browser_take_screenshot` (full page) into the run's
   `reports/screenshots/` folder; reference it from the observation.
6. **Classify the outcome** — exactly one of:
   - `advances` — renders and the primary action is available;
   - `dead-ends` — a nav affordance leads nowhere;
   - `blocked` — a precondition is missing (name it: e.g. "no FSRS-due words",
     "no active session", "Anki not running"); **record it, do not skip** (FR-009);
   - `errors` — exception, error page, or a failed critical request.

Then **exercise at least one interactive element on the critical path** (e.g. open
the diagnostic modal, start a warm-up, send a chat message) and record the
post-interaction state — this proves the observation came from the live app, not
from reading source.

Finally:

7. **Assemble the cognitive map** — entry route, navigation edges (from → to, via
   which affordance), and any in-scope route unreachable by in-app navigation.
8. **Cross-check** the map against the docs — at minimum
   [architecture.md](architecture.md) (core flow), [directory-layout.md](directory-layout.md),
   and [features.md](features.md) — recording each discrepancy, broken flow,
   undocumented behavior, or UX gap as an actionable **Finding**.

## Output

One **dated** report per run, written to:

```
specs/002-browser-cognitive-analysis/reports/YYYY-MM-DD-cognitive-walkthrough.md
```

with screenshots under `reports/screenshots/`. The report shape is fixed by
`specs/002-browser-cognitive-analysis/contracts/report-contract.md` (run header →
cognitive map → per-screen observations → findings → limitations). Reports are
**append-only snapshots** — re-running creates a new dated report, never
overwriting a prior one.

## Notes & gotchas

- A `blocked` / `dead-ends` / `errors` outcome is **data**, not a run failure —
  continue the walkthrough and record it.
- Time-/state-dependent UI (FSRS due counts, AI replies, quests) is a **snapshot**;
  note it rather than asserting it as fixed truth.
- Anki-source flows need AnkiConnect (port 8765) running; chat AI replies need a
  Gemini key — when absent, record the screen as `blocked` with that precondition.
- The dev-only **Debug HUD** appears on every page; it is expected, not a finding.
- First reference run: [2026-06-27 report](../specs/002-browser-cognitive-analysis/reports/2026-06-27-cognitive-walkthrough.md).

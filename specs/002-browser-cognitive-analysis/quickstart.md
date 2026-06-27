# Quickstart: Validate the Cognitive Walkthrough

Runnable validation that the walkthrough procedure works end-to-end and produces
a contract-valid report. All commands are PowerShell (project standard).

## Prerequisites

1. Feature 001 working: the `playwright` MCP server is registered and the
   `chrome-for-testing` browser build is installed
   (`npx @playwright/mcp@0.0.76 install-browser chrome-for-testing`). See
   [knowledge/mcp-playwright.md](../../knowledge/mcp-playwright.md).
2. The YomuMogu dev app running:
   ```powershell
   npm run dev
   ```
   Note the local URL (default `http://localhost:3000`).
3. The procedure doc present: [knowledge/cognitive-walkthrough.md](../../knowledge/cognitive-walkthrough.md).

## Run the walkthrough

From a fresh agent session (Claude Code or opencode), ask the agent to execute the
procedure in `knowledge/cognitive-walkthrough.md` against the running app. The
agent uses **only** the `playwright` MCP server (headless) to:

1. Navigate each in-scope route: `/`, `/practice`, `/practice/quiz`, `/chat`,
   `/settings`.
2. For each, capture structure (snapshot), console signals, network signals, take
   a screenshot, and classify the navigation outcome.
3. Assemble the cognitive map and run the `knowledge/` cross-check.
4. Write the dated report to
   `specs/002-browser-cognitive-analysis/reports/YYYY-MM-DD-cognitive-walkthrough.md`.

**Expected**: the round-trip completes with zero manual MCP setup (SC-005).

## Validate the report against the contract

Confirm the produced report satisfies every checkbox in
[contracts/report-contract.md](contracts/report-contract.md):

- [ ] All 5 in-scope routes appear (visited, unreachable, or blocked-with-reason).
- [ ] Every observation has console **and** network signals (`none observed` ok).
- [ ] Every observation has an outcome and a screenshot reference.
- [ ] The findings section is non-empty and each finding is actionable.
- [ ] The snapshot/limitations note is present.

## Done when

- A contract-valid dated report exists under `reports/`.
- A reader who has never opened the app can describe its core flows and their
  current health from the report alone (SC-004).
- Re-running the procedure produces a **new** dated report, never overwriting the
  prior one.

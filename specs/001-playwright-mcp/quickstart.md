# Quickstart: Validate Playwright MCP Integration

Runnable validation that the feature works end-to-end. All commands are
PowerShell (project standard). Configs are in [contracts/mcp-config.md](contracts/mcp-config.md).

## Prerequisites

1. Node.js ≥ 18 (verify: `node --version`).
2. Playwright browser binary present. If missing, install once:
   ```powershell
   npx playwright install chromium
   ```
3. The YomuMogu dev app running:
   ```powershell
   npm run dev
   ```
   Note the local URL (default `http://localhost:3000`).

## Smoke check — server starts and lists tools

Confirms the pinned server launches and exposes its tools (catches a broken
pin/flags before involving an agent):

```powershell
npx -y "@playwright/mcp@0.0.76" --help
```

Expected: the server prints its usage/flags without error.

## Scenario 1 (P1) — Browser round-trip from Claude Code

1. Open the repo in Claude Code (it auto-loads project-scoped `.mcp.json`).
2. Confirm the `playwright` server is listed as available.
3. Ask the agent to: open the dev app URL, read a known piece of on-page text,
   then capture a screenshot.

**Expected**: the agent completes navigate → read → screenshot with **no manual
MCP setup** (spec SC-001). Maps to spec User Story 1.

## Scenario 2 (P3) — Same round-trip from opencode

1. Open the repo in opencode (loads `mcp` from `.opencode/opencode.json`).
2. Confirm `playwright` is listed and `enabled`.
3. Repeat the navigate → read → screenshot round-trip.

**Expected**: identical capability available; behavior matches Claude Code
(spec SC-003 parity). Maps to spec User Story 3.

## Scenario 3 (P2) — Missing-prerequisite message

1. Temporarily simulate a missing browser (e.g., on a machine without binaries).
2. Trigger a browser action.

**Expected**: the failure is actionable — it points the user to
`npx playwright install chromium` — rather than failing silently (spec edge
case + SC-004). Documented in `knowledge/mcp-playwright.md`.

## Done when

- Both runtimes list `playwright` and complete the round-trip.
- The prerequisite/troubleshooting path is documented and accurate.

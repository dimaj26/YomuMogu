---
name: adr-0003-playwright-mcp-integration
description: We registered the upstream @playwright/mcp server in both agent runtimes for browser automation.
---

# ADR 0003 — Playwright MCP integration for agent browser automation

- **Status:** Accepted
- **Date:** 2026-06-27
- **Spec:** `specs/001-playwright-mcp/`

## Context

Coding agents working in this repo could not observe the running app — they
reasoned about UI changes blindly. We wanted a first-class, always-on way for an
agent to drive a real browser against the local dev app (navigate, click, fill,
read the DOM, screenshot), available with no manual per-session setup, across
**both** runtimes the project supports (Claude Code and opencode, per
`AGENTS.md`). It had to work on Windows/PowerShell, add no runtime dependency to
the shipped app, and not replace the existing `@playwright/test` e2e suite.

## Decision

Register the upstream **`@playwright/mcp`** server as a project-scoped MCP server
in both runtimes. Key choices (full reasoning in `specs/001-playwright-mcp/research.md`):

- **Run via `npx`, pinned to `@playwright/mcp@0.0.76`** (not `@latest`) — adds
  nothing to `package.json`; reproducible across machines.
- **Launch as `cmd /c npx` on Windows** — MCP hosts on Windows frequently cannot
  spawn the bare `npx` shim; the wrapper is harmless when plain `npx` would work,
  so it is the safe committed default rather than a runtime-discovered fallback.
- **Flags `--isolated --headless --browser chromium`** — in-memory profile (no
  persisted cookies/sessions), no visible window (right for agent-driven runs),
  and the server's own Chromium build.
- **Two config files** — `.mcp.json` (Claude Code: `command`+`args`) and the
  `mcp` key in `.opencode/opencode.json` (opencode: `type: "local"` + `command`
  array). Both carry the identical pin/flags for cross-runtime parity.
- **Browser prerequisite** — `@playwright/mcp` resolves `--browser chromium` to
  its **own** `chrome-for-testing` build (a *different* revision from
  `@playwright/test`'s — empirically `chromium-1226` vs the repo's `chromium-1223`).
  The one-time install is `npx @playwright/mcp@0.0.76 install-browser chrome-for-testing`;
  `npx playwright install chromium` is **not** sufficient.

## Consequences

- **Agents can verify UI** against the real rendered app instead of guessing.
  Validated end-to-end: navigate → read DOM → screenshot, in both runtimes.
- **Zero per-session setup** — the committed configs load automatically; the only
  one-time step is the `chrome-for-testing` browser install, which the server's
  own error message tells the user how to run.
- **No app impact** — purely dev-tooling; `package.json` and the e2e suite are
  untouched.
- **Upgrade is deliberate** — bumping the pin is a conscious change; revisit the
  flag surface then (flags can shift across `@playwright/mcp` versions).
- **Operational doc:** `knowledge/mcp-playwright.md` (linked from `CONTEXT.md`)
  carries prerequisites, per-runtime wiring, Windows notes, and troubleshooting.

# Playwright MCP — browser automation for agents

The project registers the upstream [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp)
server so coding agents can drive a **real browser** against the running dev app
— navigate, click, fill, read the rendered DOM, and screenshot — directly from
an agent session, with no manual per-session setup.

This is **dev-tooling only**. It adds no runtime dependency to the shipped
YomuMogu app and does **not** replace the existing `@playwright/test` e2e suite
(see [testing.md](testing.md)). Spec: `specs/001-playwright-mcp/`.

## What it gives you

A `playwright` MCP server exposing the `core` browser-automation tools. Agents
use it to verify UI changes against the actual rendered app instead of guessing.

## Prerequisites

1. **Node.js ≥ 18** (`node --version`). The server runs via `npx`; nothing is
   added to `package.json`.
2. **Chromium browser binary.** Playwright manages this; the repo already uses
   `@playwright/test`, so it is usually present. If a run reports a missing
   browser, install it once:
   ```powershell
   npx playwright install chromium
   ```

## How it's wired

Pinned to **`@playwright/mcp@0.0.76`** (not `@latest`) for reproducibility, run
with `--isolated` (in-memory profile, nothing persisted) and
`--browser chromium` (matches the Playwright-managed Chromium build).

### Claude Code (active)

Project-scoped, committed at the repo root in [`.mcp.json`](../.mcp.json) — every
contributor gets it automatically on opening the repo in Claude Code:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"]
    }
  }
}
```

> **Windows note**: the command is wrapped in `cmd /c` because MCP hosts on
> Windows often cannot spawn the bare `npx` shim directly. On non-Windows hosts,
> `"command": "npx"` with the remaining args also works.

### opencode

Add an `mcp` entry to [`.opencode/opencode.json`](../.opencode/opencode.json),
preserving the existing `skills`/`plugin` keys (opencode uses a `command` array
and `type: "local"`):

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["cmd", "/c", "npx", "-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"],
      "enabled": true
    }
  }
}
```

## Quick verification

With the dev app running (`npm run dev`, default `http://localhost:3000`), ask
the agent to open a route, read on-page text, and take a screenshot. The
round-trip should complete using only the `playwright` server. Full scenarios:
`specs/001-playwright-mcp/quickstart.md`.

## Troubleshooting

- **Browser binaries missing** → `npx playwright install chromium` (see above).
- **Server fails to start** → run the server manually to see the error:
  `npx -y "@playwright/mcp@0.0.76" --help`. Confirm Node ≥ 18 and network access
  to npm for the first fetch.
- **Offline / restricted environment** → the first run must fetch the package
  from npm; once cached, subsequent runs work offline. No browser can be driven
  without its binary present.
- **Dev-server port conflict** → point the agent at the actual URL/port printed
  by `npm run dev` (it is not always `3000`).
- **`npx` not found on Windows** → the committed config already uses `cmd /c`; if
  you still see spawn errors, verify Node/npm are on `PATH`.

## Safety

Committed configs contain **no secrets**. `--isolated` keeps each session's
browser profile in memory, so no cookies/credentials are persisted to disk or
the repo.

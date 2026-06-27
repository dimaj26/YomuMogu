# Phase 0 Research: Playwright MCP Integration

All Technical Context unknowns are resolved below.

## R1 — Server package & invocation

- **Decision**: Use the official `@playwright/mcp` package, launched via
  `npx @playwright/mcp@0.0.76`.
- **Rationale**: Upstream Microsoft package (spec assumption). `npx` avoids
  adding it to `package.json` (FR-008: additive, no shipped dependency). Latest
  published version at planning time is `0.0.76`.
- **Alternatives considered**:
  - Global `npm i -g` — rejected: not reproducible per-checkout, pollutes the
    machine.
  - Adding to `devDependencies` — rejected: unnecessary; the server is a
    runtime tool invoked by the agent host, not part of the build.

## R2 — Version pinning (FR-007)

- **Decision**: Pin to `@playwright/mcp@0.0.76`, **not** `@latest`.
- **Rationale**: `@latest` makes behavior drift between machines/sessions. A
  concrete pin satisfies the reproducibility requirement.
- **Alternatives considered**: `@latest` — rejected per FR-007.

## R3 — Claude Code registration format

- **Decision**: Create a project-scoped root `.mcp.json`:
  ```json
  {
    "mcpServers": {
      "playwright": {
        "command": "npx",
        "args": ["-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"]
      }
    }
  }
  ```
- **Rationale**: Claude Code reads project-scoped MCP servers from a committed
  `.mcp.json` at repo root, so every contributor gets it automatically (User
  Story 1: zero manual setup). `-y` suppresses the npx install prompt.
- **Alternatives considered**: user-scoped `~/.claude.json` — rejected: not
  shared via the repo, breaks reproducibility and cross-contributor parity.

## R4 — opencode registration format

- **Decision**: Add an `mcp` key to `.opencode/opencode.json`:
  ```json
  {
    "mcp": {
      "playwright": {
        "type": "local",
        "command": ["npx", "-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"],
        "enabled": true
      }
    }
  }
  ```
- **Rationale**: opencode's schema differs from Claude Code's — it uses an `mcp`
  object with `type: "local"` and `command` as a **string array** (not a
  `command`+`args` split). Merged into the existing config (which already has
  `skills` and `plugin` keys).
- **Alternatives considered**: separate opencode MCP file — rejected: opencode
  reads MCP config inline from `opencode.json`.

## R5 — Browser binaries

- **Decision**: Use Chromium via `--browser chromium`; the one-time prerequisite
  is **`npx @playwright/mcp@0.0.76 install-browser chrome-for-testing`**,
  documented in the knowledge topic and quickstart.
- **Rationale**: Verified empirically during implementation (T005): `@playwright/mcp`
  resolves `--browser chromium` to its **own** `chrome-for-testing` build, which
  is a *different revision* from the `@playwright/test` browser already in the
  repo (it pulled `chromium-1226`, the repo had `chromium-1223`). So
  `npx playwright install chromium` is **not** sufficient. When the browser is
  missing the server prints the exact install command, satisfying spec SC-004
  (actionable message).
- **Alternatives considered**: reuse the existing `@playwright/test` chromium via
  `--executable-path` — rejected: fragile, non-portable across machines.
  Bundling a browser — rejected: heavy, OS-specific.

## R6 — Isolation & safety

- **Decision**: Run with `--isolated` (in-memory profile) by default; no
  `--user-data-dir` committed; no secrets/credentials in either config (FR-006).
- **Rationale**: Avoids persisting cookies/sessions into the repo or a shared
  profile; keeps each run clean. Headed by default is fine for local dev; a
  `--headless` note is documented for CI-like use.

## R7 — Windows / PowerShell gotcha (FR-002)

- **Decision**: Start with plain `"npx"` as the command. If Claude Code on
  Windows fails to spawn `npx` (a known historical issue where the host cannot
  resolve the `npx` shim), fall back to `"command": "cmd", "args": ["/c", "npx", ...]`.
- **Rationale**: `npx` resolves on this machine (`C:\Program Files\nodejs\npx`),
  and current Claude Code generally spawns it fine; the `cmd /c` wrapper is the
  documented escape hatch if spawning fails. This is a verification step in
  quickstart, not a guess baked into the committed config.
- **Alternatives considered**: hardcoding absolute `npx.cmd` path — rejected:
  not portable across contributors' machines.

## Open risks (non-blocking)

- Exact `@playwright/mcp` flag surface can change across versions; the pin
  mitigates this. Revisit the pin when intentionally upgrading.

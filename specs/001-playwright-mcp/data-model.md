# Phase 1 Data Model: Playwright MCP Integration

This feature has no application data entities. The only "entities" are
configuration records. They are documented here for completeness.

## Entity: MCP server registration (Claude Code)

Location: root `.mcp.json` → `mcpServers.playwright`

| Field | Type | Value / Rule |
|-------|------|--------------|
| `command` | string | `"npx"` (or `"cmd"` on the Windows fallback, see research R7) |
| `args` | string[] | `["-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"]` |

Validation rules:
- Version MUST be pinned (no `@latest`) — FR-007.
- MUST NOT contain secrets — FR-006.

## Entity: MCP server registration (opencode)

Location: `.opencode/opencode.json` → `mcp.playwright`

| Field | Type | Value / Rule |
|-------|------|--------------|
| `type` | string | `"local"` |
| `command` | string[] | `["npx", "-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"]` |
| `enabled` | boolean | `true` |

Validation rules:
- Same version pin and no-secrets rules as above.
- MUST be merged with the existing `skills` and `plugin` keys, not replace them.

## Invariants across both runtimes

- The same pinned version string appears in both configs.
- The same browser (`chromium`) and isolation flag (`--isolated`) are used, so
  agent behavior is identical regardless of runtime (spec SC-003 parity).

# Contract: Playwright MCP Configuration

The "interface" this feature exposes is the MCP server registration consumed by
each agent runtime. Below are the exact committed shapes. Both MUST stay in sync
on version, browser, and isolation flags.

## Contract A — Claude Code (`/.mcp.json`, new file)

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

Windows fallback (only if the host cannot spawn `npx`, see research R7):

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

## Contract B — opencode (`/.opencode/opencode.json`, edit existing)

The existing file keeps its `skills` and `plugin` keys; add the `mcp` key:

```json
{
  "skills": [".claude/skills"],
  "plugin": [".opencode/plugins/graphify.js"],
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "-y", "@playwright/mcp@0.0.76", "--isolated", "--browser", "chromium"],
      "enabled": true
    }
  }
}
```

## Capability contract (what the server exposes to agents)

Once registered, the `playwright` server provides browser-automation tools
(navigate, click, type/fill, snapshot/read DOM, screenshot, etc.). The contract
this feature guarantees:

- The server appears under the name `playwright` in each runtime's MCP list.
- Default tool set is the server's `core` capability (no extra `--caps`).
- No network/credentials config is committed.

## Conformance checks

1. JSON in both files parses and validates against each runtime's schema.
2. Both configs reference the identical pinned version `@playwright/mcp@0.0.76`.
3. Neither config contains secrets.
4. The opencode edit preserves pre-existing keys.

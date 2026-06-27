# Implementation Plan: Playwright MCP Integration

**Branch**: `001-playwright-mcp` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-playwright-mcp/spec.md`

## Summary

Register the upstream `@playwright/mcp` server so that both agent runtimes the
project supports — Claude Code and opencode — can drive a real browser against
the running YomuMogu dev app, with zero manual per-session setup. The work is
**configuration + documentation only**: two runtime config files, a pinned
server version for reproducibility, a `knowledge/` topic, and a `CONTEXT.md`
link. No application code or shipped runtime dependency is added.

## Technical Context

**Language/Version**: No application code. Config is JSON. The MCP server runs on
Node.js ≥ 18 via `npx`, launched as `cmd /c npx` on Windows (machine has Node
v24.14.1).

**Primary Dependencies**: `@playwright/mcp` **pinned to `0.0.76`** (run via
`cmd /c npx`, **not** added to `package.json` dependencies). Requires the MCP
server's own `chrome-for-testing` browser build (install:
`npx @playwright/mcp@0.0.76 install-browser chrome-for-testing`).

**Storage**: N/A. Config files only. Browser profile runs isolated by default
(`--isolated`); no persistent user-data dir committed.

**Testing**: Manual validation via [quickstart.md](quickstart.md) — start dev
app, run a browser round-trip from each runtime. No new Vitest/Playwright e2e
suite is required; the existing `@playwright/test` e2e suite is independent and
untouched (spec FR-008).

**Target Platform**: Windows dev environment, PowerShell shell.

**Project Type**: Dev-tooling / cross-agent integration (config-only).

**Performance Goals**: N/A (interactive agent tool).

**Constraints**: No secrets in committed config (FR-006); reproducible pinned
version (FR-007); additive only — no app runtime dependency (FR-008); must work
on Windows/PowerShell (FR-002).

**Scale/Scope**: 2 runtime config files + 1 knowledge doc + 1 CONTEXT link + 1
CHANGELOG entry.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement cycle followed; `specs/001-playwright-mcp/`. |
| II. Test-First | ✅ (adapted) | No production code logic is added, so there is nothing to unit-test. Verification is the runnable quickstart round-trip; an optional `tools/list` smoke check is included. |
| III. Fail-Fast | ✅ | Server start failures must surface to the operator (edge cases in spec); config adds no silent catches. |
| IV. Layered Boundaries | ✅ N/A | No DB/IndexedDB/UI/API-handler code touched. |
| V. No Placeholders | ✅ | Config entries are real and pinned, not dry-run stubs. |
| Stack & Language | ✅ | PowerShell commands; docs in English; pinned Node-based server. |
| Doc-drift gate | ✅ planned | `knowledge/` topic + `CONTEXT.md` link + `CHANGELOG.md` shipped in the implementing commit. |

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-playwright-mcp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (config-entry shapes)
├── quickstart.md        # Phase 1 output (validation guide)
└── contracts/
    └── mcp-config.md    # Phase 1 output (config contract for both runtimes)
```

### Source Code (repository root)

This feature touches root-level config and docs, not `src/`:

```text
.mcp.json                       # NEW — Claude Code project-scoped MCP registration
.opencode/opencode.json         # EDIT — add "mcp" key for opencode
knowledge/mcp-playwright.md      # NEW — integration topic (prereqs, enable, troubleshoot)
CONTEXT.md                      # EDIT — link to the new knowledge topic
CHANGELOG.md                    # EDIT — human-readable changelog entry
```

**Structure Decision**: Config-only feature. Two runtime configs because the
project is cross-agent (confirmed dual-runtime scope in spec). The Claude Code
config lives in a new root `.mcp.json` (project-scoped, committed); the opencode
config extends the existing `.opencode/opencode.json`.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

# Feature Specification: Playwright MCP Integration

**Feature Branch**: `001-playwright-mcp`

**Created**: 2026-06-27

**Status**: Draft

**Input**: User description: "подключи в проект https://github.com/microsoft/playwright-mcp"

## User Scenarios & Testing *(mandatory)*

The "users" of this feature are the AI coding agents and developers who work
inside the YomuMogu repository. The feature gives them a first-class, always-on
way to drive a real browser against the running application from within their
agent session.

### User Story 1 - Agent drives a real browser against the app (Priority: P1)

An agent working in this repository can open the running YomuMogu app in a real
browser, navigate, click, fill fields, read the rendered DOM, and capture
screenshots — all through a Playwright-backed capability that is already
available in its session, with no manual per-session setup.

**Why this priority**: This is the core value. Without the browser-driving
capability being available, nothing else in the feature matters. It lets agents
verify UI changes against the real app instead of reasoning blindly.

**Independent Test**: Start the dev app, ask an agent to open a known route,
read a piece of on-page text, and take a screenshot. Success means the agent
completes the round-trip using only the registered capability.

**Acceptance Scenarios**:

1. **Given** the dev app is running and an agent session is started fresh,
   **When** the agent is asked to open a route and report visible content,
   **Then** it does so without the operator performing any manual MCP setup.
2. **Given** the app is running, **When** the agent is asked to interact
   (click/fill) and re-read the page, **Then** the post-interaction state is
   correctly reflected back.

---

### User Story 2 - Discoverable, documented, reproducible setup (Priority: P2)

A developer or agent new to the repository can discover that the browser
capability exists, understand its prerequisites, enable it, and troubleshoot it
on Windows — by reading project documentation, not tribal knowledge.

**Why this priority**: An integration nobody can find or reproduce decays. The
project's doc-drift gate also requires the integration to be documented in the
same change that wires it up.

**Independent Test**: A contributor who has never seen the feature follows the
documentation and reaches a working browser capability without external help.

**Acceptance Scenarios**:

1. **Given** the documentation, **When** a contributor follows the enable steps
   on a clean Windows checkout, **Then** the capability works and any
   prerequisite (e.g., browser binaries) is clearly called out.
2. **Given** the integration is committed, **When** the repository is inspected,
   **Then** a `knowledge/` topic describes it and `CONTEXT.md` links to it.

---

### User Story 3 - Available across supported agent runtimes (Priority: P3)

The browser capability is available consistently to every agent runtime the
project officially supports, in keeping with YomuMogu's cross-agent philosophy
(the universal entry point is `AGENTS.md`).

**Why this priority**: Valuable for parity, but the feature already delivers
value the moment it works in one runtime; multi-runtime parity is an extension.

**Independent Test**: Run the User Story 1 round-trip from each supported agent
runtime and confirm the capability is present in each.

**Acceptance Scenarios**:

1. **Given** each supported runtime, **When** an agent session starts,
   **Then** the browser capability is listed as available in that runtime.

---

### Edge Cases

- **Browser binaries missing**: the capability surfaces a clear, actionable
  message telling the user how to install them, rather than failing silently.
- **Offline / restricted environment**: behavior when the server or browser
  cannot be fetched is documented (degraded but understandable, not a crash).
- **Dev-server port conflict**: guidance exists for pointing the browser at the
  correct running app URL/port.
- **Server fails to start**: the failure is visible to the operator with a
  pointer to logs/troubleshooting, consistent with the fail-fast principle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST register the Playwright MCP server so that
  supported agent runtimes can invoke browser automation without per-session
  manual configuration by the operator.
- **FR-002**: The registration MUST function on Windows using the project's
  PowerShell-based environment and existing Node toolchain.
- **FR-003**: The capability MUST be available to both agent runtimes the
  project supports — Claude Code and opencode (see Assumptions).
- **FR-004**: The setup MUST document and surface any prerequisite (such as
  browser binaries) and how to satisfy it.
- **FR-005**: The integration MUST be documented in a `knowledge/` topic and
  linked from `CONTEXT.md`, satisfying the doc-drift gate in the same change.
- **FR-006**: Committed configuration MUST NOT contain hardcoded secrets or
  credentials.
- **FR-007**: The registration MUST reference a specific, reproducible server
  source/version so behavior does not drift unexpectedly between machines.
- **FR-008**: The integration MUST be additive to the shipped product — it adds
  no runtime dependency to the YomuMogu application itself and does not replace
  the existing Playwright e2e suite.

### Key Entities *(include if feature involves data)*

- **MCP server registration**: a project-level configuration entry that names
  the browser-automation server, its source/version, and how the agent runtime
  launches it. One entry exists per supported runtime.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An agent completes a full browser round-trip (open the running
  app, read on-page content, perform one interaction, capture a screenshot)
  using only the registered capability, with zero manual configuration steps.
- **SC-002**: A contributor on a clean Windows checkout enables the capability
  by following the documentation in under 10 minutes.
- **SC-003**: 100% of the project's officially supported agent runtimes expose
  the browser capability in a fresh session.
- **SC-004**: When a prerequisite is missing, the user receives an actionable
  message and resolves it without consulting a maintainer.

## Assumptions

- **Target runtimes**: both Claude Code and opencode are in scope (confirmed by
  the user on 2026-06-27), matching the project's cross-agent stance
  (`AGENTS.md` is the universal entry point). The integration must be wired into
  both runtime configs (`.mcp.json` for Claude Code, `.opencode/opencode.json`
  for opencode).
- **Purpose**: the capability is for agent-driven browser automation and
  verification of the local dev app; it complements — does not replace — the
  existing Playwright e2e/Vitest suites.
- **Upstream source**: the integration uses the upstream
  `microsoft/playwright-mcp` server rather than a fork.
- **Toolchain present**: a Node/npx runtime is available (the project already
  targets Node 20 and ships a Node-based stack).
- **Dev-tooling only**: this affects the developer/agent environment, not the
  production application bundle.

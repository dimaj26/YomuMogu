---
description: "Task list for Playwright MCP Integration"
---

# Tasks: Playwright MCP Integration

**Input**: Design documents from `specs/001-playwright-mcp/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/mcp-config.md](contracts/mcp-config.md), [quickstart.md](quickstart.md)

**Tests**: No automated test suite is generated — this is a config-only,
dev-tooling feature with no application code to unit-test. Verification is the
runnable round-trip in [quickstart.md](quickstart.md) (per Constitution
Principle II, adapted).

**Organization**: Tasks grouped by user story (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: US1 / US2 / US3 (maps to spec.md user stories)

---

## Phase 1: Setup (Shared Prerequisites)

**Purpose**: Confirm the toolchain can run the pinned server before wiring it in.

- [ ] T001 Verify Node ≥ 18 (`node --version`) and ensure the Chromium binary is present; if missing, run `npx playwright install chromium` (per [research.md](research.md) R5, [quickstart.md](quickstart.md) prerequisites)
- [ ] T002 Smoke-check the pinned server launches: `npx -y "@playwright/mcp@0.0.76" --help` prints usage without error (per [quickstart.md](quickstart.md) smoke check)

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Settle the one cross-cutting decision both runtime configs depend on.

**⚠️ CRITICAL**: Both user-story configs use the launch form chosen here.

- [ ] T003 Determine the working Windows launch form for the MCP host: try plain `npx`; if the host cannot spawn it, fall back to `cmd /c npx`. Record the chosen form to reuse in both configs (per [research.md](research.md) R7)

**Checkpoint**: Launch form known — runtime configs can now be written.

---

## Phase 3: User Story 1 - Agent drives a real browser against the app (Priority: P1) 🎯 MVP

**Goal**: A Claude Code agent in this repo can drive a real browser against the running dev app with zero manual MCP setup.

**Independent Test**: Start the dev app, ask the agent to open a route, read on-page text, and screenshot — round-trip completes using only the registered capability (spec SC-001).

- [ ] T004 [US1] Create root `.mcp.json` registering the `playwright` server pinned to `@playwright/mcp@0.0.76` with `--isolated --browser chromium`, using the launch form from T003 (exact shape in [contracts/mcp-config.md](contracts/mcp-config.md) Contract A)
- [ ] T005 [US1] Validate US1: from a fresh Claude Code session, confirm `playwright` is listed, then run [quickstart.md](quickstart.md) Scenario 1 (open dev app → read text → click/fill → screenshot)

**Checkpoint**: Browser capability works in Claude Code — MVP functional.

---

## Phase 4: User Story 2 - Discoverable, documented, reproducible setup (Priority: P2)

**Goal**: A newcomer can find, enable, and troubleshoot the capability from project docs; the doc-drift gate is satisfied.

**Independent Test**: A contributor follows the docs on a clean Windows checkout and reaches a working capability in under 10 minutes (spec SC-002).

- [ ] T006 [P] [US2] Create `knowledge/mcp-playwright.md`: purpose, prerequisites (Node, `npx playwright install chromium`), enable steps for both runtimes, Windows `cmd /c npx` fallback, and the four edge cases (missing binaries, offline, port conflict, server-fails-to-start) from [spec.md](spec.md)
- [ ] T007 [US2] Add a link to `knowledge/mcp-playwright.md` in `CONTEXT.md` (satisfies FR-005 / doc-drift gate)
- [ ] T008 [P] [US2] Add a `CHANGELOG.md` entry describing the Playwright MCP integration
- [ ] T009 [US2] Validate US2: confirm the knowledge topic is reachable from `CONTEXT.md` and the enable steps match the committed configs

**Checkpoint**: Integration is discoverable and reproducible.

---

## Phase 5: User Story 3 - Available across supported agent runtimes (Priority: P3)

**Goal**: The same browser capability is available in opencode, at parity with Claude Code.

**Independent Test**: Run the US1 round-trip from opencode; capability is listed and behaves identically (spec SC-003).

- [ ] T010 [P] [US3] Add the `mcp.playwright` entry to `.opencode/opencode.json` — `type: "local"`, command array pinned to `@playwright/mcp@0.0.76` with the same `--isolated --browser chromium` flags, `enabled: true` — **preserving** the existing `skills` and `plugin` keys (exact shape in [contracts/mcp-config.md](contracts/mcp-config.md) Contract B)
- [ ] T011 [US3] Validate US3: from a fresh opencode session, confirm `playwright` is listed and run the round-trip; confirm parity with Claude Code

**Checkpoint**: All supported runtimes expose the capability.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T012 [P] Conformance check: neither config contains secrets (FR-006) and both reference the identical pin `@playwright/mcp@0.0.76` ([data-model.md](data-model.md) invariants, [contracts/mcp-config.md](contracts/mcp-config.md) conformance)
- [ ] T013 Run the full [quickstart.md](quickstart.md) validation end-to-end across both runtimes (Scenarios 1–3)
- [ ] T014 Run `./venv/Scripts/graphify.exe update .` to refresh the knowledge graph after adding the new doc/config

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2 / T003)**: depends on Setup — **blocks** T004 and T010.
- **US1 (Phase 3)**: depends on T003. This is the MVP.
- **US2 (Phase 4)**: docs; can be drafted in parallel with US1/US3.
- **US3 (Phase 5)**: depends on T003; independent of US1 otherwise.
- **Polish (Phase 6)**: after the stories you intend to ship.

### ⚠️ Commit coupling (doc-drift gate)

The husky `spec_sync_guard` blocks committing config/source without a doc update
in the **same commit**. So although the stories are independently *testable*, the
US1/US3 config changes (T004, T010) must be **committed together with** the US2
docs (T006–T008). Practically: do the work per story, then land one commit that
includes the configs **and** the knowledge topic + `CONTEXT.md` link.

### Within stories

- T004 before T005; T010 before T011; T006/T007 before T009.

### Parallel opportunities

- T006 and T008 are `[P]` (different files: `knowledge/` vs `CHANGELOG.md`).
- After T003, T004 and T010 touch different files (`.mcp.json` vs
  `.opencode/opencode.json`) and can be written in parallel.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 T003 → Phase 3 (T004–T005).
2. **STOP and VALIDATE**: browser round-trip works in Claude Code.

Because of the doc-drift gate, the MVP commit also pulls in the US2 docs
(T006–T008) so the change can land at all.

### Incremental Delivery

1. Setup + Foundational → ready.
2. US1 (Claude Code) + US2 docs → land MVP commit → validate.
3. US3 (opencode) → validate parity.
4. Polish (T012–T014) → graph refresh + full quickstart.

---

## Notes

- `[P]` = different files, no incomplete dependencies.
- No automated tests by design; validation = quickstart round-trips.
- `git push` only on explicit request (constitution Governance).

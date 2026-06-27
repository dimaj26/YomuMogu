# Implementation Plan: Browser-Driven Cognitive Analysis

**Branch**: `002-browser-cognitive-analysis` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-browser-cognitive-analysis/spec.md`

## Summary

Define a **repeatable cognitive-walkthrough procedure** that consumes feature
001's Playwright MCP browser capability to drive the running YomuMogu dev app in a
real (headless) browser, observe the app's actual user-facing behavior across its
core routes, and emit a single dated analysis report. The report assembles a
"cognitive map" (per-screen observations + navigation outcomes), records runtime
health signals (console errors, failed network requests) per screen, and
cross-checks the observed behavior against the `knowledge/` documentation to
surface drift, broken flows, and UX gaps.

The work is **process + documentation + one analysis artifact**: a `knowledge/`
topic describing the procedure, a `CONTEXT.md` link, a contract for the report
shape, and the first executed report. **No application source changes** and **no
new shipped runtime dependency** (FR-008).

## Technical Context

**Language/Version**: No application code. The deliverables are Markdown
(procedure doc, report, contract). The browser is driven via the existing
Playwright MCP server (Node ≥ 18 via `cmd /c npx`, per ADR 0003).

**Primary Dependencies**: Feature 001's `@playwright/mcp@0.0.76` registration
(already wired in `.mcp.json` / `.opencode/opencode.json`). Requires the
`chrome-for-testing` browser build (one-time install per
`knowledge/mcp-playwright.md`). No additions to `package.json`.

**Storage**: N/A. The artifact is a committed Markdown report under the feature
folder; screenshots referenced by path. No DB/IndexedDB involvement.

**Testing**: This feature adds no production logic, so there is no new Vitest/e2e
suite. Verification is the runnable [quickstart.md](quickstart.md): run the
walkthrough against the live app and confirm the report meets the contract. The
existing Vitest/Playwright suites are untouched (FR-008).

**Target Platform**: Windows dev environment, PowerShell shell; headless browser
by default (FR-007, ADR 0003).

**Project Type**: Dev-tooling / analysis process (docs + artifact only).

**Performance Goals**: N/A (interactive, agent-driven, point-in-time run).

**Constraints**: Additive only — no app source or runtime dependency (FR-008);
headless-by-default on Windows/PowerShell (FR-007); zero manual MCP setup
inherited from 001 (SC-005); blocked flows recorded, not skipped (FR-009).

**Scale/Scope**: 5 in-scope core routes — `/` (landing/dashboard),
`/practice`, `/practice/quiz`, `/chat`, `/settings` — confirmed against
`knowledge/directory-layout.md`. One walkthrough produces one dated report.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement; `specs/002-browser-cognitive-analysis/`. |
| II. Test-First | ✅ (adapted) | No production code is added, so there is nothing to unit-test. The walkthrough *is itself* an observational verification of the live app; the quickstart is the runnable check. The existing suites stay green and untouched. |
| III. Fail-Fast | ✅ | The procedure surfaces blocked flows / missing preconditions / dead-ends explicitly (FR-009, edge cases) instead of silently skipping — fail-loud by construction. |
| IV. Layered Boundaries | ✅ N/A | No DB/IndexedDB/UI/API-handler code touched; the browser observes the app from the outside as a user would. |
| V. No Placeholders | ✅ | The report is a real executed artifact with real observations, not a stub/template-only deliverable. |
| Stack & Language | ✅ | PowerShell commands; technical docs in English; the procedure doc is a `knowledge/` topic. (The report records the app's Russian UI strings verbatim as observed — that is data, not authored prose.) |
| Doc-drift gate | ✅ planned | `knowledge/` topic + `CONTEXT.md` link + `CHANGELOG.md` shipped in the implementing commit (FR-010). |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-browser-cognitive-analysis/
├── plan.md              # This file
├── research.md          # Phase 0 — procedure & tooling decisions
├── data-model.md        # Phase 1 — entity shapes (run, observation, map, finding)
├── quickstart.md        # Phase 1 — runnable validation of the walkthrough
├── contracts/
│   └── report-contract.md   # Phase 1 — required shape of the analysis report
└── checklists/
    └── requirements.md  # spec quality checklist (already created)
```

### Source Code (repository root)

This feature touches docs and produces one artifact — not `src/`:

```text
knowledge/cognitive-walkthrough.md   # NEW — the repeatable procedure (prereqs, steps, output)
CONTEXT.md                           # EDIT — link the new knowledge topic
CHANGELOG.md                         # EDIT — human-readable changelog entry
specs/002-browser-cognitive-analysis/reports/
└── YYYY-MM-DD-cognitive-walkthrough.md   # NEW — the first executed report
specs/002-browser-cognitive-analysis/reports/screenshots/   # captured snapshots
```

**Structure Decision**: Process-and-artifact feature. The *reusable* asset is the
`knowledge/cognitive-walkthrough.md` procedure (so future runs are reproducible);
the *executed* asset is the dated report under the feature's `reports/` folder.
Screenshots live beside the report. No `src/` layout choice applies.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

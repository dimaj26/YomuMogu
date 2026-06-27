# Tasks: Browser-Driven Cognitive Analysis

**Feature**: `002-browser-cognitive-analysis` | **Plan**: [plan.md](plan.md) |
**Spec**: [spec.md](spec.md)

This is a **process + documentation + one executed artifact** feature. There is no
application source code; "implementation" means writing the reusable procedure,
then *running it* against the live app to produce a contract-valid report. Tests
are not generated (no production logic; verification is the runnable
[quickstart.md](quickstart.md), per plan Constitution Check II).

Tasks within a user story that touch different files and have no incomplete
dependency are marked `[P]`.

## Phase 1: Setup

- [X] T001 Confirm prerequisites are live: `node --version` ≥ 18, the `playwright` MCP server is registered (`.mcp.json`), and the `chrome-for-testing` build is installed (`npx @playwright/mcp@0.0.76 install-browser chrome-for-testing`); start the dev app with `npm run dev` and record the actual URL/port. Per [quickstart.md](quickstart.md).
- [X] T002 Create the report output directories `specs/002-browser-cognitive-analysis/reports/` and `specs/002-browser-cognitive-analysis/reports/screenshots/`.

## Phase 2: Foundational (blocks all user stories)

**The reusable procedure doc is the prerequisite every walkthrough run depends on.**

- [X] T003 Write the repeatable procedure `knowledge/cognitive-walkthrough.md`: prerequisites (link [mcp-playwright.md](../../knowledge/mcp-playwright.md)), the in-scope route set (`/`, `/practice`, `/practice/quiz`, `/chat`, `/settings`), the per-screen capture steps (snapshot → console → network → screenshot → classify outcome), the assemble-map + cross-check steps, and the output location/naming. Headless, PowerShell, zero manual setup. Content in English (constitution).

**Checkpoint**: procedure documented and executable — user-story runs can begin.

## Phase 3: User Story 1 — Cognitive map of the live app (P1) 🎯 MVP

**Goal**: Traverse the core flows in the real browser and produce the dated report
with a per-screen cognitive map.

**Independent test**: A reader unfamiliar with the app can describe its core flows
from the report alone (SC-004).

- [X] T004 [US1] Navigate the entry route `/` via the `playwright` MCP (headless); capture page title/heading, primary affordances (`browser_snapshot`), take a screenshot into `reports/screenshots/`, and classify the navigation outcome.
- [X] T005 [P] [US1] Repeat the capture for `/practice` (launcher): structure, screenshot, outcome.
- [X] T006 [P] [US1] Repeat the capture for `/practice/quiz` (FSRS active-recall quiz): structure, screenshot, outcome.
- [X] T007 [P] [US1] Repeat the capture for `/chat` (AI conversation): structure, screenshot, outcome.
- [X] T008 [P] [US1] Repeat the capture for `/settings` (Anki config / profile / field mapping): structure, screenshot, outcome.
- [X] T009 [US1] Exercise at least one interactive element on the critical path (e.g. start a practice/quiz action or send a chat message) and record the post-interaction state, proving the observation came from the live app (acceptance scenario 2).
- [X] T010 [US1] Assemble the cognitive-map overview (entry, navigation edges from→to via affordance, any unreachable in-scope route) and write the run header + per-screen sections into `specs/002-browser-cognitive-analysis/reports/2026-06-27-cognitive-walkthrough.md` per the [report contract](contracts/report-contract.md) §1–3.

**Checkpoint**: a dated report exists describing the real app structure — MVP delivered.

## Phase 4: User Story 2 — Health signals per screen (P2)

**Goal**: Attach runtime console + network signals to each screen observation.

**Independent test**: A screen with a console error or failing request shows that
signal against the correct screen/step (SC-002).

- [X] T011 [US2] For each visited route, capture browser console messages (`browser_console_messages`) filtered to warnings/errors and record them — or the literal `none observed` — against that screen in the report.
- [X] T012 [US2] For each visited route, capture network requests (`browser_network_requests`), list any failed / 4xx / 5xx (endpoint + status) — or `none observed` — against that screen in the report.

**Checkpoint**: every observation in the report now carries console + network signals.

## Phase 5: User Story 3 — Documentation cross-check (P3)

**Goal**: Compare the observed map to `knowledge/` docs and record actionable findings.

**Independent test**: One documented flow and one undocumented observed behavior
both appear in the findings section with specific descriptions (US3 test).

- [X] T013 [US3] Cross-check the observed map against `knowledge/architecture.md`, `knowledge/directory-layout.md`, `knowledge/features.md`, and any flow-specific topics; identify discrepancies, broken/dead-end flows, undocumented behavior, and UX gaps.
- [X] T014 [US3] Write the Findings section into the report per [report contract](contracts/report-contract.md) §4 — each finding with `id`, `type`, screen/flow, `doc_ref`, observed-vs-expected description, and a concrete actionable next step (SC-003). If no discrepancies, state so explicitly with the docs checked.
- [X] T015 [US3] Add the Limitations / snapshot note (report contract §5): point-in-time caveat for non-deterministic UI, plus any routes left `blocked` and what they need.

**Checkpoint**: report is contract-complete (§1–5).

## Phase 6: Polish & Cross-Cutting (doc-drift gate + verification)

- [X] T016 Validate the produced report against every checkbox in [contracts/report-contract.md](contracts/report-contract.md) and the [quickstart.md](quickstart.md) checklist; fix any gaps.
- [X] T017 [P] Add a `CONTEXT.md` link to `knowledge/cognitive-walkthrough.md` under the Quality & Process section (FR-010, doc-drift gate).
- [X] T018 [P] Append a `CHANGELOG.md` entry for feature 002 (the cognitive-walkthrough procedure + first report).
- [X] T019 Auto-commit the feature (spec, plan, design docs, procedure, report, CONTEXT/CHANGELOG edits) with a `feat(tooling):` subject; do **not** push (constitution git policy). Run `./venv/Scripts/graphify.exe update .` first only if any code symbols changed (none expected here).

## Dependencies & order

- **Setup (T001–T002)** → **Foundational (T003)** → user stories.
- **US1 (T004–T010)** is the MVP and must complete before US2/US3 enrich the same report.
- **US2 (T011–T012)** and **US3 (T013–T015)** both extend the US1 report; US2 and US3 are independent of each other but both depend on the per-screen sections from T010.
- **Polish (T016–T019)** last.

## Parallel opportunities

- T005–T008 (per-route captures for `/practice`, `/practice/quiz`, `/chat`, `/settings`) are independent observations — `[P]`.
- T017 and T018 touch different files (`CONTEXT.md` vs `CHANGELOG.md`) — `[P]`.

## MVP scope

**User Story 1 (T001–T010)** alone delivers a usable dated cognitive map of the
live app. US2 and US3 add health diagnostics and the doc-drift cross-check.

## Summary

- Total tasks: **19** (Setup 2, Foundational 1, US1 7, US2 2, US3 3, Polish 4).
- Per story: US1 = 7, US2 = 2, US3 = 3.
- Parallel: T005–T008, and T017/T018.

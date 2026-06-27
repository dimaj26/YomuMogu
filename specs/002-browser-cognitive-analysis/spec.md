# Feature Specification: Browser-Driven Cognitive Analysis

**Feature Branch**: `002-browser-cognitive-analysis`

**Created**: 2026-06-27

**Status**: Implemented (2026-06-27)

**Input**: User description: "Прогони оптимальный цикл (через спек-кит) когнитивного анализа проекта используя реальный браузер (Playwright MCP)."

## User Scenarios & Testing *(mandatory)*

The "users" of this feature are the AI coding agents and developers who work
inside the YomuMogu repository. Building on feature 001 (the now-integrated
Playwright MCP browser capability), this feature defines a **repeatable cognitive
walkthrough**: a structured way for an agent to drive the running app in a real
browser, observe what it *actually* does, and turn those observations into a
durable analysis artifact and a documentation cross-check.

### User Story 1 - Agent produces a cognitive map of the live app (Priority: P1)

An agent traverses the application's core user flows in a real browser, and for
each screen it visits records what a user actually sees and can do — the page's
structure and primary affordances, navigation links, and whether the flow
advances or dead-ends. The result is a single dated analysis report that
describes the app's real, observed user-facing behavior (a "cognitive map"),
not what the source merely claims.

**Why this priority**: This is the core value. A faithful, observation-based map
of the live app is the deliverable everything else depends on. It lets the team
see the product as a user experiences it and is the substrate for any drift or
gap analysis.

**Independent Test**: With the dev app running, an agent follows the walkthrough
and produces the dated report covering the core flows. Success means a reader who
has never opened the app can understand its real structure and primary flows from
the report alone.

**Acceptance Scenarios**:

1. **Given** the dev app is running and a fresh agent session, **When** the agent
   runs the walkthrough, **Then** it produces one dated report covering every
   core flow defined in scope, each with observed structure and an outcome
   (advances / dead-ends / errors).
2. **Given** a screen with an interactive element on the critical path, **When**
   the agent interacts with it, **Then** the report records the post-interaction
   state, confirming the observation came from the live app and not from reading
   source.

---

### User Story 2 - Health signals captured per screen (Priority: P2)

For each visited screen, the walkthrough captures runtime health signals that are
invisible in source review — browser console errors/warnings and failed or
erroring network requests — and attributes them to the screen and step where they
occurred, so latent breakage surfaces even when the UI looks fine.

**Why this priority**: A screen can render correctly while silently logging errors
or failing background requests. Capturing these turns the walkthrough from a
screenshot tour into a real diagnostic, but it is an enhancement layered on the
core map (US1).

**Independent Test**: Visit a screen known to emit a console error or a failing
request; confirm the report lists that signal against the correct screen/step.

**Acceptance Scenarios**:

1. **Given** a visited screen that logs a console error, **When** the walkthrough
   records that screen, **Then** the error text and the screen/step are present in
   the report.
2. **Given** a screen that issues a network request which fails or returns an
   error status, **When** the walkthrough records that screen, **Then** the failed
   request (endpoint + status) is listed against that screen.

---

### User Story 3 - Cross-check against documentation surfaces drift (Priority: P3)

The observed cognitive map is compared against the project's existing
`knowledge/` documentation (architecture, directory layout, features registry,
flows), and the report calls out concrete discrepancies: behavior the docs
describe but the app does not exhibit, app behavior the docs omit, and broken or
dead-end flows. Each finding is actionable enough to open follow-up work.

**Why this priority**: The map alone is useful; comparing it to documentation is
where it pays off as a quality gate, catching doc-drift the existing machine guard
cannot detect. It depends on US1 (the map) existing first.

**Independent Test**: Pick one documented flow and one undocumented observed
behavior; confirm both appear in the report's drift section with a clear, specific
description.

**Acceptance Scenarios**:

1. **Given** the observed map and the `knowledge/` docs, **When** the agent runs
   the cross-check, **Then** the report's findings section lists each discrepancy
   with the screen/flow it concerns and which doc it contradicts or is missing
   from.
2. **Given** a flow that dead-ends or errors in the live app, **When** the
   cross-check runs, **Then** that broken flow is flagged as a finding regardless
   of what the docs say.

---

### Edge Cases

- **Dev app not running / wrong port**: the walkthrough surfaces a clear, actionable
  message (start the app, point at the correct URL) rather than producing an empty
  or misleading report.
- **A flow requires data the local environment lacks** (e.g., no Anki running, no
  Gemini key): the screen is recorded as "blocked — precondition missing" with the
  missing precondition named, not silently skipped.
- **A flow dead-ends or throws**: this is a finding, not a failure of the
  walkthrough — the report continues and records the dead-end.
- **Browser prerequisite missing** (chrome-for-testing not installed): inherits the
  actionable message from feature 001; the walkthrough cannot start and says why.
- **Non-deterministic / time-based UI** (FSRS due counts, AI responses): the report
  notes the observation is a point-in-time snapshot rather than asserting it as a
  fixed truth.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST define a repeatable walkthrough procedure that an
  agent can follow to traverse the app's core user flows in a real browser using
  the capability from feature 001.
- **FR-002**: The scope of "core user flows" MUST be enumerated explicitly so the
  walkthrough is bounded and reproducible (see Assumptions for the initial set).
- **FR-003**: For each visited screen, the walkthrough MUST record observed
  structure / primary affordances, navigation outcome (advances / dead-ends /
  blocked / errors), and at least one captured visual snapshot reference.
- **FR-004**: The walkthrough MUST capture per-screen runtime health signals —
  browser console errors/warnings and failed/erroring network requests —
  attributed to the screen and step.
- **FR-005**: The feature MUST produce a single **dated analysis report** stored
  under the feature folder as the durable artifact of one walkthrough run.
- **FR-006**: The report MUST include a drift/findings section cross-checking the
  observed behavior against the `knowledge/` documentation, with each finding tied
  to a specific screen/flow and the doc it concerns.
- **FR-007**: The procedure MUST run on Windows using PowerShell and MUST default
  to **headless** browser operation (consistent with ADR 0003), with no
  per-session manual MCP setup.
- **FR-008**: The feature MUST be additive and documentation/tooling-only — it adds
  **no** application source changes and no new shipped runtime dependency.
- **FR-009**: When a flow cannot be exercised because a precondition is missing,
  the report MUST record it as "blocked" with the missing precondition named,
  rather than omitting it.
- **FR-010**: The integration MUST satisfy the doc-drift gate: the walkthrough
  procedure is documented in a `knowledge/` topic and linked from `CONTEXT.md` in
  the same change that introduces it.

### Key Entities *(include if feature involves data)*

- **Walkthrough run**: one execution of the procedure at a point in time,
  identified by its date; produces exactly one analysis report.
- **Screen observation**: the record for a single visited screen — its identity
  (route/title), observed structure, navigation outcome, captured health signals,
  and a visual snapshot reference.
- **Cognitive map**: the assembled set of screen observations and the navigation
  relationships between them, describing the app's real user-facing behavior.
- **Finding**: a single discrepancy or broken flow surfaced by the cross-check,
  tied to a screen/flow and (where applicable) the documentation it contradicts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A single walkthrough run produces a dated report covering 100% of the
  in-scope core flows, each with a recorded navigation outcome.
- **SC-002**: Every visited screen in the report has its console and network health
  signals recorded (including an explicit "none observed" where clean).
- **SC-003**: The report's findings section contains at least the discrepancies and
  broken flows observed, each actionable enough that a reader can open follow-up
  work without re-running the walkthrough.
- **SC-004**: A reader who has never opened the app can, from the report alone,
  correctly describe the app's core flows and their current health.
- **SC-005**: The walkthrough completes from a fresh agent session with zero manual
  MCP configuration steps (inheriting feature 001's zero-setup guarantee).

## Assumptions

- **Initial core-flow scope**: deck / FSRS review, Gemini chat conversation
  practice, and the settings / Anki integration pages — plus the app's landing /
  home entry. The exact route set is confirmed during planning against
  `knowledge/directory-layout.md`; flows requiring unavailable external services
  are recorded as "blocked", not removed from scope.
- **Builds on feature 001**: the Playwright MCP browser capability is already
  registered and working in the agent runtime; this feature consumes it and does
  not re-implement browser wiring.
- **Local dev app**: the analysis targets the locally running dev app
  (`npm run dev`, default `http://localhost:3000`), not a deployed environment.
- **Point-in-time**: a report reflects the app state at run time; it is a snapshot,
  not a continuously maintained document. Re-running the procedure produces a new
  dated report.
- **No production impact**: this is dev-tooling / analysis only; it does not change
  the shipped application or its dependencies.

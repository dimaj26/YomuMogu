# Phase 0 Research: Browser-Driven Cognitive Analysis

Resolves the open decisions behind the walkthrough procedure. No `NEEDS
CLARIFICATION` markers remained from the spec; the items below record the design
choices the plan depends on.

## Decision 1 — Reuse feature 001's Playwright MCP, add no new tooling

- **Decision**: Drive the browser exclusively through the already-registered
  `playwright` MCP server (`@playwright/mcp@0.0.76`, headless, isolated). Add no
  new packages, configs, or scripts.
- **Rationale**: Feature 001 exists precisely so agents can drive the real app
  with zero per-session setup (SC-005). Re-using it keeps this feature additive
  and dependency-free (FR-008) and dogfoods 001.
- **Alternatives considered**: A bespoke Playwright test script under `tests/e2e`
  — rejected: it would be production-ish code requiring maintenance, duplicates
  001, and couples the *analysis* to the *test suite* the spec says to leave
  untouched. The `Claude_in_Chrome` / `computer-use` MCPs — rejected: not the
  project-sanctioned, reproducible capability (ADR 0003 chose `@playwright/mcp`).

## Decision 2 — In-scope core flows

- **Decision**: Five routes, confirmed against `knowledge/directory-layout.md`:
  `/` (landing/gamified dashboard), `/practice` (launcher), `/practice/quiz`
  (FSRS active-recall quiz), `/chat` (AI conversation), `/settings` (Anki config /
  profile / field mapping).
- **Rationale**: These are the App Router *pages* a user navigates — the real
  user-facing surface. API routes under `app/api/**` are exercised indirectly via
  the pages and observed through the network-signal capture, not visited directly.
- **Alternatives considered**: Enumerating every API route as its own "screen" —
  rejected: APIs are not user-facing screens; their health is captured as the
  network signal of the page that calls them (US2). Crawling all components —
  rejected: components are not independently routable; they appear within pages.

## Decision 3 — Health-signal capture

- **Decision**: For each screen capture (a) browser console messages filtered to
  warnings/errors, and (b) network requests that failed or returned a 4xx/5xx
  status, each attributed to the screen + step. Record "none observed" explicitly
  when clean (SC-002).
- **Rationale**: These are the runtime truths invisible to source review and the
  reason a browser-driven analysis beats static reading. The Playwright MCP
  exposes console and network read tools directly, so no extra instrumentation is
  needed.
- **Alternatives considered**: Performance/Lighthouse metrics — rejected for v1:
  out of scope (spec is about *cognitive map + drift*, not perf). Full request
  bodies — rejected: noisy and may contain transient data; endpoint + status is
  the actionable unit.

## Decision 4 — Report location, format, and identity

- **Decision**: One Markdown report per run at
  `specs/002-browser-cognitive-analysis/reports/YYYY-MM-DD-cognitive-walkthrough.md`,
  with screenshots under `reports/screenshots/`. The report shape is fixed by
  [contracts/report-contract.md](contracts/report-contract.md).
- **Rationale**: Markdown is the project's documentation medium and diff-friendly;
  dating by run keeps reports append-only snapshots (Assumptions: point-in-time).
  Co-locating with the feature keeps the artifact discoverable next to its spec.
- **Alternatives considered**: A single living document overwritten each run —
  rejected: loses history and contradicts the snapshot model. JSON output —
  rejected: the consumer is a human reader (SC-004); Markdown serves that better.

## Decision 5 — Handling unavailable preconditions

- **Decision**: When a flow needs an external service the local env lacks (Anki
  not running, no Gemini key, no seeded deck), record the screen as
  **"blocked — <precondition>"** and continue; do not omit it (FR-009).
- **Rationale**: Fail-fast/visible (Principle III). A silently missing flow would
  make the map lie by omission. Naming the precondition makes the gap actionable.
- **Alternatives considered**: Mocking the services to force the flow — rejected:
  that would observe a fake app, defeating the purpose of a *real-browser* map.

## Decision 6 — Cross-check method

- **Decision**: After assembling the observed map, compare it against the relevant
  `knowledge/` topics (`architecture.md`, `directory-layout.md`, `features.md`,
  and flow-specific topics) and record each discrepancy as a Finding tied to a
  screen/flow and the doc it contradicts or is missing from (FR-006).
- **Rationale**: This is the quality-gate payoff — catching doc-drift the machine
  `spec_sync_guard` cannot (it checks *that* docs changed, not *whether they match
  reality*). Findings are written to be independently actionable (SC-003).
- **Alternatives considered**: Automated doc/DOM diffing — rejected: docs are prose
  about behavior, not a machine schema; a structured human/agent judgement is the
  right tool and is what the walkthrough produces.

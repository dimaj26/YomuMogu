# Contract: Cognitive-Walkthrough Report

The required shape of a report produced by one walkthrough run. A report is valid
when it contains every section below, populated from real observations. This
contract is what `quickstart.md` validates against and what
`knowledge/cognitive-walkthrough.md` instructs the agent to produce.

**File**: `specs/002-browser-cognitive-analysis/reports/YYYY-MM-DD-cognitive-walkthrough.md`

## Required sections

### 1. Run header

- Date (`YYYY-MM-DD`), app URL used, agent runtime, and the Playwright MCP server
  version relied upon.
- Scope: the list of routes attempted.

### 2. Cognitive map overview

- A navigation overview of the observed app: entry route, the edges between
  screens (from → to, via which affordance), and any in-scope route that was
  **unreachable** by navigation.
- May be a bullet list or a small diagram; must let a reader trace the flows.

### 3. Per-screen observations

One subsection per attempted route, each containing **all** of:

| Item | Requirement |
|------|-------------|
| Route + title | The path and observed page title/heading. |
| Structure | Observed primary affordances (headings, buttons, inputs, nav). |
| Outcome | Exactly one of `advances` / `dead-ends` / `blocked` / `errors`. |
| Blocked reason | Present **iff** outcome is `blocked`; names the missing precondition. |
| Console signals | Warnings/errors captured, or the literal `none observed`. |
| Network signals | Failed/4xx/5xx requests (endpoint + status), or `none observed`. |
| Screenshot | A reference to the captured image under `reports/screenshots/`. |

### 4. Findings (documentation cross-check)

- A table or numbered list of Findings, each with: `id`, `type`
  (`doc-drift` / `broken-flow` / `undocumented-behavior` / `ux-gap`), the screen/flow,
  the `knowledge/` doc reference (where applicable), a description (observed vs.
  expected), and a concrete actionable next step.
- If genuinely no discrepancies were found, state that explicitly with the docs
  that were checked — an empty section is invalid.

### 5. Limitations / snapshot note

- Note that the report is a point-in-time snapshot (non-deterministic UI such as
  FSRS due counts and AI responses may vary between runs).
- List any routes that were `blocked` and what would be needed to cover them next
  time.

## Validity rules (checklist)

- [ ] Every in-scope route appears as a per-screen observation (or is explicitly
      listed as unreachable/blocked with reason).
- [ ] Every observation has both console and network signals filled (`none
      observed` allowed).
- [ ] Every observation has an outcome from the allowed set and a screenshot ref.
- [ ] The findings section is non-empty (discrepancies, or an explicit "none, docs
      checked: …").
- [ ] The snapshot/limitations note is present.

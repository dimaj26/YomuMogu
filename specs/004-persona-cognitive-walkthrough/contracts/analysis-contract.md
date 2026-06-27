# Contract: Consolidated Problem & Solution Analysis

One file: `reports/YYYY-MM-DD-consolidated-analysis.md`. Produced **after** all
three persona reports. This is the **only** artifact that designs solutions.

## Required sections

### 1. Inputs

- Links to the three persona reports it consolidates + the run date.

### 2. Cross-persona problem matrix

- A table mapping each distinct problem to which personas hit it (P1/P2/P3), so
  systemic vs persona-specific issues are visible at a glance.

### 3. Consolidated findings

A numbered list/table; each finding has **all** of:

| Item | Requirement |
|------|-------------|
| `id` | `C-01`, … |
| Category | `bug` / `landing` / `navigation-ux` / `learning-logic`. |
| Priority | P1/P2/P3 by impact (learning-logic weighted heavily). |
| Sources | The persona(s) + screen(s) it traces to (every finding must trace to ≥1 report observation). |
| Description | The synthesized problem. |
| Proposed solution | Concrete fix direction (scope-appropriate, not necessarily a full design). |

### 4. Learning-logic section (called out distinctly)

- The learning-logic findings gathered together with a short narrative: is the
  end-to-end learning journey coherent across new → returning → advanced, and what
  are the highest-leverage fixes to make it logical (SC-003 requires learning-logic
  be a distinct category).

### 5. Prioritized "do next" list

- The findings ordered by priority, so the team can act top-down. (Solutions are
  proposed here; implementing them is out of scope for this feature.)

## Validity checklist

- [ ] Every finding traces to ≥1 persona/screen observation.
- [ ] Every finding has category + priority + proposed solution.
- [ ] Learning-logic is a distinct category with its own section.
- [ ] The cross-persona matrix shows systemic vs persona-specific problems.
- [ ] No new problems appear that aren't grounded in a persona report.

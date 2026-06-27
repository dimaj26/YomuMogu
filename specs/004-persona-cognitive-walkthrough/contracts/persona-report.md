# Contract: Per-Persona Walkthrough Report

One per persona: `reports/YYYY-MM-DD-<persona-id>.md`. Valid when it contains every
section below, populated from real in-character observation.

## Required sections

### 1. Persona header

- Persona id/name and a 2–3 line recap of who they are (link `personas.md`).
- `profileId`, state method (organic / light-seed / full-seed) and **what was
  seeded vs organic** (FR-003).
- Run date, app URL, browser-capability version.
- **Service availability** probed at run start: Gemini / MeCab / AnkiConnect →
  available or not (drives `blocked` outcomes).

### 2. Journey overview

- The ordered path this persona actually took (entry → … ), as a list/diagram, and
  any in-scope screen not reached and why.

### 3. Per-screen, in-character observations

One subsection per visited screen, each with **all** of:

| Item | Requirement |
|------|-------------|
| Route + title | The screen. |
| Q1 Clarity | In character: is everything in the interface clear? |
| Q2 Next step | In character: do I understand what to do next? |
| Q3 Missing function | In character: is an obvious capability missing? |
| Q4 Convenience | In character: is the interface convenient? |
| Outcome | `advances` / `dead-ends` / `blocked` / `errors` (+ reason if blocked). |
| Console signals | warnings/errors or `none observed`. |
| Network signals | failed/4xx/5xx (endpoint+status) or `none observed`. |
| Screenshot | reference under `reports/screenshots/`. |

> The four questions are answered **in the persona's voice**, stating problems
> only — no fixes (FR-006).

### 4. Problems found (this persona)

- A list of raw Problems, each tagged `bug` / `landing` / `navigation-ux` /
  `learning-logic`, tied to the screen. Observation only. If none on a screen, the
  per-screen analysis still stands; this section aggregates the real ones.

### 5. Learning-journey verdict

- A short in-character summary: did the app teach me in a logical order? Did the
  features make sense together? Where did I lose the thread? (This is the heart of
  the persona lens.)

### 6. Limitations / snapshot note

- Point-in-time caveat; seeded-vs-organic reminder; any service that was blocked
  and what it would need.

## Validity checklist

- [ ] Every visited screen has all four questions + outcome + console + network +
      screenshot.
- [ ] Seeded-vs-organic is stated.
- [ ] Service availability is recorded; blocked screens name the service.
- [ ] Problems are observation-only (no fixes) and categorized.
- [ ] A learning-journey verdict is present.

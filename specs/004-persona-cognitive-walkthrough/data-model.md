# Phase 1 Data Model: Persona Cognitive Walkthrough

Conceptual entities for the reports/analysis, plus the **seed shape** for the
existing `words` store (no schema change — this is the app's current `LocalWord`).

## Persona (definition entity — `personas.md`)

| Field | Description |
|-------|-------------|
| `id` | `p1_beginner` / `p2_returning` / `p3_master` (also the app `profileId`). |
| `name` | Human label (e.g. "Аня — первый день"). |
| `goals` | What they want from the app. |
| `prior_experience` | Japanese level + app familiarity. |
| `tooling_stance` | e.g. P1 "no Anki, ever". |
| `starting_state` | Organic / light-seed / full-seed and what that contains. |
| `standing_questions` | The four asked on every screen (clarity / next-step / missing-function / convenience). |

## Seeded LocalWord (existing `words` store — fixture only)

Written into `YomuMoguDatabase.words` (keyPath `[profileId, id]`). Matches the
current `LocalWord` interface; no new fields.

| Field | Seed rule |
|-------|-----------|
| `profileId` | The persona's id. |
| `id` | Unique integer per word within the profile. |
| `word` / `reading` | From JLPT N3–N1 source (P3) or a small hand-set list (P2). |
| `translation` | Real if available; else reading/placeholder (disclosed). |
| `category` | `'__local_starter__'` (so the app treats it as the active local deck). |
| `source` | `'starter'`. |
| `active` | `FsrsState` set per the target status band (status, stability, difficulty, interval, due, reps, lapses). |
| `tags` | Optional situational tags (left empty for the seed). |

**FsrsState bands (P3)**: `new` (stability 0, reps 0, due now), `learning` (low
stability, due soon), `review` (mid stability, due mixed), `mature` (high
stability, due far future), `lapsed-ish` (review status, low stability, lapses≥2,
due in past).

## Screen Observation (in-character) — per report

| Field | Description |
|-------|-------------|
| `route` / `title` | Screen visited. |
| `clarity` | Q1: is everything in the interface clear? (in character) |
| `next_step` | Q2: do I understand what to do next? |
| `missing_function` | Q3: is there an obvious function missing? |
| `convenience` | Q4: is the interface convenient? |
| `outcome` | `advances` / `dead-ends` / `blocked` / `errors`. |
| `blocked_reason` | If blocked: the named service/precondition. |
| `console_signals` / `network_signals` | Objective signals, or `none observed`. |
| `screenshot` | Path under `reports/screenshots/`. |

## Problem (raw, per report)

| Field | Description |
|-------|-------------|
| `persona` | Which persona surfaced it. |
| `screen` | Where. |
| `category` | `bug` / `landing` / `navigation-ux` / `learning-logic`. |
| `statement` | What's wrong (observation only — no fix). |

## Consolidated Finding (analysis only)

| Field | Description |
|-------|-------------|
| `id` | `C-01`, … |
| `category` | `bug` / `landing` / `navigation-ux` / `learning-logic`. |
| `priority` | P1/P2/P3 by impact (learning-logic weighted heavily). |
| `sources` | The persona(s) + screen(s) it traces to. |
| `description` | Synthesized problem. |
| `proposed_solution` | The fix (this is the only artifact that designs fixes). |

**Rule**: every Consolidated Finding traces to ≥1 raw Problem from a persona report
(SC-003); learning-logic is a first-class category, not folded into "UX".

# Implementation Plan: Persona Cognitive Walkthrough

**Branch**: `004-persona-cognitive-walkthrough` | **Date**: 2026-06-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-persona-cognitive-walkthrough/spec.md`

## Summary

Run a persona-driven cognitive walkthrough of the live app from three learner
points of view (P1 fresh beginner / P2 returning beginner / P3 advanced master),
using feature 001's Playwright MCP and feature 002's procedure, adding the
**learner's-mind lens**: on every screen, an in-character judgement of clarity,
next-step, missing-function, and convenience, plus objective signals. Deliver
three dated persona reports, then one consolidated problem/solution analysis.

Persona state is established in three isolated profiles: P1 organic (fresh), P2
light seed, P3 full seed (~4000 JLPT N3–N1 words across FSRS states), all seeded
**at runtime into the app's own client-side storage via the browser** — no
application code is changed.

## Technical Context

**Language/Version**: No application code. Deliverables are Markdown reports +
analysis. The browser is driven via the existing Playwright MCP; seeding is done
with in-page JavaScript executed through the MCP (`browser_evaluate`).

**Primary Dependencies**: Feature 001 (`@playwright/mcp@0.0.76`, headless) and
feature 002's `knowledge/cognitive-walkthrough.md` procedure. The app's own
client-side storage: IndexedDB **`YomuMoguDatabase`** (Dexie), store **`words`**
(keyPath `[profileId, id]`); localStorage profile keys
(`yomumogu_active_profile_id`, `yomumogu_profiles`,
`yomumogu_profile_<id>_<key>`). Seed content for P3 from
`src/resources/jlpt_levels.json` (N3 2078 / N2 1790 / N1 2655 = 6523 available).

**Storage**: No schema change. Seeding writes `LocalWord` rows (see
[data-model.md](data-model.md)) into the existing `words` store under per-persona
`profileId`s, and sets per-persona localStorage profile state. This is **test
fixture state**, not shipped data.

**External services**: Gemini (chat / session generation / YouTube query
expansion), MeCab tokenizer (`:8000`), AnkiConnect (`:8765`). Used for real when
configured; otherwise the dependent screen is recorded **blocked — <service>** (no
mocks, FR-007). Availability is probed at run start and recorded in each report.

**Testing**: No production logic added → no new Vitest/e2e suite (adapted
Test-First, as feature 002). Verification is the runnable [quickstart.md](quickstart.md):
the three reports + analysis exist and satisfy their contracts.

**Target Platform**: Windows/PowerShell; headless browser by default (FR-011).

**Project Type**: Dev-tooling / analysis (docs + artifacts only).

**Constraints**: Additive/analysis-only — no app source or runtime dependency
(FR-010); observe-only during walkthroughs, solutions only in the post-analysis
(FR-006 vs FR-009); never mock external services (FR-007).

**Scale/Scope**: 3 personas × in-scope screens (home, practice, quiz, chat,
settings, media/YouTube, grammar/learning-track as reachable) → 3 reports + 1
analysis. P3 seed ~4000 words.

## Persona state strategy (the crux)

| Persona | profileId | State method | What is seeded |
|---------|-----------|--------------|----------------|
| **P1** beginner, no Anki | `p1_beginner` | **Organic** | Nothing — fresh empty profile; walk from the true first-run state. |
| **P2** returning beginner | `p2_returning` | **Light seed** | ~20–30 local words across `new`/`learning`/a few `review` (some due now); 1 completed chat session + session stats; a few quiz reviews in `reviews`; one media/activity-log entry; quests partially progressed. |
| **P3** advanced master | `p3_master` | **Full seed** | ~4000 words (JLPT N3→N1 content) into the local deck, distributed across FSRS states (see distribution below) with realistic `due`/`stability`/`reps`. |

**P3 FSRS distribution (~4000, for test quality)**: ~2500 `mature` (high
stability, due spread future), ~700 `review`, ~450 `learning`, ~250 `new`, ~100
lapsed-ish (review status, low stability, due in past → inflates due count). Tuned
so the Kumiko heatmap, due counters, and review load read like a real power user.

**Seeding mechanism**: after navigating to the app origin, run `browser_evaluate`
to (a) write localStorage profile keys (create/select the persona profile, set
`deck_mode='local'`), and (b) open `YomuMoguDatabase` and bulk-`put` `LocalWord`
rows with `category='__local_starter__'` so the app's local-mode read path and
`isLocalDeckInitialized` treat them as the active deck. Then reload. The honesty
caveat (synthetic glosses: JLPT source has word+reading, translation filled from
reading/placeholder) is recorded in P2/P3 reports.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-Driven Flow | ✅ | spec → plan → tasks → implement; `specs/004-persona-cognitive-walkthrough/`. |
| II. Test-First | ✅ (adapted) | No production code added; the walkthrough is itself observational verification. Existing suites untouched and stay green. |
| III. Fail-Fast | ✅ | Blocked services / dead-ends / errors are recorded loudly per persona (FR-007), never silently skipped. |
| IV. Layered Boundaries | ✅ (test fixture) | Seeding writes IndexedDB/localStorage directly **from the browser as test scaffolding**, not from shipped app code; no production layer crosses a boundary. The app itself is observed from outside. Noted as fixture-only. |
| V. No Placeholders | ✅ | Reports are real executed observations; the one synthetic element (P3 glosses) is disclosed, not hidden. |
| Stack & Language | ✅ | PowerShell; reports/docs in English; persona narration records the app's Russian UI as data. |
| Doc-drift gate | ✅ planned | Feature folder + `CHANGELOG.md` entry ship in the implementing commit; reuses the documented 002 procedure (no app/code/schema change to document). |

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/004-persona-cognitive-walkthrough/
├── plan.md
├── research.md              # Phase 0 — seeding mechanism, distribution, service probing
├── data-model.md            # Phase 1 — persona, seeded LocalWord, observation, problem, finding
├── quickstart.md            # Phase 1 — how to run + validate the reports/analysis
├── contracts/
│   ├── persona-report.md     # required shape of a per-persona report
│   └── analysis-contract.md  # required shape of the consolidated analysis
└── checklists/requirements.md
```

### Artifacts produced by the run

```text
specs/004-persona-cognitive-walkthrough/
├── personas.md                          # FR-001 persona definitions (written FIRST)
└── reports/
    ├── 2026-06-27-p1-beginner.md
    ├── 2026-06-27-p2-returning.md
    ├── 2026-06-27-p3-master.md
    ├── 2026-06-27-consolidated-analysis.md
    └── screenshots/                     # per-persona captures
```

**Structure Decision**: Analysis feature. The reusable assets are the persona
definitions (`personas.md`) and the two contracts; the executed assets are the
three reports + the analysis under `reports/`. No `src/` change.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.

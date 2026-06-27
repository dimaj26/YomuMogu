# Tasks: Persona Cognitive Walkthrough

**Feature**: `004-persona-cognitive-walkthrough` | **Plan**: [plan.md](plan.md) |
**Spec**: [spec.md](spec.md)

Analysis feature — no application code. "Implementation" = define personas, seed
per-persona state in the browser, walk the live app in character, write three
reports, then one consolidated analysis. Observe-only during walkthroughs;
solutions only in the analysis (FR-006 vs FR-009). No tests generated (no
production logic; verification is [quickstart.md](quickstart.md)).

## Phase 1: Setup

- [X] T001 Confirm prerequisites: Playwright MCP + `chrome-for-testing` present; dev app running (`npm run dev`) — record the actual URL/port; feature 002 procedure present.
- [X] T002 Probe external services and record availability for the run: Gemini (chat/session attempt or key presence in `.env.local`), MeCab tokenizer (`http://localhost:8000`), AnkiConnect (`http://localhost:8765`). Note results to reuse in every persona report header.
- [X] T003 Create the report output dirs `specs/004-persona-cognitive-walkthrough/reports/` and `reports/screenshots/`.

## Phase 2: Foundational (blocks all personas)

**Personas must be defined before any walkthrough so each stays in character.**

- [X] T004 Write `specs/004-persona-cognitive-walkthrough/personas.md` (FR-001): for each of P1 `p1_beginner`, P2 `p2_returning`, P3 `p3_master` — identity/name, goals, prior experience, tooling stance, starting state (organic / light-seed / full-seed), and the four standing questions asked on every screen. Per [data-model.md](data-model.md).
- [X] T005 Establish the seeding helper approach: a reusable in-page JS snippet (run via `browser_evaluate`) that (a) sets localStorage profile keys for a given `profileId` (`yomumogu_active_profile_id`, append to `yomumogu_profiles`, `deck_mode='local'`), and (b) bulk-`put`s `LocalWord` rows into `YomuMoguDatabase.words` (keyPath `[profileId,id]`, `category='__local_starter__'`). Verify it round-trips on a throwaway profile before seeding real personas.

**Checkpoint**: personas defined + seeding verified — persona runs can begin.

## Phase 3: User Story 1 — P1 absolute beginner, organic (P1) 🎯 MVP

**Goal**: Walk the true first-run journey from a fresh empty profile, in character.

**Independent test**: P1 report covers landing + onboarding journey with the four
questions on every screen (SC-001/SC-002).

- [X] T006 [US1] Select/create profile `p1_beginner` empty (organic) via `browser_evaluate`; reload; confirm fresh first-run state (no deck).
- [X] T007 [US1] Walk P1 organically following the app's own guidance — landing `/`, then wherever it leads (diagnostic, settings, practice) — capturing per screen the four in-character questions + outcome + console + network + screenshot into `reports/screenshots/`.
- [X] T008 [US1] Attempt the first-run learning path in character (e.g. run the diagnostic), recording whether onboarding is logical and whether P1 knows the next step at each gate.
- [X] T009 [US1] Write `reports/2026-06-27-p1-beginner.md` per the [persona-report contract](contracts/persona-report.md) (header incl. service availability + organic state; journey overview; per-screen sections; problems list; learning-journey verdict; limitations). Observation-only.

**Checkpoint**: P1 report complete — MVP delivered.

## Phase 4: User Story 2 — P2 returning beginner, light seed (P2)

**Goal**: Walk the second-visit journey with partial multi-feature state.

**Independent test**: P2 report shows whether resume/progress and feature
connections are clear with light-seeded state.

- [X] T010 [US2] Seed `p2_returning` (light): ≈20–30 local words across `new`/`learning`/few `review` (some due now), one completed chat session + session stats, a few `reviews` rows, one media/activity-log entry, partially-progressed quests; reload. Record exactly what was seeded.
- [X] T011 [US2] Walk P2 — home (resume/progress), practice, quiz (real due words), chat (attempt a session; if Gemini unavailable record blocked), media/YouTube (attempt; if MeCab/Gemini unavailable record blocked), settings — capturing the four questions + outcome + console + network + screenshot per screen.
- [X] T012 [US2] Write `reports/2026-06-27-p2-returning.md` per the contract (state = light-seed, disclose seeded-vs-organic + synthetic glosses; service availability; per-screen; problems; learning-journey verdict; limitations). Observation-only.

**Checkpoint**: P2 report complete.

## Phase 5: User Story 3 — P3 advanced master, full seed (P3)

**Goal**: Walk the at-scale journey for a ~4000-word power user.

**Independent test**: P3 report shows whether the app stays coherent and useful at
scale (review load, memory map, advanced practice/chat/media).

- [X] T013 [US3] Seed `p3_master` (full): ≈4000 JLPT N3–N1 words (from `src/resources/jlpt_levels.json`) into `YomuMoguDatabase.words` distributed across FSRS bands (~2500 mature / ~700 review / ~450 learning / ~250 new / ~100 lapsed-ish) with realistic `due`/`stability`/`reps`/`lapses`; `translation` from reading/placeholder; reload. Record the distribution.
- [X] T014 [US3] Walk P3 — home dashboard + Kumiko heatmap (large mature vocab + due load), practice launcher (review split / priority), quiz (`mode=review` with many due), chat at higher difficulty (attempt; blocked if Gemini down), media/YouTube, grammar/learning-track — capturing the four questions + outcome + console + network + screenshot per screen.
- [X] T015 [US3] Write `reports/2026-06-27-p3-master.md` per the contract (state = full-seed + distribution + synthetic-gloss disclosure; service availability; per-screen; problems; learning-journey verdict; limitations). Observation-only.

**Checkpoint**: all three persona reports complete.

## Phase 6: User Story 4 — Consolidated analysis (P2)

**Goal**: Synthesize problems across personas with categories, priorities, sources, and proposed solutions (the only artifact that designs fixes).

**Independent test**: every finding traces to a persona/screen; learning-logic is a distinct section (SC-003).

- [X] T016 [US4] Collate all raw Problems from the three reports; build the cross-persona problem matrix (which personas hit each issue → systemic vs persona-specific).
- [X] T017 [US4] Write `reports/2026-06-27-consolidated-analysis.md` per the [analysis contract](contracts/analysis-contract.md): inputs; matrix; consolidated findings (id/category/priority/sources/description/proposed solution); a distinct learning-logic section; a prioritized do-next list. Every finding traces to ≥1 observation.

**Checkpoint**: analysis complete — solutions proposed (implementation out of scope).

## Phase 7: Polish & Cross-Cutting

- [X] T018 Validate all four artifacts against [contracts/persona-report.md](contracts/persona-report.md), [contracts/analysis-contract.md](contracts/analysis-contract.md) and the [quickstart.md](quickstart.md) checklist; fix gaps. Confirm walkthrough sections contain no fixes (FR-006) and no app source changed (SC-005/FR-010).
- [X] T019 [P] Append a `CHANGELOG.md` entry for feature 004 (persona walkthrough: 3 reports + consolidated analysis).
- [X] T020 Auto-commit the feature (specs, personas, reports, analysis, screenshots, CHANGELOG) with a `docs(analysis):` subject; do **not** push. (No code symbols changed → no graphify update needed.)

## Dependencies & order

- **Setup (T001–T003)** → **Foundational (T004–T005)** → personas.
- **US1 (T006–T009)** is the MVP. **US2 (T010–T012)** and **US3 (T013–T015)** are
  independent of each other (different profiles) but each depends on T004–T005.
- **US4 (T016–T017)** depends on all three reports (US1–US3).
- **Polish (T018–T020)** last.

## Parallel opportunities

- After seeding, P2 and P3 walks (US2/US3) are independent (separate profiles) and
  could be done in either order. T019 (CHANGELOG) is `[P]` vs other polish.
- Within a persona, the walk is sequential (state evolves as you navigate).

## MVP scope

**User Story 1 (T001–T009)** — the P1 first-run report — alone delivers the
highest-value insight (where the product is won/lost). US2/US3 add returning and
at-scale lenses; US4 synthesizes solutions.

## Summary

- Total tasks: **20** (Setup 3, Foundational 2, US1 4, US2 3, US3 3, US4 2, Polish 3).
- Per story: US1 = 4, US2 = 3, US3 = 3, US4 = 2.
- Observe-only walkthroughs; solutions only in US4 (T017).

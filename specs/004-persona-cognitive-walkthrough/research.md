# Phase 0 Research: Persona Cognitive Walkthrough

No `NEEDS CLARIFICATION` remained (the three critical decisions were resolved with
the user up front). This records the mechanism decisions the plan depends on.

## Decision 1 — Three isolated profiles, persona state via runtime browser seeding

- **Decision**: Use three `profileId`s (`p1_beginner`, `p2_returning`,
  `p3_master`). Establish state by executing in-page JavaScript through the
  Playwright MCP (`browser_evaluate`) against the app origin: set localStorage
  profile keys and bulk-write `LocalWord` rows into the `YomuMoguDatabase` `words`
  store. P1 gets nothing (organic).
- **Rationale**: Profiles already isolate state by `profileId` (localStorage
  `yomumogu_profile_<id>_<key>` + `words.profileId`), so personas don't pollute
  each other and can be compared. Seeding from the browser keeps the feature
  additive — no app code, no new scripts shipped, no schema change (FR-010).
- **Alternatives considered**: A committed seed script under `scripts/` (rejected —
  adds shipped tooling for a one-off analysis; the browser can do it inline). Going
  fully organic for P2/P3 (rejected at grill — can't reach 4000 words / rich
  multi-feature history in one pass). Mocking the data layer (rejected — defeats a
  *real-browser* test).

## Decision 2 — Seed into the local deck so the app's read path works

- **Decision**: Seed words with `category = '__local_starter__'`, `source =
  'starter'`, and `deck_mode = 'local'` for P2/P3, so `isLocalDeckInitialized`
  returns true and the home/practice/quiz local-mode read paths render the seeded
  vocabulary as the active deck.
- **Rationale**: The app gates local-mode reads on `category === '__local_starter__'`
  (per feature 003 work). Reusing that category is the lowest-friction way to make
  a synthetic deck appear as the learner's real deck without touching code.
- **Alternatives considered**: Anki source for P3 (rejected at grill — needs
  AnkiConnect + a real 4000-card deck). A new category (rejected — the app would
  not treat it as the active local deck).

## Decision 3 — P3 content from JLPT N3–N1; disclose synthetic glosses

- **Decision**: Draw P3's ~4000 words from `src/resources/jlpt_levels.json` levels
  N3 (2078) + N2 (1790) + N1 (2655). Each entry has `word` + `reading`; the
  `translation` field is filled from the reading or a placeholder. The report
  discloses that glosses are synthetic.
- **Rationale**: This is the app's own advanced vocabulary DB (grill answer), so
  the content is realistic for a master; exact translations are irrelevant to a UX
  / learning-logic walkthrough. Disclosure preserves No-Placeholders honesty.
- **Alternatives considered**: Fetching real translations (rejected — unnecessary
  cost/effort for a UX test; volume + FSRS distribution is what matters).

## Decision 4 — FSRS distribution tuned for realistic at-scale UI

- **Decision**: ~2500 `mature` / ~700 `review` / ~450 `learning` / ~250 `new` /
  ~100 lapsed-ish, with `due` timestamps spread (some past → due now, most future),
  `stability`/`reps`/`lapses` set per status band.
- **Rationale**: Drives the Kumiko heatmap colors, the "N к повторению" due
  counters, and review-load surfaces to look like a genuine power user, which is
  what P3 is meant to stress-test. A flat all-`mature` seed would hide the
  review-load UX.
- **Alternatives considered**: All-mature or all-new (rejected — unrealistic, hides
  the surfaces P3 is for).

## Decision 5 — Probe external services at run start; blocked, never mocked

- **Decision**: At the start of each persona run, probe Gemini (via a chat/session
  attempt), MeCab (`:8000`), AnkiConnect (`:8765`). Record availability in the
  report header. When a screen needs an unavailable service, record it
  **blocked — <service>** with the persona's in-character reaction.
- **Rationale**: Honest real-browser testing (FR-007). The persona's experience of
  hitting a wall is itself a valid UX observation.
- **Alternatives considered**: Mocking (rejected, FR-007). Skipping the screen
  (rejected — the block is data).

## Decision 6 — Personas defined first, in their own file

- **Decision**: Write `personas.md` (FR-001) before any walkthrough, with each
  persona's identity, goals, prior experience, tooling stance, starting state, and
  the four standing questions they ask on every screen.
- **Rationale**: Staying in character requires a fixed reference; it also makes the
  reports reproducible and the analysis traceable.
- **Alternatives considered**: Inlining persona traits into each report (rejected —
  duplicative and drift-prone).

## Decision 7 — Observe-only walkthrough, solutions only in the consolidated step

- **Decision**: Persona reports state problems only (esp. learning-logic). A
  separate consolidated analysis is the sole place that designs solutions, after
  all three reports exist.
- **Rationale**: The user explicitly separated observation from processing; mixing
  fixes into the walkthrough biases the observation. (FR-006 vs FR-009.)
- **Alternatives considered**: Proposing fixes inline (rejected per the directive).

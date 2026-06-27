# Feature Specification: Persona Cognitive Walkthrough

**Feature Branch**: `004-persona-cognitive-walkthrough`

**Created**: 2026-06-27

**Status**: Implemented (2026-06-27)

**Input**: Run a persona-driven cognitive UX & learning-logic walkthrough of the
live app in a real browser, from the point of view of three learner personas, to
surface bugs, a weak landing, navigation/UX friction, and — above all —
learning-logic gaps. Observe-only during the walkthrough; analysis & proposed
solutions come as a separate step afterward.

## Overview

Feature 002 mapped the app as a neutral observer. This feature adds the missing
dimension: **the learner's mind**. Three personas walk the live app and, on every
screen, judge not merely "does it work" but "does this make sense to *me*, do I
know what to do next, is an obvious capability missing, is the journey of learning
*logical*". The output is three first-person persona reports plus a consolidated
problem/solution analysis. It reuses feature 002's walkthrough procedure and
feature 001's real-browser capability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Absolute beginner, first time, no Anki (P1) (Priority: P1)

A first-time visitor with zero prior state opens the app and tries to start
learning Japanese. They do not use Anki and never will. We follow them organically
from the landing page through whatever the app guides them to, recording at each
screen whether the value proposition is clear, whether they know the next step,
whether the onboarding is logical, and where they get confused or stuck.

**Why this priority**: First-run is where the product is won or lost; the
beginner with no external tools is the core target user and the harshest test of
the landing, onboarding, and learning-logic.

**Independent Test**: From a fresh empty profile, walk the app as P1 organically
and produce P1's first-person report covering the landing and the onboarding
journey, each screen carrying the in-character clarity/next-step/missing-function/
convenience analysis.

**Acceptance Scenarios**:

1. **Given** a fresh empty profile, **When** P1 lands on the home page, **Then**
   the report records whether the value proposition and the first action are clear
   to a complete newcomer.
2. **Given** P1 follows the app's guidance, **When** they reach each subsequent
   screen, **Then** the report records, in character, whether they understand what
   to do next and whether the learning order is logical — stating problems, not
   fixes.

---

### User Story 2 - Returning beginner after first session (P2) (Priority: P2)

A learner who has already done a first session returns: they have a small set of
words in progress and have made first attempts at chat, the quiz, and the
YouTube/media feature. We follow them as they continue, checking whether the app
helps them resume logically, whether the features they have touched feel connected,
and whether they understand their progress.

**Why this priority**: Retention hinges on the second visit. This persona reveals
whether the app coheres once a learner has partial state across multiple features —
a different stress than first-run.

**Independent Test**: With P2's profile set to a light seeded state (a few words
across early FSRS stages, one completed chat session and its stats, a few quiz
reviews, one media-history entry), walk the app as P2 and produce P2's report.

**Acceptance Scenarios**:

1. **Given** P2's light-seeded profile, **When** P2 returns to the home page,
   **Then** the report records whether the app communicates their progress and a
   logical next step.
2. **Given** P2 revisits chat, quiz, and media, **When** they view each, **Then**
   the report records whether these features feel understandable and logically
   connected (or disconnected) to one another and to their progress.

---

### User Story 3 - Advanced master, ~4000 words (P3) (Priority: P3)

An advanced learner with a large, mature vocabulary (~4000 words drawn from the
app's JLPT N3–N1 vocabulary database, spread across FSRS states) uses the app. We
follow them through the surfaces that matter at scale — review load, the memory
map, advanced practice, chat at higher difficulty, media — checking whether the
app remains coherent and useful for a power user, and whether anything obviously
needed at this level is missing.

**Why this priority**: Validates that the learning logic and UX hold up at scale,
not just for newcomers; lowest priority because the first two personas gate the
funnel, but essential for completeness.

**Independent Test**: With P3's profile fully seeded to ~4000 words distributed
across FSRS states, walk the app as P3 and produce P3's report covering the
at-scale surfaces with the in-character analysis.

**Acceptance Scenarios**:

1. **Given** P3's fully-seeded large profile, **When** P3 views the home dashboard
   and memory map, **Then** the report records whether the app meaningfully
   represents a large, mature vocabulary and its review load.
2. **Given** P3 uses advanced practice/chat/media, **When** they view each,
   **Then** the report records whether the experience stays coherent at scale and
   whether an obviously-needed power-user function is missing.

---

### User Story 4 - Consolidated problem & solution analysis (Priority: P2)

After all three walkthroughs are complete, a single analysis consolidates the
observed problems across personas — deduplicated, categorized (bug / landing /
navigation-UX / learning-logic), prioritized — and, for each, proposes a solution.
This is the only place solutions are designed; the walkthroughs themselves only
observe.

**Why this priority**: The walkthroughs produce raw observations; the value for
the team is the synthesized, prioritized problem set with proposed fixes. It
depends on all three persona reports existing first.

**Independent Test**: Given the three persona reports, produce one consolidated
analysis where every listed problem traces to at least one persona observation and
carries a category, a priority, and a proposed solution.

**Acceptance Scenarios**:

1. **Given** the three persona reports, **When** the analysis is produced, **Then**
   each consolidated problem references the persona(s) and screen(s) it came from
   and is categorized and prioritized.
2. **Given** each consolidated problem, **When** a reader reviews it, **Then** a
   proposed solution is present and the learning-logic problems are called out
   distinctly from cosmetic/navigation ones.

---

### Edge Cases

- **External service unavailable** (Gemini key absent, MeCab tokenizer down,
  AnkiConnect off): the dependent screen is recorded as "blocked — <service>",
  with the persona noting the experience of hitting that wall; flows are never
  mocked to fake success.
- **Persona has no due items** (e.g., P1 before diagnostics, or a freshly seeded
  state with nothing due today): recorded as the real observed state, with the
  persona's reaction, not skipped.
- **Seeded state does not match a real journey** (synthetic P2/P3): the report
  notes which state was seeded vs organic so observations are interpreted correctly.
- **A feature dead-ends or errors for a persona**: stated as a problem from that
  persona's view; the walkthrough continues.
- **Non-deterministic content** (AI replies, due counts, recommendations): treated
  as a point-in-time snapshot, not asserted as fixed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST define three distinct learner personas (P1 absolute
  beginner / no-Anki; P2 returning beginner with partial multi-feature state; P3
  advanced master ~4000 words) with explicit, followable characteristics, BEFORE
  any walkthrough begins, so each walkthrough can stay in character.
- **FR-002**: Each persona MUST be walked through the live app in a real browser
  using the existing real-browser capability, in an isolated per-persona profile.
- **FR-003**: Persona state MUST be established per the agreed method: P1 organic
  (fresh profile), P2 light seeded state, P3 fully seeded (~4000 words across FSRS
  states from the JLPT N3–N1 source). The report MUST state, per persona, what was
  organic vs seeded.
- **FR-004**: On EVERY visited screen, each persona walkthrough MUST record an
  in-character analysis answering: (a) is everything in the interface clear; (b) do
  I understand what to do next; (c) is there an obvious function missing from the
  service; (d) is the interface convenient.
- **FR-005**: On every visited screen the walkthrough MUST also record objective
  signals: bugs/broken flows, console errors/warnings, and failed/erroring network
  requests (or "none observed").
- **FR-006**: During a walkthrough the persona MUST only OBSERVE and STATE problems
  — especially **learning-logic** problems (is the learning order logical; are
  features understandable and coherently connected or disconnected) — and MUST NOT
  design fixes.
- **FR-007**: When a screen depends on an external service that is unavailable, the
  walkthrough MUST record it as "blocked — <service>" with the persona's reaction,
  and MUST NOT mock the service to fake a working flow.
- **FR-008**: The feature MUST produce **three dated persona reports**, one per
  persona, each containing the per-screen in-character analysis and objective
  signals.
- **FR-009**: After the three reports, the feature MUST produce **one consolidated
  analysis** that deduplicates and categorizes the observed problems (bug /
  landing / navigation-UX / learning-logic), prioritizes them, traces each to its
  persona/screen source, and proposes a solution for each — this being the only
  artifact where solutions are designed.
- **FR-010**: The feature MUST be additive and analysis-only — it adds **no**
  application source changes and no new shipped runtime dependency; seeding affects
  only local per-persona profile state used for the test.
- **FR-011**: The procedure MUST run on Windows/PowerShell with the browser
  headless by default, with zero manual per-session browser setup.
- **FR-012**: In-character persona narration is the report's data; persona-facing
  observations about Russian UI are recorded as observed. (Reports/analysis prose
  follow the project's documentation-language norms.)

### Key Entities *(include if feature involves data)*

- **Persona**: a defined learner archetype (identity, goals, prior experience,
  tooling stance, starting state) that a walkthrough follows in character.
- **Persona walkthrough run**: one persona's pass over the live app at a point in
  time; produces one dated persona report.
- **Screen observation (in-character)**: per-screen record combining the four
  clarity questions (FR-004), objective signals (FR-005), and an outcome.
- **Problem**: an observed issue (bug / landing / navigation-UX / learning-logic)
  tied to the persona(s) and screen(s) that surfaced it.
- **Consolidated finding**: a deduplicated, categorized, prioritized problem with a
  proposed solution, referencing its source observations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Three dated persona reports exist, one per persona, each covering
  that persona's in-scope screens with the four-question in-character analysis on
  every visited screen.
- **SC-002**: 100% of visited screens in each report carry both the in-character
  analysis and the objective signals (console/network/bugs, "none observed"
  allowed).
- **SC-003**: The consolidated analysis lists every distinct problem with a
  category, a priority, a source trace (persona + screen), and a proposed solution;
  learning-logic problems are identified as a distinct category.
- **SC-004**: A reader of the three reports can describe how the learning journey
  feels at three experience levels (new / returning / advanced) and where it breaks
  down — without having run the app.
- **SC-005**: The walkthroughs change no application behavior — a re-run on a fresh
  profile reproduces the P1 organic journey unchanged; seeding touched only
  test-profile state.

## Assumptions

- **Builds on 001 + 002**: the real-browser capability and the cognitive-
  walkthrough procedure exist; this feature consumes them and adds the persona lens.
- **State setup method (agreed)**: hybrid — P1 organic, P2 light seed, P3 full
  seed; three isolated profiles. Seeding is done against local per-persona profile
  state only (the app's own client-side storage), introducing no new schema.
- **External services (agreed)**: used for real when configured; otherwise the
  dependent screen is recorded as blocked with the service named — never mocked.
- **P3 vocabulary source (agreed)**: the app's built-in JLPT N3–N1 vocabulary
  database, ~4000 words distributed across FSRS states for test quality (the exact
  per-state distribution is chosen during planning for realism).
- **Local dev app**: the analysis targets the locally running dev app, not a
  deployed environment.
- **Point-in-time**: each report is a snapshot; non-deterministic content (AI
  replies, due counts, recommendations) may differ on re-runs.
- **Scope of screens**: landing/home, practice launcher, quiz, chat, settings, and
  the media/YouTube and grammar/learning-track surfaces, as reachable per persona;
  unreachable-for-persona screens are recorded as such.

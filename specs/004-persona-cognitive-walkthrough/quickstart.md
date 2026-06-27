# Quickstart: Validate the Persona Walkthrough

## Prerequisites

1. Feature 001 working (Playwright MCP, headless, `chrome-for-testing` installed).
2. Dev app running (`npm run dev`); note the URL/port.
3. Feature 002 procedure present (`knowledge/cognitive-walkthrough.md`).
4. Persona definitions written: `specs/004-persona-cognitive-walkthrough/personas.md`.
5. (Optional, improves coverage) External services up: Gemini key in `.env.local`,
   MeCab tokenizer on `:8000`, AnkiConnect on `:8765`. If absent, dependent screens
   are recorded blocked (not mocked).

## Run

For each persona (`p1_beginner`, `p2_returning`, `p3_master`):

1. Probe service availability (Gemini/MeCab/Anki); record in the report header.
2. Establish state via the browser:
   - **P1**: select/create profile `p1_beginner`; leave empty (organic).
   - **P2**: create `p2_returning`; seed the light state (≈20–30 words across early
     FSRS stages, one completed chat session + stats, a few quiz reviews, a media/
     activity entry, partial quests).
   - **P3**: create `p3_master`; seed ≈4000 JLPT N3–N1 words across FSRS bands.
   - Seeding is in-page JS via the MCP into `YomuMoguDatabase.words` +
     localStorage profile keys (`category='__local_starter__'`, `deck_mode='local'`);
     reload after seeding.
3. Walk the in-scope screens (home, practice, quiz, chat, settings, media/YouTube,
   grammar/learning-track as reachable). On each, record the four in-character
   questions + outcome + console + network + screenshot, per the
   [persona-report contract](contracts/persona-report.md).
4. Write the dated persona report.

Then produce the [consolidated analysis](contracts/analysis-contract.md) from the
three reports.

## Validate

- [ ] `personas.md` exists and defines all three personas (FR-001).
- [ ] Three dated persona reports exist, each contract-valid (all four questions +
      signals + screenshot per screen; seeded-vs-organic stated; services recorded).
- [ ] Walkthrough sections contain **no** proposed fixes (observation-only, FR-006).
- [ ] The consolidated analysis exists, every finding traces to a persona/screen,
      has a category + priority + proposed solution, and learning-logic is a
      distinct section (FR-009 / SC-003).
- [ ] No application source changed; seeding touched only per-persona profile state
      (SC-005 / FR-010).

## Done when

- A reader can describe how the learning journey feels for new / returning /
  advanced learners and where it breaks (SC-004), and has a prioritized,
  solution-bearing problem list to act on.

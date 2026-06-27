# Personas — Cognitive Walkthrough (feature 004)

The three learner archetypes the walkthroughs follow **in character**. Each is run
in its own isolated profile. On **every** screen each persona asks the same four
**standing questions**:

1. **Ясно ли мне всё в интерфейсе?** (is everything clear?)
2. **Понимаю ли я, что делать дальше?** (do I know the next step?)
3. **Есть ли очевидная функция, которой тут не хватает?** (obvious missing function?)
4. **Удобен ли интерфейс?** (is it convenient?)

During the walkthrough each persona **only states problems** (bugs, weak landing,
navigation/UX friction, and above all **learning-logic** gaps) — never designs
fixes. Solutions live only in the consolidated analysis.

---

## P1 — «Аня, первый день» (`p1_beginner`)

- **Identity**: 24-year-old complete beginner. Heard Japanese is hard, wants to
  "just start" today. Not technical.
- **Goals**: Understand what this app is, and begin learning something real in the
  first 5 minutes without reading a manual.
- **Prior experience**: Zero Japanese. Never used a spaced-repetition app. Has
  heard of Anki but **does not use it and never will** — does not want to install
  anything or import decks.
- **Tooling stance**: Local-only, in-browser, no external tools. If a feature
  demands Anki, that's a wall for her.
- **Starting state**: **Organic** — a brand-new empty profile. Whatever the app
  shows a true first-timer is what she sees.
- **What she's sensitive to**: a vague landing ("what *is* this?"), unclear first
  action, jargon (FSRS, "стабильность", "погружение"), dead-ends, being asked to
  do things in an order that doesn't make sense for a newcomer.

## P2 — «Borys, второй заход» (`p2_returning`)

- **Identity**: 30-year-old who did one session yesterday and came back. Mildly
  motivated, easily lost if the app doesn't remember him.
- **Goals**: Resume where he left off, see that he made progress, and continue —
  ideally with a clear "do this next".
- **Prior experience**: One diagnostic + a handful of words started; tried the chat
  once, did a couple of quiz cards, poked the YouTube/media feature once. Beginner
  Japanese (a few N5 words in flight).
- **Tooling stance**: Local deck; no Anki. Open to chat and media if they're easy.
- **Starting state**: **Light seed** — ~20–30 local words across `new`/`learning`/
  a few `review` (some due now), one completed chat session + its stats, a few quiz
  reviews logged, one media/activity entry, quests partially progressed.
- **What he's sensitive to**: whether the home screen shows his progress and a
  logical next step; whether chat / quiz / media feel like parts of **one** journey
  or disconnected toys; whether yesterday's effort is visible.

## P3 — «Мария, продвинутая» (`p3_master`)

- **Identity**: 35-year-old advanced learner (~N2 level) with a large mature
  vocabulary. Efficiency-driven power user.
- **Goals**: Clear today's review load fast, find advanced/immersion practice, and
  trust that the app scales to thousands of words without becoming noise.
- **Prior experience**: Years of study; ~4000 words known, drawn from the app's
  JLPT N3–N1 vocabulary, spread across FSRS states (many mature, a meaningful due
  load, some lapses).
- **Tooling stance**: Local deck seeded at scale (source-agnostic). Would use Anki
  in real life, but here evaluates the app's own at-scale UX.
- **Starting state**: **Full seed** — ~4000 words across FSRS bands (~2500 mature /
  ~700 review / ~450 learning / ~250 new / ~100 lapsed-ish). *Synthetic glosses*
  (JLPT source provides word+reading; translations are placeholders) — disclosed.
- **What she's sensitive to**: review-load representation (the Kumiko heatmap, due
  counts), whether advanced practice/chat/media stay coherent at scale, and whether
  an obviously-needed power-user function is missing (filtering, bulk actions,
  level targeting, immersion depth).

---

## Service availability for this run (probed 2026-06-27)

| Service | Status | Effect on walkthroughs |
|---------|--------|------------------------|
| Dev app (`:3000`) | **up** (200) | all UI reachable |
| Gemini (key in `.env.local`) | **present** | chat + session generation + YouTube query-expansion can run for real |
| MeCab tokenizer (`:8000`) | **down** | media/YouTube tokenize step → `blocked — MeCab` |
| AnkiConnect (`:8765`) | **down** | Anki source tabs/flows → `blocked — AnkiConnect` (personas use local deck, so secondary) |

# Consolidated Problem & Solution Analysis — Persona Walkthrough (2026-06-27)

> Synthesis of the three persona reports (feature 004). Per the
> [analysis contract](../contracts/analysis-contract.md), this is the **only**
> artifact that proposes solutions. Every finding traces to ≥1 persona observation.

## 1. Inputs

- [P1 — Аня, beginner](2026-06-27-p1-beginner.md)
- [P2 — Borys, returning](2026-06-27-p2-returning.md)
- [P3 — Мария, master](2026-06-27-p3-master.md)
- Personas: [personas.md](../personas.md). Services this run: Gemini **up**,
  MeCab `:8000` **down**, AnkiConnect **down**.

## 1b. Correction notice (full-state re-run, 2026-06-28)

The first walkthrough seeded only decks (not XP/sessions/grammar), which made
progress headers read 0 and triggered a false "purge" reading. A second run seeded
**complete, persistent** stage state for P2 and P3 and re-verified. Net changes to
this analysis:

- **C-01 (progress/identity disconnect) — RETRACTED.** With `japanification` seeded,
  the header correctly shows real progress (P2: Level 1 / 11 used / 1 session; P3:
  Level 6 / 3180 used / 142 sessions / 900 due). It was an artifact of incomplete
  test seeding, not an app defect.
- **C-13 (local-deck purge) — RETRACTED.** The sync (`syncExistingLocalWordsWithStarterDeck`)
  only updates (`bulkPut`), never deletes; 4000 words persisted across reloads.
- **C-04 (session generation) — SOFTENED.** It completes (~tens of seconds) and only
  intermittently stalled; the real issue is *slowness + no cap/timeout* at scale,
  not "never completes". Downgraded P1→P2.
- **C-15 (Debug HUD shows 0)** and all learning-logic findings below — **CONFIRMED**
  with proper full state (esp. C-02 map-capped-at-500 and C-08 levels-locked-despite-
  mature-grammar). Priorities in §5 updated accordingly.

## 2. Cross-persona problem matrix

| Problem (short) | P1 | P2 | P3 | Category |
|-----------------|:--:|:--:|:--:|----------|
| Progress header (0 XP/sessions/Level) contradicts real deck state | – | ✅ | ✅ | learning-logic |
| Memory map limited to 500 words / hardcoded "500" | ◑ | – | ✅ | learning-logic |
| Review queue: no session-sizing / filtering / batching | – | ◑ | ✅ | nav-ux + learning-logic |
| Session generation slow / no progress (P2) → stalls at scale (P3) | – | ✅ | ✅ | bug / performance |
| Headline feature (chat) gated, no preview of the value | ✅ | – | – | learning-logic |
| No single "recommended next"; dense dashboard for every level | ✅ | ✅ | ✅ | navigation-ux |
| Balance widget hardcoded "(N5)" | – | ◑ | ✅ | bug |
| Higher JLPT levels locked regardless of vocabulary scale | – | ✅ | ✅ | learning-logic |
| False "Все слова повторены! Отличная работа" on day one | ✅ | – | – | learning-logic / copy |
| Mascot points to non-existent "Практика" nav; stale bubble | ✅ | – | – | navigation-ux |
| Diagnostic lacks "I'm a complete beginner / select none" path | ✅ | – | – | navigation-ux |
| Media interactive hard-depends on local MeCab (unusable when down) | – | ✅ | ◑ | availability |
| Local deck purges entries not in the 500-word starter set | – | – | ✅ | bug (data) |
| Landing has no "how it works / preview" before commitment | ✅ | – | – | landing |
| Debug HUD always shows 0 / "не найдены" (dev-only) | ◑ | ✅ | ✅ | bug (dev-only) |
| Repeated CSS-preload console warning (= 002 F-05) | ✅ | ✅ | ✅ | console |

✅ = clearly hit · ◑ = partial/secondary · – = not surfaced for that persona.

## 3. Consolidated findings (with proposed solutions)

> Priority key: **P1** = high (blocks core funnel or core learning logic) · **P2** =
> medium · **P3** = low/polish.

### Learning-logic (called out as a distinct class — see §4 for the narrative)

- **C-01 — Identity/progress disconnect** · learning-logic · **P1** · sources: P2-A
  (`/` home), P3-B (`/` home).
  *Problem*: the gamification header («слов использовано / сессий завершено / XP /
  Уровень погружения») reads 0 even when the deck holds 15 (P2) or 4000 (P3) words
  with hundreds due — on the same screen as «N слов к повторению».
  *Proposed solution*: derive the header from real deck/FSRS signals (known words,
  mature count, due count, study streak) instead of a separate XP-only counter, or
  at minimum reconcile the two so they never contradict on one screen; show a
  vocabulary-size and mastery summary for returning/advanced users.

- **C-02 — Memory map represents only 500 words** · learning-logic · **P2/P3** ·
  sources: P3-A (`/` grid), P1 (grid opaque to newcomer).
  *Problem*: the Kumiko grid is fixed at 50 cells / 500 starter words and the
  description hardcodes "500"; a 4000-word learner sees ~12.5% of their deck and no
  N3/N2/N1 breakdown.
  *Proposed solution*: scale the heatmap to the actual deck size (or aggregate
  per-level), make the description reflect the real word count, and add a
  level/status distribution view for larger decks.

- **C-03 — No review session sizing / filtering at scale** · learning-logic +
  nav-ux · **P1 (for advanced)** · sources: P3-C (`/practice`), P2 (queue of 15 ok,
  but no control).
  *Problem*: review is a single «Начать повторение [N]» with no way to cap the
  session (e.g. 20), filter by level, or prioritize lapses; at 900 it's a firehose.
  *Proposed solution*: add session-size presets, a "lapsed/weak first" option, and
  level filters (N3/N2/N1) to the review entry; default to a sensible daily target.

- **C-05 — Headline feature (chat) gated day-one with no preview** · learning-logic
  · **P2** · sources: P1-C (`/practice`, `/chat`).
  *Problem*: a first-timer drawn by "разговорная практика с ИИ" can't reach chat
  until ≥5 words are in learning, and nothing lets them preview the value.
  *Proposed solution*: keep the gate (it's pedagogically sound — see feature 003
  audit) but add a short demo/preview of a chat exchange, and make the path to
  unlock explicit ("learn 5 words → unlock chat", with progress N/5).

- **C-08 — Higher JLPT levels locked regardless of vocabulary** · learning-logic ·
  **P2** · sources: P3-F (themes), P2 (level selector N5 active / N4–N1 locked).
  *Problem*: scenario levels N4–N1 stay locked even for a 4000-word N3–N1 learner;
  vocabulary scale never unlocks higher-level practice.
  *Confirmed root cause (read-only diagnosis, 2026-06-28)*: shares a root with C-07
  — `src/lib/competency/profile.ts` `buildCompetencyProfile` is a v1 stub
  (`const level: JlptLevelId = 'N5'` at :115, comment "Версия 1: уровень жёстко
  зафиксирован как 'N5'") and only computes lex/grammar coverage **for N5** (:116–117).
  The level never advances and N3–N2–N1 coverage is never evaluated, so the selector
  stays N5-only. Compounded by **missing content**: only 15 grammar rules exist
  (N5+N4), so `computeGrammarCoverage` returns 0 for N3–N1 (`levelRules.length===0`,
  :65–68) — grammar-based promotion above N4 is impossible without authoring N3–N1
  grammar.
  *Proposed solution*: implement real level derivation in `buildCompetencyProfile`
  (promote N5→N1 by per-level lexCoverage thresholds — lex is computable from
  `jlpt_levels.json` + `jlpt:nX` tags — and grammarCoverage where rules exist), then
  drive the selector from it; author N3–N1 grammar content to fully unlock the top
  levels, or gate top levels on lex-only until grammar exists. **Needs a product
  decision** (thresholds; lex-only vs lex+grammar) — not auto-implemented.

- **C-07 root cause (read-only diagnosis, 2026-06-28)**: confirmed the balance
  widget's "(N5)" is **not** a widget hardcode but the competency engine returning a
  hardcoded `level: 'N5'` (`profile.ts:115`, v1 stub). Same fix as C-08's level
  derivation resolves both.

- **C-09 — False "all reviewed, great job" on day one** · learning-logic/copy ·
  **P2** · sources: P1-B (`/practice`).
  *Problem*: «Все активные слова повторены! Отличная работа.» shows to a user who
  has reviewed nothing, undermining trust in the app's feedback.
  *Proposed solution*: distinguish "nothing due yet (you're just starting)" from
  "you cleared your reviews"; only praise after real review activity.

### Bugs

- **C-04 — Session generation slow / stalls at scale** · bug/performance · **P1** ·
  sources: P3-E (`/api/gemini/classify` >90s, never completed), P2-C (~20s, no
  progress).
  *Problem*: the pre-session word-classification scales poorly; for a large deck
  chat-session generation never completes; even at small scale there's a long wait.
  *Proposed solution*: cap/sample the words sent to the classifier, cache
  classifications, run them incrementally/in background, and add a timeout +
  fallback + "this is taking a while" state. (P2-C's missing progress copy is the
  small-scale facet.)

- **C-07 — Balance widget hardcoded "(N5)"** · bug · **P2** · sources: P3-D
  (`/practice`).
  *Problem*: «Баланс обучения (N5)» shows N5 regardless of the learner's level.
  *Proposed solution*: bind the widget's level to the learner's active/target level.

- **C-12 — Media interactive hard-depends on local MeCab** · availability/bug ·
  **P2** · sources: P2-D (media player).
  *Problem*: the headline "tap-to-learn subtitles" requires the MeCab tokenizer
  (`:8000`); when it's down the core value is unavailable (it degrades gracefully,
  but the feature can't function). A local-only dependency is fragile for most users.
  *Proposed solution*: provide a hosted/bundled tokenizer fallback, or a clearer
  in-product setup/health indicator for the tokenizer, so the feature isn't silently
  unusable.

- **C-13 — Local deck purges non-starter entries** · bug (data) · **P2** ·
  sources: P3-H.
  *Problem*: starter-deck reconciliation on `/practice` load removes
  `__local_starter__` words not present in the canonical 500-word set. Benign for
  pure-starter users, but risks data loss for any local word outside that set
  (e.g. future manual additions).
  *Proposed solution*: scope reconciliation to add/refresh only; never delete
  user-owned local words; separate "starter canonical" from "user-local" entries.

- **C-15 — Debug HUD always shows 0 / "не найдены"** · bug (dev-only) · **P3** ·
  sources: P2-F, P3 (all).
  *Problem*: the dev Debug HUD's "Слова на повторении" and FSRS inspector show 0 /
  not-found even when the active profile has many words.
  *Proposed solution*: bind the HUD to the active profile's live data (dev-only, low
  priority).

### Navigation / UX

- **C-06 — No "recommended next" + one-size dashboard** · navigation-ux · **P2** ·
  sources: P1 (overload), P2-B, P3-G.
  *Problem*: every level gets the same dense practice dashboard with several
  equally-weighted CTAs; beginners feel overload, masters get no power-user density.
  *Proposed solution*: surface a single primary "do this next" action driven by
  state (warm-up / review / chat), and progressively reveal secondary panels;
  consider a denser/power mode for large decks.

- **C-10 — Mascot points to non-existent "Практика" nav; stale bubble** ·
  navigation-ux · **P2** · sources: P1-A, P1-E (`/` home).
  *Problem*: the mascot says «Перейди в раздел практики», but there's no "Практика"
  nav entry; after diagnostics the bubble is stale vs the new CTA.
  *Proposed solution*: add a Practice nav entry (or change the copy to match the
  actual CTA), and make the mascot bubble state-aware.

- **C-11 — Diagnostic lacks a "complete beginner" express path** · navigation-ux ·
  **P3** · sources: P1-D.
  *Problem*: a zero-knowledge user must intuit that saving with nothing marked is
  correct; the 3-tab × 4-category list implies prior knowledge.
  *Proposed solution*: add an "I'm a complete beginner — start fresh" shortcut that
  skips triage and seeds all-new.

### Landing

- **C-14 — Landing has no "how it works / preview"** · landing · **P3** · sources:
  P1-F.
  *Problem*: the marketing H1 + one line is the only pre-commitment info; a newcomer
  commits to the diagnostic blind.
  *Proposed solution*: add a brief "how it works" (3 steps) or a tiny preview/demo
  near the primary CTA.

### Console

- **C-16 — Repeated CSS-preload warning** · console · **P3** · sources: P1-G/P2-G/
  P3-I (= 002 finding F-05).
  *Problem/solution*: as 002 F-05 — verify it appears in production before acting;
  dev-build noise otherwise. Low priority.

## 4. Learning-logic section (the heart of it)

Across all three levels, the **core learning loop is genuinely strong and
coherent** — and this is the app's biggest asset. P2 demonstrated it end-to-end:
*your words → AI-generated themes about those words → a chat that detects, checks
off, and steers toward your target words → media recommendations scored by your
vocabulary*. That loop is the product's soul and it works.

The learning-logic **problems are about the edges of that loop, not its core**:

1. **The app doesn't know who the learner is over time.** Progress/identity is
   shown as 0 even when the deck proves otherwise (C-01), and the memory map only
   covers the first 500 words (C-02). A learner can't *see their own journey* — the
   very thing a learning app must reflect back. **Highest-leverage fix.**
2. **It doesn't scale its pedagogy.** Review has no session sizing or
   level-targeting (C-03), higher levels stay locked regardless of demonstrated
   vocabulary (C-08), and session generation stalls at scale (C-04). The logic is
   tuned for the first 500 words, not the next 3500.
3. **The order is implicit and occasionally dishonest.** The funnel
   (diagnose → warm-up → quiz → unlock chat) is sound but never stated as a path
   (C-05/C-06), and day-one feedback can be misleading ("all reviewed, great job!"
   C-09). Making the path explicit and the feedback honest would convert the
   implicit logic into a guided journey.

Net: **the learning *engine* is right; the learning *narrative* (progress mirror,
explicit path, level-scaling) is the gap.**

## 5. Prioritized "do next" list

*(Updated after the full-state re-run: C-01/C-13 retracted, C-04 softened.)*

**P1 — high (fix first):**
1. **C-02** Scale the memory map to the real deck / per-level breakdown — a master
   currently sees only 500 of their 4000 words; the home grid hardcodes "500".
2. **C-03** Review session sizing / filtering / lapsed-first — make 900 due usable.
3. **C-08** Level availability tied to demonstrated competency (and add N3–N1 grammar
   content) — a maxed-grammar 4000-word learner is still locked to N5 scenarios.

**P2 — medium:**
4. **C-04** Session-generation slowness at scale — cap/sample classify + timeout/fallback.
5. **C-05** Make the unlock path explicit + chat preview (keep the gate).
6. **C-06** Single "recommended next" + progressive dashboard (beginner) / power density (master).
7. **C-07** Bind balance widget to the real level (stuck at N5 even for a master).
8. **C-09** Honest day-one review feedback ("nothing due yet" vs "great job").
9. **C-10** Practice nav entry / state-aware mascot.
10. **C-12** Tokenizer fallback/health for media (interactive subtitles need MeCab).
11. **C-15** Fix Debug HUD profile binding (dev-only, but consistently wrong).

**P3 — low/polish:**
12. **C-11** Beginner express path in diagnostic.
13. **C-14** Landing "how it works" preview.
14. **C-16** CSS-preload warning (verify in prod first; = 002 F-05).

**Retracted after re-run:** C-01 (progress header — works with real state),
C-13 (no deck purge — sync never deletes).

> Implementing these is out of scope for feature 004 (analysis only). Recommended
> next step: triage the P1 trio (C-02, C-03, C-08 — all "the app doesn't scale to an
> advanced learner") into a fix feature, as 002→003 did for the earlier findings.

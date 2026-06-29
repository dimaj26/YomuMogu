# Implementation-Ready Brief — C-07 / C-08 (competency leveling)

**Status**: awaiting one product/pedagogy decision (see §6). Once decided, this is a
known, low-risk build — not a research task. Doc-only; no code/content fabricated here.

This brief turns the root-caused 004 findings **C-07** (balance widget stuck at
«(N5)») and **C-08** (JLPT scenario levels locked despite vocabulary) into a
ready-to-execute plan, with a recommendation, so a single decision unblocks it.

## 1. Root cause (verified)

`src/lib/competency/profile.ts` → `buildCompetencyProfile()` is a v1 stub:

```ts
const level: JlptLevelId = 'N5';   // line 115 — hardcoded; comment: "Версия 1: ... жёстко зафиксирован"
const lexCoverage = computeLexCoverage(userWords, level);     // computed ONLY for N5
const grammarCoverage = computeGrammarCoverage(progressMap, level); // ONLY for N5
```

So the learner's level never advances and N3–N2–N1 coverage is never evaluated.

## 2. Ripple map — everything `level` drives

`buildCompetencyProfile().level` → `macroLadderProfile.activeLevelId`
(`src/app/practice/page.tsx:399`), consumed by:

| Consumer | File / anchor | Effect of changing `level` |
|----------|---------------|----------------------------|
| **BalanceWidget** | `practice/page.tsx:1589` → `BalanceWidget.tsx` | the «Баланс обучения (N5)» label + `getBalanceHint(level, log)` recommendation. (This is the visible C-07 symptom.) |
| **LearningTrack** | `practice/page.tsx:1450` → `LearningTrack.tsx` | which node on the N5→N1 winding path is "active". |
| **coverageByLevel** | `practice/page.tsx:401-403` | per-level coverage display. |
| **Scenario level selector** (themes) | the chat-theme level buttons (N5 active / N4–N1 locked) | **Verify before building** whether its lock state derives from `activeLevelId`/competency or a separate grammar gate — this determines whether C-08's unlock changes too. |

`getPresetAdvice()` also uses `grammarCoverage` (N5 only today) — unaffected if we
keep computing grammar coverage per the active level.

## 3. The content gap (the hard part of C-08)

`src/resources/grammar_rules.json` contains **only 15 rules, all N5 (10) + N4 (5)**.
There is **no N3/N2/N1 grammar content**. So `computeGrammarCoverage` returns 0 for
N3–N1 (`levelRules.length === 0`). Therefore:

- **Lexical** progression to N3–N1 is computable today (jlpt_levels.json has N3 2078
  / N2 1790 / N1 2655 words; words carry `jlpt:nX` tags via `getJlptLevel`).
- **Grammar-gated** progression above N4 is **impossible** until N3–N1 grammar is
  authored — a substantial pedagogical content task.

## 4. Recommended approach (phased, low-regret)

**Phase A — lex-based level derivation (fixes C-07; safe, no content needed):**
Replace the hardcoded `level='N5'` with a derived level: the **highest** JLPT level
`L` for which lexical coverage is "sufficient" and all lower levels are also
sufficient. Compute `lexCoverage` per level from the user's `jlpt:nX`-tagged
mature/review words. Expose the threshold as a **named constant** (recommended
default **0.6** — i.e. you "own" a level once ≥60% of its words are mature/review),
tunable in `core/intervals.ts`. Keep grammar coverage computed for the derived
level. This makes BalanceWidget + LearningTrack reflect reality. Test-First.

**Phase B — top-level unlock policy (C-08; needs the §6 decision):**
Decide how the scenario level selector unlocks. Option (i) **lex-only**: unlock a
level by lexical coverage alone — works for N3–N1 today, but chat grammar scoping
only has N5/N4 rules, so N3+ chat would run without level-specific grammar
constraints (acceptable? it just won't *enforce* N3 grammar). Option (ii)
**lex + grammar**: keep top levels locked until N3–N1 grammar is authored — correct
but blocks advanced users until the content exists.

## 5. Test plan (Test-First)

- `lib/competency/__tests__/profile.test.ts` (or extend): seed words tagged across
  levels at varying coverage → assert the derived `level` matches the threshold rule
  (e.g. 70% N5 + 65% N4 + 10% N3 → level N4); all-N5-only → N5 (regression).
- Practice render: BalanceWidget shows the derived level (not hardcoded N5).
- Guard: `getPresetAdvice` / LearningTrack behave for the derived level.

## 6. The decision needed (one input unblocks Phase A immediately)

1. **Promotion threshold** — accept the recommended **lex-coverage ≥ 0.6 per level**
   (mature/review), or specify another value/metric?
2. **Top-level policy (C-08)** — **lex-only** unlock (advanced users reach N3–N1 now,
   without N3+ grammar enforcement) **or** **lex + grammar** (gate N3–N1 until you
   author the grammar curriculum)?
3. **N3–N1 grammar authoring** — out of scope for code; a separate content effort.
   Confirm "defer" (Phase A only) or "author later" (Phase B follows).

**My recommendation**: do **Phase A now** (lex-based leveling, threshold 0.6,
lex-only display) — it fixes the visible C-07 symptom safely and is fully testable;
defer the N3–N1 grammar authoring (Phase B) until you decide on content. Approve
that and it's a clean, small feature.

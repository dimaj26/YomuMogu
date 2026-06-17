# RNA-Blueprint — Chunk B1: level-aware (beginner-friendly) media ranking

> Route A (RNA-1). Executor: **Claude (this agent)**.
> Scope: make the media search ranking funnel serve beginners (N5/N4), not just advanced learners. Today the funnel uses a single hardcoded comprehension window `[0.85, 0.98]` that structurally excludes beginners (no real content reaches it) and ignores video length. Introduce level tiers + a duration fit, threaded from a pragmatic level signal (`chatLevel`).
> Roadmap: `_nogit_roadmap.md` §2.7.B. **Deferred to a later B2 blueprint:** genre-biased query expansion, media subtitle tap-to-add, `addWord` dedup guard.

---

## 1. Base DNA (environment / runtime constraints)

- OS: Windows 10 / PowerShell. Stack: Next.js 16 App Router, TypeScript strict, React 19, Vitest. No new dependencies.
- `src/lib/media/ranking.ts` is pure (no I/O) — the bulk of the change and all the risk live here, fully unit-testable offline.
- Verification: `npm run test` **and** `npx tsc --noEmit` (vitest does not typecheck).
- Backward compatibility constraint: the advanced/default path must reproduce today's behaviour exactly (window `[0.85,0.98]`, weights `0.6/0.4`, no duration factor) so existing `ranking` and `media/search` route tests stay green. New tier behaviour is additive.

## 2. Task RNA (logic, risks, edge cases)

**Logic.** Replace the single `RANKING_CONSTANTS.CR_WINDOW` with a per-tier ranking profile. Three tiers:
- `beginner` (N5–N4): comprehension window low and wide, short videos strongly favored, music-note (♪) segments NOT treated as junk, comprehension contributes little (familiarization, not acquisition).
- `bridge` (N4–N3): middle ground.
- `acquisition` (N3+): **exactly today's values** (incidental acquisition needs ~85–98% coverage).

Add `computeDurationFit(durationSec, tier)` (short clips fit beginners; no length cap for acquisition). Thread a `tier` through `computeLevelFit` / `assessSubtitleQuality` / `rankCandidates` and the route. The client derives `tier` from `chatLevel` (1–2→beginner, 3→bridge, 4–5→acquisition).

**Why `chatLevel` (honest note).** The principled source would be the user's JLPT level, but `buildCompetencyProfile` (`lib/competency/profile.ts:108,115`) is still hardcoded to `'N5'` — it carries no real per-user level yet. `chatLevel` (1–5, `JapanificationState`) is the available, user-controlled difficulty signal. Using it is a pragmatic proxy; a future improvement (separate item) is a real JLPT-level derivation, after which only the client mapping changes.

**Risks & mitigations:**
- Breaking existing ranking/route tests → default `tier='acquisition'` reproduces current math exactly; `RANKING_CONSTANTS` retained as the acquisition profile's values.
- `durationSec` is optional on `Candidate` (`search.ts:9`) and may be `undefined`/0 → treat missing duration as "unknown": `durationFit = 1` (do not penalize when length is unknown), so the funnel never drops a candidate purely for missing metadata.
- Empty-text default `cr = 0.90` (`route.ts:158`) currently auto-marks unknown content as near-ideal — harmful for beginners (would inflate levelFit). → make the empty-text default tier-aware (neutral, not ideal).
- Music filter change (`assessSubtitleQuality`, ♪ at `ranking.ts:59`) must only relax for `beginner`; bridge/acquisition keep current junk penalty.

**Edge cases:** unknown/zero duration (→ fit 1); empty lemmas (tier-aware default cr); all candidates filtered by sub-quality floor (existing fallback in `rankCandidates` preserved); `chatLevel` missing on client (→ default `acquisition`).

## 3. Contextual Constraints (CC)

- **[CC-1] Pure ranking module [PL-2.2]** — keep `ranking.ts` side-effect-free and fully unit-tested.
- **[CC-2] Prime Directive: Subtitle Truth [PL-8.8]** — unaffected; we only score/rank real scraped candidates, never fabricate segments.
- **[CC-3] Russian comments/logs [CP-3.2]** — touched code keeps Russian comments; this doc stays English.
- **[CC-4] Test coverage [CP-3.6 / PL-8.6]** — pure ranking changes get unit tests; the route test mocks scraping/tokenizer.
- **[CC-5] No new dependencies [CP-3.1].**
- **[CC-6] Tuning constants placement [PL-10 / CP-3.7]** — tier CR windows / duration caps are media-ranking tuning values (not the time-interval registry); they live in `ranking.ts` alongside the existing `RANKING_CONSTANTS` (precedent), NOT in `intervals.ts`.
- **[CC-7] Backward compatibility** — `tier` defaults to `acquisition`; no behavioural change for existing callers/tests.

## 4. Proposed Changes (by component)

**Ranking engine**
- `src/lib/media/ranking.ts` `[MODIFY]`:
  - Add `export type MediaTier = 'beginner' | 'bridge' | 'acquisition'`.
  - Add `RANKING_PROFILES: Record<MediaTier, {...}>` with `crWindow`, `levelFitFloor`, `maxDurationSec`, `weights{levelFit,subQuality,durationFit}`, `penalizeMusicJunk`. `acquisition` mirrors current `RANKING_CONSTANTS` (`[0.85,0.98]`, floor 0, no duration cap, weights 0.6/0.4/0, penalize true).
  - `computeLevelFit(cr, tier='acquisition')` — window+floor from profile.
  - Add `computeDurationFit(durationSec, tier)` — 1 if `≤ maxDurationSec` or duration unknown; decays above.
  - `assessSubtitleQuality(trackKind, segments, tier='acquisition')` — gate the ♪/short-junk rule by `penalizeMusicJunk`.
  - `rankCandidates(candidates, tier='acquisition')` — weighted sum incl. `durationFit`; keep sub-quality floor + empty fallback.
  - `ScoredCandidate` gains `durationFit: number`.

**Search route**
- `src/app/api/media/search/route.ts` `[MODIFY]` — read `tier` from body (default `'acquisition'`); compute `durationFit` from `c.durationSec`; pass `tier` into `computeLevelFit`/`assessSubtitleQuality`/`rankCandidates`; make the empty-lemma default `cr` tier-aware; include `durationFit` in `ScoredCandidate` and response.

**Practice launcher (client)**
- `src/app/practice/page.tsx` `[MODIFY]` — derive `tier` from `chatLevel` (read via the existing japanification source) and add it to the `/api/media/search` request body (next to `knownWords`, ~`:237`).

**Tests**
- `src/lib/media/__tests__/ranking.test.ts` `[MODIFY/NEW]` — tier profiles, `computeLevelFit`/`computeDurationFit` per tier, `rankCandidates` beginner-vs-acquisition ordering, backward-compat default.
- `src/app/api/media/search/__tests__/route.test.ts` `[MODIFY]` — pass/῾default `tier`; assert default reproduces current ranking + `durationFit` present.

## 5. Execution Steps (chunked 3–5; report after each chunk)

**Chunk 1 — pure ranking engine + TDD reproducer (steps 1–4):**
1. `[TEST]` Add failing reproducer `rankCandidates > для beginner короткое видео с низким cr ранжируется выше длинного с высоким cr` in `ranking.test.ts`; verify it FAILS. [CC-4]
2. `[PL-2.2]` `ranking.ts`: add `MediaTier`, `RANKING_PROFILES` (acquisition = current values), `computeDurationFit`, make `computeLevelFit`/`assessSubtitleQuality`/`rankCandidates` tier-aware (default `acquisition`), add `durationFit` to `ScoredCandidate`. [CC-1][CC-6][CC-7]
3. `[TEST]` Add tier/duration/level-fit unit cases; make step-1 reproducer pass; assert acquisition default == old behaviour.
4. `npx tsc --noEmit` + `npm run test` (ranking + existing suite) green.

→ **REPORT.**

**Chunk 2 — route + client wiring (steps 5–8):**
5. `[PL-4]` `route.ts`: accept `tier` (default `acquisition`), thread into ranking calls, compute `durationFit`, tier-aware empty-lemma cr default, add `durationFit` to response.
6. `[CP-3.8]` `practice/page.tsx`: derive `tier` from `chatLevel`, add to search body.
7. `[TEST]` Update `media/search` route test: default-tier backward-compat + `durationFit` field.
8. `npx tsc --noEmit` (0) + `npm run test` (green) + grep sanity for `tier`/`durationFit` wiring.

→ **REPORT.**

**Chunk 3 — docs + commit (steps 9–10):**
9. `[CMD-1/CMD-4]` Sync `PROJECT_LOGIC.md` ([PL-4.2] media/search input gains `tier`; ranking responsibilities; [PL-9.4] test count) + `CHANGELOG.md`. `CONTEXT_PROMPT.md` Media feature line if needed. (Route C: no git mid-route.)
10. `[GW-1]` Local commit. No push.

→ **REPORT.**

## 6. Verification & TDD reproducer

**Primary reproducer (feature change — red-first applies here):**
- File: `src/lib/media/__tests__/ranking.test.ts`
- Case: `rankCandidates > для beginner короткое видео с низким cr ранжируется выше длинного с высоким cr`
- Setup: two `ScoredCandidate`s — A: short (`durationSec` 60), low `cr` (0.25); B: long (`durationSec` 1800), high `cr` (0.95). Rank with `tier='beginner'`.
- Expected: **FAILS before step 2** (single profile, no durationFit → B wins on levelFit), **PASSES after** (beginner weights durationFit 0.5 + soft floor → A wins).

**Secondary:**
- `computeLevelFit(0.3, 'beginner')` ≥ floor (not ~0.35 linear); `computeLevelFit(0.3,'acquisition')` unchanged.
- `computeDurationFit(1800,'beginner')` < `computeDurationFit(60,'beginner')`; both `=1` for `'acquisition'`; unknown duration → `1`.
- `assessSubtitleQuality('manual', [♪-heavy], 'beginner')` not penalized; `'acquisition'` penalized (current).
- Route default (`tier` omitted) reproduces pre-change `score`/ordering.

**Commands:** `npm run test`; `npx tsc --noEmit`.

**Manual:**
1. Practice launcher at `chatLevel` 1 → media search returns short, supported clips even at low comprehension (feed not empty).
2. `chatLevel` 5 → ranking identical to today (advanced acquisition window).

---
name: module-registry-lib
description: Per-file roles for the lib/ layer — media, gemini, grammar, jlpt, quiz, chat, words, science, balance, dict, plus csrf/sanitize. Part of the module registry (PL-2.2).
---

# Module Registry — lib/

Per-file source of truth (formerly `PROJECT_LOGIC.md` [PL-2.2], `lib/` slice). Sibling slices: [core/infra](module-registry-core.md), [app & UI](module-registry-app.md). Directory tree: [directory-layout](directory-layout.md). Keep in sync on file add/remove/rename.

| File | Role |
|---|---|
| `lib/csrf.ts` | CSRF protection helpers: same-origin `Origin` and `Referer` verification for mutating Anki routes |
| `lib/sanitize.ts` | `sanitizeHtml(html)` — DOMPurify wrapper for safe `dangerouslySetInnerHTML` injection |
| `lib/dict/jitendex.ts` | `lookupWord(word)` — offline SQLite JitenDex dictionary lookup |
| `lib/dict/lookup.py` | Python script invoked via Node `execFile` to query SQLite dictionary database |
| `lib/gemini/client.ts` | `GeminiClient.generateSessions(words)`, `generateEtymology(word)` — singleton `geminiClient` |
| `lib/gemini/chat.ts` | `ChatService.sendMessage()`, `ChatService.generateHints()` — singleton `chatService` |
| `lib/gemini/prompts.ts` | Centralized prompt templates for Gemini AI character persona and difficulty levels |
| `lib/gemini/retry.ts` | Singleton wrapper implementing exponential backoffs and model fallback loops; network errors (undici `fetch failed`, ECONNREFUSED…) are retryable |
| `lib/gemini/errors.ts` | `classifyGeminiError(err)→{reason:'config'\|'transient'\|'unavailable', message(ru), retryable}`, `isNetworkError(err)`, `geminiErrorResponse(err)` — structured route error contract; raw `error.message` stays in the logger only |
| `lib/gemini/queryExpansion.ts` | Singleton query expansion service running a single gemini-2.5-flash-lite call with caching and error degradation |
| `lib/gemini/__tests__/errors.test.ts` | Unit tests for Gemini error classification |
| `lib/gemini/__tests__/queryExpansion.test.ts` | Unit tests for Gemini query expansion and cache fallback |
| `lib/gemini/__tests__/chat.test.ts` | Unit tests for ChatService schema parsing, prompts, and default properties |
| `lib/gemini/__tests__/scenarios.integration.test.ts` | Integration tests verifying multi-turn conversational scenarios against live Gemini API |
| `lib/media/youtube.ts` | Zero-dependency Japanese YouTube caption extractor; json3-first (`fmt=json3` → `parseJson3ToSegments`), XML fallback with Russian logs per path |
| `lib/media/parser.ts` | SRT/VTT subtitle file parser; `SubtitleSegment` interface (incl. optional `words[]`, `source`); `normalizeSegments` — sticky timing, gap-fill, overlap clamp, last-segment duration cap |
| `lib/media/json3.ts` | TypeScript json3 subtitle parser: `parseJson3ToSegments(data)` preserving per-word `offsetMs` from `segs[].tOffsetMs` |
| `lib/media/sentences.ts` | Pure `regroupIntoSentences(segments)` — merges consecutive segments until Japanese terminal punctuation (。？！) with 90-char / 15-second safety caps; rebases `words[]` offsetMs |
| `lib/media/availability.ts` | oEmbed/caption availability checker for YouTube videos |
| `lib/media/karaokeQuality.ts` | Pure function `assessKaraokeQuality(segment)` that evaluates if subtitle segments pass quality criteria for karaoke rendering |
| `lib/media/karaokeProgress.ts` | Pure function `computeFillFraction` for piecewise-linear progress interpolation, and `interpolatePlayerTime` for display clock estimation |
| `lib/media/search.ts` | Zero-dependency Japanese YouTube search page scraper and continuation tracker |
| `lib/media/ranking.ts` | Pure candidate ranking engine with per-tier profiles (`beginner`/`bridge`/`acquisition`); weights levelFit, subtitle quality, and `durationFit` per the user's level tier (default `acquisition` reproduces the legacy 0.6/0.4 levelFit/subQuality behaviour) |
| `lib/media/selection.ts` | Pure seeded selection helper maintaining profile shown history (overlap <= 10%) |
| `lib/media/cache.ts` | Persistent file-backed YouTube search and transcript cache |
| `lib/media/captionDisplay.ts` | Display-time pure helpers `stripCaptionAnnotations(text)` / `stripAnnotationWords(words)` — strip bracketed sound tags (`[音楽]`, `【…】`) from subtitle display copies without mutating stored segments (Prime Directive); keeps `♪` and `（）` |
| `lib/media/__tests__/captionDisplay.test.ts` | Unit tests for caption annotation stripping and karaoke word-sync |
| `lib/media/__tests__/availability.test.ts` | Unit tests for media availability helpers |
| `lib/media/__tests__/json3.test.ts` | Unit tests for json3 subtitle parser |
| `lib/media/__tests__/sentences.test.ts` | Unit tests for sentence regrouping logic |
| `lib/media/__tests__/karaokeQuality.test.ts` | Unit tests for karaoke quality gate module |
| `lib/media/__tests__/karaokeProgress.test.ts` | Unit tests for karaoke progress interpolation module |
| `lib/media/__tests__/search.test.ts` | Unit tests for search result scraper and parser |
| `lib/media/__tests__/ranking.test.ts` | Unit tests for candidate scoring and ranking rules |
| `lib/media/__tests__/selection.test.ts` | Unit tests for seeded PRNG selection and history diversity |
| `lib/media/__tests__/cache.test.ts` | Unit tests for YouTube file-backed cache |
| `lib/media/__tests__/search-live.integration.test.ts` | Integration tests verifying search and caption check against live YouTube API |
| `lib/media/__tests__/feed.integration.test.ts` | Integration tests verifying oEmbed embedding and caption tracks in media feed |
| `lib/media/__tests__/feed-language.integration.test.ts` | Integration tests verifying that every video in the recommended feed has a valid Japanese caption track |
| `lib/media/__tests__/transcript-fidelity.integration.test.ts` | Integration tests verifying that pregenerated transcripts match live scraped YouTube captions with high fidelity |
| `lib/grammar/graph.ts` | Pure, side-effect-free graph operations (validation, unlocks, edges generation) for grammar DAG |
| `lib/grammar/promptScope.ts` | Calculates allowed grammar scope, chooses focus nodes using Leitner intervals, validates responses, and generates prompt instructions |
| `lib/grammar/__tests__/graph.test.ts` | Unit tests for grammar DAG graph validation, unlock calculations, and backward compatibility |
| `lib/grammar/__tests__/promptScope.test.ts` | Unit tests for grammar prompt scoping, whitelist verification, focus prioritizing, and fallback scenarios |
| `lib/jlpt/levels.ts` | `getJlptLevel(word, reading)` — level detection, `toJlptTag` tag format helper, and idempotent `mergeJlptTag` utility |
| `lib/jlpt/__tests__/levels.test.ts` | Unit tests for JLPT levels detection and tagging logic |
| `lib/quiz/compare.ts` | Typo-forgiving answer comparison; also accepts romaji input (`romajiToHiragana`) so quiz/warm-up work without a Japanese keyboard |
| `lib/quiz/__tests__/compare.test.ts` | Unit tests for answer comparison utility |
| `lib/quiz/romaji.ts` | Pure `romajiToHiragana(input)` converter (digraphs, っ, ん, passes kana/kanji through) |
| `lib/quiz/__tests__/romaji.test.ts` | Unit tests for the romaji→hiragana converter |
| `lib/chat/furigana.ts` | Client-side gradual furigana processor based on FSRS intervals |
| `lib/chat/__tests__/furigana.test.ts` | Unit tests for gradual furigana processor |
| `lib/chat/fluency.ts` | Pure timed scenario replay (Timed Scenario Replay, Phase 8) calculations and helper functions |
| `lib/chat/__tests__/fluency.test.ts` | Unit tests for fluency mode module |
| `lib/words/priority.ts` | JLPT rank priority sorting and non-interfering batch selection logic |
| `lib/words/__tests__/priority.test.ts` | Unit tests for priority sorting and non-interfering batch selection |
| `lib/words/similarity.ts` | Kanji sharing similarity checker and mature word distractors generator |
| `lib/words/__tests__/similarity.test.ts` | Unit tests for kanji sharing and discrimination distractors |
| `lib/science/tips.ts` | Pure module for retrieving scientific tips and citations from the registry |
| `lib/science/__tests__/tips.test.ts` | Unit tests for getTip and TIP_IDS |
| `lib/balance/balance.ts` | Pure module for structure-vs-immersion activity share calculation and recommendations |
| `lib/balance/__tests__/balance.test.ts` | Unit tests for recommended share, actual share, and hint generation |

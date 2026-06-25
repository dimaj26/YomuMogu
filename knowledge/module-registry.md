---
name: module-registry
description: Authoritative per-file role registry. Adding/removing/renaming a source file requires updating this table.
---

# Module Registry

Source of truth for what each file does (formerly `PROJECT_LOGIC.md` [PL-2.2]). The directory tree lives in [architecture](architecture.md). Keep this table in sync when files are added, removed, or renamed.

| File | Role |
|---|---|
| `core/db.ts` | Dexie.js client-side database definitions, schemas, and FSRS transaction helpers |
| `core/scheduler.ts` | FSRS mathematical calculation engine over a single `active` curve (dual-curve collapsed) |
| `core/localDeckService.ts` | Offline local starter deck service and local db operations; `addWord` is the single entry point for tap-to-add (dedup by word+reading, idempotent, collision-safe id, optional `contextSentence` → `contextExamples`) |
| `core/types.ts` | Central TypeScript interface definitions for db schemas, reviews, and FSRS states |
| `core/pluginRegistry.ts` | Interfaces for custom learning plugins and active `WordSource` providers |
| `core/intervals.ts` | Single source of truth registry for all timing and interval systems |
| `core/__tests__/intervals.test.ts` | Unit tests for intervals registry |
| `core/__tests__/localDeckService.test.ts` | Unit tests for localDeckService |
| `core/__tests__/db.test.ts` | Unit tests for Dexie.js database functions |
| `core/__tests__/scheduler.test.ts` | Unit tests for FSRS scheduler calculations |
| `plugins/anki/index.ts` | Entry point for the Anki integration plugin registering itself to the core |
| `plugins/anki/client.ts` | `AnkiConnectClient` wrapper class querying local Anki desktop HTTP API |
| `plugins/anki/filter.ts` | Functional filters classifying card statuses from raw Anki queue parameters |
| `plugins/anki/wordSource.ts` | Implements `WordSource` utilizing Anki client for deck querying and sync |
| `plugins/anki/__tests__/client.test.ts` | Unit tests for AnkiConnectClient |
| `plugins/anki/__tests__/filter.test.ts` | Unit tests for Anki card status filter |
| `plugins/anki/__tests__/sync.integration.test.ts` | Integration tests for bilateral Anki sync (requires local Anki Desktop) |
| `extension/manifest.json` | Browser extension manifest configuration |
| `extension/background.js` | Extension background worker intercepting YouTube subtitles requests; tags relayed segments with `source: 'extension'` |
| `extension/content.js` | Extension content script relaying messages to YomuMogu page |
| `extension/convert.js` | Modular JSON3 subtitle format converter preserving per-word `offsetMs` from `tOffsetMs` |
| `__tests__/extension-convert.test.ts` | Unit tests for Chrome extension subtitle converter |
| `hooks/useApiCall.ts` | Custom React hook consolidating client-side loading, error state, and retry logic |
| `hooks/__tests__/useApiCall.test.ts` | Unit tests for useApiCall hook |
| `lib/csrf.ts` | CSRF protection helpers: same-origin `Origin` and `Referer` verification for mutating Anki routes |
| `lib/sanitize.ts` | `sanitizeHtml(html)` — DOMPurify wrapper for safe `dangerouslySetInnerHTML` injection |
| `components/ErrorBoundary.tsx` | Global class-based React error boundary catching rendering exceptions |
| `components/ErrorFallback.tsx` | UI fallback component rendered by ErrorBoundary on crash |
| `app/error.tsx` | Next.js App Router global error boundary page |
| `app/api/anki/sync/__tests__/sync.test.ts` | Unit tests for `/api/anki/sync` route |
| `app/api/anki/add/__tests__/add.test.ts` | Unit tests for `/api/anki/add` route |
| `app/api/chat/analyze/__tests__/analyze.test.ts` | Unit tests for `/api/chat/analyze` route |
| `app/api/chat/hint/__tests__/hint.test.ts` | Unit tests for `/api/chat/hint` route |
| `app/api/dict/lookup/route.ts` | GET endpoint for offline dictionary lookup |
| `app/api/gemini/etymology/route.ts` | POST endpoint to generate word etymologies and mnemonic hints |
| `app/api/gemini/classify/route.ts` | POST endpoint to classify words by situational tags using Gemini |
| `app/api/gemini/__tests__/etymology.test.ts` | Unit test for etymology route using mocked Gemini client |
| `app/api/gemini/__tests__/classify.test.ts` | Unit test for classify route using mocked Gemini client |
| `app/api/media/parse/route.ts` | POST endpoint parsing YouTube subtitles/metadata or SRT/VTT file transcripts |
| `app/api/media/parse/__tests__/parse.test.ts` | Unit tests for parse media endpoint |
| `app/api/media/parse/__tests__/parse.integration.test.ts` | Integration tests for parse media endpoint against running MeCab |
| `app/api/media/tokenize/route.ts` | POST endpoint proxying tokenization to local MeCab microservice |
| `app/api/media/tokenize/__tests__/tokenize.test.ts` | Unit tests for tokenize endpoint |
| `app/api/media/tokenize/__tests__/tokenize.integration.test.ts` | Integration tests for tokenize media endpoint against running MeCab |
| `app/api/media/search/route.ts` | POST endpoint to orchestrate query expansion, YouTube scraping, subtitle quality check, CR-ranking, and page diversity selection |
| `app/api/media/search/__tests__/route.test.ts` | Unit tests for search API route funnel orchestration |
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
| `lib/gemini/queryExpansion.ts` | Singleton query expansion service running a single gemini-2.5-flash-lite call with caching and error degradation |
| `lib/media/__tests__/availability.test.ts` | Unit tests for media availability helpers |
| `lib/media/__tests__/json3.test.ts` | Unit tests for json3 subtitle parser |
| `lib/media/__tests__/sentences.test.ts` | Unit tests for sentence regrouping logic |
| `lib/media/__tests__/karaokeQuality.test.ts` | Unit tests for karaoke quality gate module |
| `lib/media/__tests__/karaokeProgress.test.ts` | Unit tests for karaoke progress interpolation module |
| `lib/media/__tests__/search.test.ts` | Unit tests for search result scraper and parser |
| `lib/media/__tests__/ranking.test.ts` | Unit tests for candidate scoring and ranking rules |
| `lib/media/__tests__/selection.test.ts` | Unit tests for seeded PRNG selection and history diversity |
| `lib/media/__tests__/cache.test.ts` | Unit tests for YouTube file-backed cache |
| `lib/gemini/__tests__/queryExpansion.test.ts` | Unit tests for Gemini query expansion and cache fallback |
| `lib/media/__tests__/search-live.integration.test.ts` | Integration tests verifying search and caption check against live YouTube API |
| `lib/media/__tests__/feed.integration.test.ts` | Integration tests verifying oEmbed embedding and caption tracks in media feed |
| `lib/media/__tests__/feed-language.integration.test.ts` | Integration tests verifying that every video in the recommended feed has a valid Japanese caption track |
| `lib/media/__tests__/transcript-fidelity.integration.test.ts` | Integration tests verifying that pregenerated transcripts match live scraped YouTube captions with high fidelity |
| `tests/e2e/media-search-live.spec.ts` | Playwright E2E tests verifying search input, refresh diversity, and player loading |
| `components/MediaInteractivePlayer.tsx` | Subtitle-synchronized player component: sticky segment matching, quality-gated smooth progress fill karaoke rendering, requestAnimationFrame display clock resynchronization, sentence regrouping pipeline, CC dedup (`cc_load_policy` conditional, extension priority guard, CC toggle button); tap-to-add (B2.1) sends the active subtitle line as live context and branches local (`addWord` → IndexedDB FSRS, no Anki/Gemini) vs Anki (`/api/anki/add` + `syncLocalDatabaseWithAnki`), with a soft daily-limit notice |
| `components/__tests__/MediaInteractivePlayer.test.tsx` | Unit tests for MediaInteractivePlayer component |
| `hooks/useMediaRecommendation.ts` | Hook calculating Comprehension Rate (CR) and FSRS-due vocabulary matches for videos |
| `hooks/__tests__/useMediaRecommendation.test.ts` | Unit tests for useMediaRecommendation hook |
| `resources/media_feed.json` | Static metadata list of recommended video channels/audio podcast feeds |
| `resources/media_transcripts.json` | Pre-generated timed dialogues/monologues JSON transcripts for recommended YouTube videos |
| `core/__tests__/tagger.test.ts` | Unit tests for tagger, FSRS routing, and session grouping helpers |
| `components/PhonosemanticHint.tsx` | Accordion component displaying phonosemantic keys and relative kanji |
| `components/DebugDrawer.tsx` | Client component implementing the sliding debug drawer HUD |
| `components/AssessmentModal.tsx` | Reusable knowledge-diagnostics modal (load starter deck, mark known words, `importStarterDeck`); props `isOpen/profileId/onClose/onSaved/onError`; used on `/settings` and `/` (dashboard onboarding) |
| `components/AssessmentModal.module.css` | Styles for the AssessmentModal (extracted from settings) |
| `components/__tests__/AssessmentModal.test.tsx` | Unit tests for AssessmentModal render/save/onSaved |
| `resources/phonosemantics.json` | 50 phonosemantic keys and relative kanji data |
| `resources/situational_dictionary.json` | Static situational tags mapping for 500 N5 words |
| `app/practice/quiz/page.tsx` | Gamified Active Recall quiz component supporting ad-hoc, FSRS modes, mnemonics, and phonosemantic hints |
| `lib/dict/jitendex.ts` | `lookupWord(word)` — offline SQLite JitenDex dictionary lookup |
| `lib/dict/lookup.py` | Python script invoked via Node `execFile` to query SQLite dictionary database |
| `lib/gemini/client.ts` | `GeminiClient.generateSessions(words)`, `generateEtymology(word)` — singleton `geminiClient` |
| `lib/gemini/chat.ts` | `ChatService.sendMessage()`, `ChatService.generateHints()` — singleton `chatService` |
| `lib/gemini/prompts.ts` | Centralized prompt templates for Gemini AI character persona and difficulty levels |
| `lib/gemini/retry.ts` | Singleton wrapper implementing exponential backoffs and model fallback loops; network errors (undici `fetch failed`, ECONNREFUSED…) are retryable |
| `lib/gemini/errors.ts` | `classifyGeminiError(err)→{reason:'config'\|'transient'\|'unavailable', message(ru), retryable}`, `isNetworkError(err)`, `geminiErrorResponse(err)` — structured route error contract; raw `error.message` stays in the logger only |
| `lib/gemini/__tests__/errors.test.ts` | Unit tests for Gemini error classification |
| `components/ServiceUnavailable.tsx` | Reusable "service unavailable" block (human message + optional "what still works" hint + optional Retry shown only when `retryable && onRetry`) |
| `components/ServiceUnavailable.module.css` | Styles for ServiceUnavailable |
| `components/__tests__/ServiceUnavailable.test.tsx` | Unit tests for ServiceUnavailable |
| `lib/grammar/graph.ts` | Pure, side-effect-free graph operations (validation, unlocks, edges generation) for grammar DAG |
| `lib/grammar/promptScope.ts` | Calculates allowed grammar scope, chooses focus nodes using Leitner intervals, validates responses, and generates prompt instructions |
| `lib/grammar/__tests__/graph.test.ts` | Unit tests for grammar DAG graph validation, unlock calculations, and backward compatibility |
| `lib/grammar/__tests__/promptScope.test.ts` | Unit tests for grammar prompt scoping, whitelist verification, focus prioritizing, and fallback scenarios |
| `lib/gemini/__tests__/chat.test.ts` | Unit tests for ChatService schema parsing, prompts, and default properties |
| `lib/gemini/__tests__/scenarios.integration.test.ts` | Integration tests verifying multi-turn conversational scenarios against live Gemini API |
| `scratch/SCRATCH_LOG.md` | Permanent historical audit registry tracking sandbox scripts and side effects |
| `hooks/useQuests.ts` | React custom hook managing namespaced daily quest progression and XP rewards |
| `components/JpUIProvider.tsx` | UI-FSRS provider; `upgradeWord` gated by `CONTENT_JP_MIN_LEVEL` (content stays Russian until immersion level ≥ 2); chrome elements never upgrade |
| `components/__tests__/LanguageSwitcher.test.tsx` | Unit test for LanguageSwitcher mode descriptions |
| `components/LearningTrack.tsx` | N5→N1 macro JLPT competency ladder — shows lexCoverage and grammarCoverage progress bars per level; receives `MacroLadderProfile` prop |
| `components/__tests__/LearningTrack.test.tsx` | Unit tests for macro ladder node states, coverage bars, and popover content |
| `components/GrammarTrack.tsx` | Winding SVG path component for grammar rules curriculum showing forks and connections dynamically generated from prerequisite DAG |
| `components/GrammarTrainer.tsx` | Interactive overlays explaining grammar theory and prompting user custom sentences checked by AI |
| `components/__tests__/GrammarTrainer.test.tsx` | Unit tests verifying GrammarTrainer component rendering and interactive sandbox |
| `src/resources/grammar_rules.json` | Grammar curriculum JSON with coordinates, aligned with prerequisite DAG |
| `app/api/gemini/grammar-verify/route.ts` | POST endpoint using Gemini client to verify user Japanese sentences against grammar rules |
| `app/api/gemini/__tests__/grammar-verify.test.ts` | Unit tests verifying the grammar verification API route behavior under standard inputs |
| `app/api/anki/sync-db/route.ts` | POST endpoint for bilateral FSRS sync between IndexedDB and Anki; handles deduplication, bulk queries, FSRS approximation |
| `app/api/anki/sync-db/__tests__/sync-db.test.ts` | Unit tests for sync-db route |
| `app/api/anki/setup-deck/route.ts` | POST endpoint to create a YomuMogu deck and note model in Anki if absent |
| `app/api/anki/setup-deck/__tests__/setup-deck.test.ts` | Unit tests for setup-deck route |
| `app/api/words/route.ts` | GET endpoint resolving words via active `WordSource` plugin or local IndexedDB fallback |
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
| `resources/jlpt_levels.json` | Generated versioned JLPT levels resource containing N5 and N4 vocabulary lists |
| `resources/science_tips.json` | Versioned static registry of pedagogy research and citations (science tips) |
| `lib/science/tips.ts` | Pure module for retrieving scientific tips and citations from the registry |
| `lib/science/__tests__/tips.test.ts` | Unit tests for getTip and TIP_IDS |
| `lib/balance/balance.ts` | Pure module for structure-vs-immersion activity share calculation and recommendations |
| `lib/balance/__tests__/balance.test.ts` | Unit tests for recommended share, actual share, and hint generation |
| `components/ScienceTip.tsx` | Informational tooltip icon component showing scientific rationale for features |
| `components/ScienceTip.module.css` | CSS module for ScienceTip tooltip and popover alignment |
| `components/__tests__/ScienceTip.test.tsx` | Unit tests for ScienceTip open/close behavior and missing fallback checks |
| `components/BalanceWidget.tsx` | Sidebar widget showing target vs actual structure-immersion balance with spacing advice |
| `components/BalanceWidget.module.css` | CSS module for recommended and actual balance bar visual progress indicators |
| `components/__tests__/BalanceWidget.test.tsx` | Unit tests for BalanceWidget rendering under empty and complete activity logs |
| `services/tokenizer/server.py` | FastAPI MeCab microservice providing morphological analysis on port 8000; `GET /health` returns `{status:'ok'\|'error'}` |
| `services/tokenizer/Dockerfile` | Docker container definition for the MeCab tokenizer service |
| `scripts/generate-transcripts.mjs` | Node script to scrape real `ja` captions for all feed videos and output `media_transcripts.json` |
| `tests/e2e/media-live.spec.ts` | Playwright E2E tests verifying real Japanese subtitle player interaction, karaoke highlighting, and dictionary lookup |
| `tests/e2e/media-tokenizer-down.spec.ts` | Playwright E2E tests verifying player degradation, warning banner, and disabled highlights when tokenizer is offline |

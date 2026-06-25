---
name: features
description: One-line registry of implemented features. Each feature gets exactly one line; implementation detail lives in the architecture/domain topic files.
---

# Implemented Features

Formerly `CONTEXT_PROMPT.md` [CP-2.2]. One line per feature — implementation details live in the domain topic files ([architecture](architecture.md), [gemini-patterns](gemini-patterns.md), [anki-integration](anki-integration.md), etc.). Prose descriptions of headline features also live in [README.md](../README.md). Shipped history is in [CHANGELOG.md](../CHANGELOG.md).

- **Anki Integration**: AnkiConnect proxy, deck/card import, status filtering (new/learning/review/mature).
- **Session Generation**: Gemini structured JSON, 3 scenarios × 4–6 target words, prioritized by FSRS status.
- **Chat System**: Multi-turn Gemini dialogue, 20-msg history window, persona enforcement, grammar analysis, XP.
- **Difficulty Levels 1–5**: Japanese complexity + furigana rendering control; levels 1–2 exclude Keigo.
- **Hint System**: `/api/chat/hint` generates scaffolding hints (keywords + pattern skeletons) for 3 difficulty levels, preventing copy-pasting.
- **XP & Progression**: Decorative levels 0–6 dashboard widget; XP from correct words, grammar, session completion.
- **Profile System**: Multi-profile localStorage namespace `yomumogu_profile_${id}_${key}`; create/switch/delete.
- **Gamified Dashboard**: Mascot 🍵, 3D buttons, Kumiko grid background, XP card widget, session resume/start.
- **Adaptive Daily Hub**: dashboard reads local-deck signals and shows one state-based CTA (first-run diagnostics / resume chat / returning «N к повторению» / newbie warm-up / all-done neutral / Anki generic); marketing H1 only on first run; onboarding diagnostics open in a modal on `/` via reusable `AssessmentModal`.
- **Practice Launcher (`/practice`)**: Session management, new-words/review split, daily limits, FSRS stats display.
- **Chat Persistence**: Auto-serialize chat state to localStorage; resume/reset buttons on dashboard.
- **Session Safeguard**: Corrupted state detection + fallback UI in `/chat`.
- **Chat Exit Flow**: Orange Завершить button, confirmation modal, routes to Bonus Test on confirm.
- **Gemini Retry**: `withRetry()` + exponential backoff + model fallback chain (flash→pro→flash-lite).
- **Logging**: Structured logger (debug/info/warn/error) → `logs/`.
- **Testing**: Vitest unit (mocked) + integration configs for Anki/Gemini/MeCab; journey golden-path tests (mocked, default suite); Playwright e2e.
- **Session Audit**: Bonus Test, Gemini vocab extraction, JitenDex lookup, Anki sync (manual FSRS grading, AI note creation with TTS/images).
- **Bilateral Sync**: IndexedDB (Dexie.js) ↔ Anki via `/api/anki/sync-db`; review deduplication, FSRS approximation, 4AM boundary, dual-state (passive/active).
- **Context Examples**: Correct user sentences saved as `contextExamples` in IndexedDB per word.
- **Offline Mode**: 500-word starter deck + fullscreen diagnostic assessment grid; FSRS scheduling without Anki.
- **Per-Deck Mappings**: Per-Anki-deck front/back/audio/image field config stored in localStorage.
- **CSRF Protection**: Same-origin Origin/Referer checks on all mutating Anki routes.
- **Error Handling**: Global `ErrorBoundary` + `useApiCall` hook (loading/error/retry).
- **Unified Unavailable Pattern**: `lib/gemini/errors.ts` classifies failures (config/transient/unavailable) into a `{error,reason,retryable}` route contract (raw exception stays in logs); reusable `ServiceUnavailable` UI with conditional Retry; wired into chat-theme generation and grammar verification; network errors are now retryable in `withRetry`.
- **A11y**: `LanguageSwitcher` fully keyboard-navigable (Arrows, Escape, Space, Enter).
- **Active Recall Quiz (`/practice/quiz`)**: Cloze/translation, dual hints (kana + JitenDex), FSRS grading bar, typo forgiveness, furigana.
- **Warm-up Trainer**: 3-step in-place priming (Sight+Sound, Kana, Translation) for ≤10 new words; no FSRS writes.
- **Phonosemantic Hints**: Accordion showing phonetic key + related kanji; in Quiz and Warm-up.
- **Mnemonics & AI Etymology**: User notes in IndexedDB + Gemini radical breakdown auto-fill button.
- **FSRS `new` Exclusion**: `new` status words excluded from due count.
- **Debug HUD**: Dev-only side drawer with FSRS trajectories, prompt inspector, DB reset utilities.
- **Chat Mascot**: SVG 🍵 with animations reacting to target words, grammar corrections, correct input.
- **Kumiko Heatmap**: 50-cell SVG dashboard grid coloring 500 words by FSRS stability + due pulse.
- **Gradual Furigana (JpUI)**: `<ruby>` opacity by FSRS interval (<3d:1.0, <21d:0.6, ≥21d:0→hover); no CLS. `kind='chrome'` keeps service UI (navigation) Russian in `smart` mode (never auto-japanized/registered); content elements only start japanizing once immersion level ≥ `CONTENT_JP_MIN_LEVEL` (2). `LanguageSwitcher` modes carry short descriptions (Smart notes gradual japanization + reset in Settings).
- **Learning Track**: Duolingo winding roadmap (5 nodes) with lock/active/complete state transitions.
- **Daily Quests**: Sidebar widget tracking Reviews/Chats/Mnemonics; 4AM reset without claimable XP rewards. Progressive disclosure — quests are hidden behind a soft hint for a brand-new local user (only `new`-status words) until they have study context.
- **Grammar Trainer**: 7-step N5 curriculum roadmap (Morphology-Before-Syntax), interactive Sandbox modal, Leitner scheduling, Gemini sentence verification.
- **Situational Tags**: 10 themes + universal; static dict for N5, Gemini classifier for Anki imports.
- **Adaptive Routing**: active.stability < 3d or lapses ≥ 2 → chat (with hard-priority & 5–8 word target sets); else → offline quiz. Chat practice gated at ≥5 active words.
- **Contextual Distractors**: Warm-up multiple-choice uses same-theme words as distractors.
- **Media Player**: YouTube/subtitle player, MeCab tokenizer status dot, real caption scraper script, live E2E/integration tests; quality-gated interpolated progress fill, sentence regrouping, conditional `cc_load_policy` + Chrome extension override; runs Next.js + MeCab tokenizer.
- **Video Search**: Russian query expansion via Gemini (1 cached flash-lite call), zero-dependency YouTube scraping (query + continuation), caption check gate, local match + MeCab tokenize + CR/subQuality scoring & level-aware tier ranking (beginner/bridge/acquisition with durationFit), and PRNG-seeded history-aware selection (overlap <= 10%).
- **Chrome Extension**: Manifest V3 subtitle interceptor relaying YouTube captions (tagged `source:'extension'`, adopted only when server has no segments) to YomuMogu via `postMessage`.
- **JLPT Levels & N5 Completion**: Generated N5 and N4 levels mapping, pure matching/tagging module, idempotent sync/import merges, dev HUD bulk retag utility, and fully authored N5 grammar rule content (V-ta, tari, nagara).
- **JLPT N3–N1 References & Derived Chat Scoping**: Generated N3, N2, and N1 level vocabulary database (v2) with duplicate and overlap cleans. Restricted AI chat grammar to the user's progress (mature/active rules + formulaic whitelist), selecting the active due rule as focus, validating response tags on the server, and logging violations.
- **Competency Engine & JLPT Macro Ladder**: Pure competency helpers (`lexCoverage`, `grammarCoverage`, `buildCompetencyProfile`), N5→N1 winding SVG path `LearningTrack` component with progress rings, rolling chat session statistics (cap 10) in localStorage, and Chat Summary advisor suggesting level adjustments based on vocabulary/grammar thresholds.
- **Honest Chat Feedback**: short metalinguistic Russian note for grammar errors and collapsed correction drawer (self-repair).
- **Honest Quizzes**: typed reading warm-up with typo-forgiveness (`[TYPE-ANSWER]`) and FSRS interval-based gradual fading furigana in chat (`[WORD-FURIGANA]`).
- **Romaji Input**: quiz/warm-up accept romaji (no Japanese keyboard needed) via pure `lib/quiz/romaji.ts` converter, surfaced through `isAnswerAcceptable`; a non-destructive kana preview shows under the field as you type.
- **Fluency Mode**: timed scenario replay (Phase 8) with a per-turn horizontal countdown bar, tightening limits across rounds 1–3, timer starting on sensei reply end, and mature-only grammar scope filters.
- **Intervals Registry & Soft Closing**: centralized single source of truth timings, soft closing turn on scenario completion without questions, fluency timer auto-stop, and passive turn duration metrics.
- **Word Queue Science**: frequency priority intake, kanji interference guard batching, and visual-similarity distractors for mature words.
- **N4 Grammar Curriculum**: Added 6 N4 rules, N5/N4 switcher in practice Grammar track, filtered SVG levels rendering, and level-agnostic chat empty state.
- **Transparency Showcase & Practice Balance**: Versioned static registry of pedagogy research and citations (`science_tips.json`), interactive ScienceTip information icons, and structure-vs-immersion practice balance widget tracking rolling activity logs.

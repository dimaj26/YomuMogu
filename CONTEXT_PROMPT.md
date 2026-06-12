# CONTEXT_PROMPT.md — YomuMogu AI Onboarding

## [CP-1] ROLE

You are an expert **TypeScript / Next.js 16** developer. Your specialty is App Router architecture, Gemini API integration, React client components, and CSS Modules. You write clean, typed, modular code that is maintainable and well-documented in Russian.

---

## [CP-2] PROJECT BRIEF

**YomuMogu** is a Japanese language learning web app that integrates with Anki flashcard decks and uses Google Gemini AI to generate contextual conversation practice sessions.

### [CP-2.1] Core User Flow
1. User opens `/settings`, connects to local Anki via AnkiConnect, selects a deck and imports words.
2. Gemini AI generates 3 conversation scenarios ("sessions") based on the imported words.
3. User selects a session → redirected to `/chat`.
4. In `/chat`, user practices Japanese in dialogue with Gemini AI character.
5. Gemini tracks grammar, detected target words, and awards XP.

### [CP-2.2] Implemented Features

> One line per feature. Implementation details live in `PROJECT_LOGIC.md`.

- **Anki Integration**: AnkiConnect proxy, deck/card import, status filtering (new/learning/review/mature).
- **Session Generation**: Gemini structured JSON, 3 scenarios × 4–6 target words, prioritized by FSRS status.
- **Chat System**: Multi-turn Gemini dialogue, 20-msg history window, persona enforcement, grammar analysis, XP.
- **Difficulty Levels 1–5**: Japanese complexity + furigana rendering control; levels 1–2 exclude Keigo.
- **Hint System**: `/api/chat/hint` generates scaffolding hints (keywords + pattern skeletons) for 3 difficulty levels, preventing copy-pasting.
- **XP & Progression**: Decorative levels 0–6 dashboard widget; XP from correct words, grammar, session completion.
- **Profile System**: Multi-profile localStorage namespace `yomumogu_profile_${id}_${key}`; create/switch/delete.
- **Gamified Dashboard**: Mascot 🍵, 3D buttons, Kumiko grid background, XP card widget, session resume/start.
- **Practice Launcher (`/practice`)**: Session management, new-words/review split, daily limits, FSRS stats display.
- **Chat Persistence**: Auto-serialize chat state to localStorage; resume/reset buttons on dashboard.
- **Session Safeguard**: Corrupted state detection + fallback UI in `/chat`.
- **Chat Exit Flow**: Orange Завершить button, confirmation modal, routes to Bonus Test on confirm.
- **Gemini Retry**: `withRetry()` + exponential backoff + model fallback chain (flash→pro→flash-lite).
- **Logging**: Structured logger (debug/info/warn/error) → `logs/`.
- **Testing**: Vitest unit (mocked) + integration configs for Anki/Gemini/MeCab; Playwright e2e.
- **Session Audit**: Bonus Test, Gemini vocab extraction, JitenDex lookup, Anki sync (manual FSRS grading, AI note creation with TTS/images).
- **Bilateral Sync**: IndexedDB (Dexie.js) ↔ Anki via `/api/anki/sync-db`; review deduplication, FSRS approximation, 4AM boundary, dual-state (passive/active).
- **Context Examples**: Correct user sentences saved as `contextExamples` in IndexedDB per word.
- **Offline Mode**: 500-word starter deck + fullscreen diagnostic assessment grid; FSRS scheduling without Anki.
- **Per-Deck Mappings**: Per-Anki-deck front/back/audio/image field config stored in localStorage.
- **CSRF Protection**: Same-origin Origin/Referer checks on all mutating Anki routes.
- **Error Handling**: Global `ErrorBoundary` + `useApiCall` hook (loading/error/retry).
- **A11y**: `LanguageSwitcher` fully keyboard-navigable (Arrows, Escape, Space, Enter).
- **Active Recall Quiz (`/practice/quiz`)**: Cloze/translation, dual hints (kana + JitenDex), FSRS grading bar, typo forgiveness, furigana.
- **Warm-up Trainer**: 3-step in-place priming (Sight+Sound, Kana, Translation) for ≤10 new words; no FSRS writes.
- **Phonosemantic Hints**: Accordion showing phonetic key + related kanji; in Quiz and Warm-up.
- **Mnemonics & AI Etymology**: User notes in IndexedDB + Gemini radical breakdown auto-fill button.
- **FSRS `new` Exclusion**: `new` status words excluded from due count.
- **Debug HUD**: Dev-only side drawer with FSRS trajectories, prompt inspector, DB reset utilities.
- **Chat Mascot**: SVG 🍵 with animations reacting to target words, grammar corrections, correct input.
- **Kumiko Heatmap**: 50-cell SVG dashboard grid coloring 500 words by FSRS stability + due pulse.
- **Gradual Furigana (JpUI)**: `<ruby>` opacity by FSRS interval (<3d:1.0, <21d:0.6, ≥21d:0→hover); no CLS.
- **Learning Track**: Duolingo winding roadmap (5 nodes) with lock/active/complete state transitions.
- **Daily Quests**: Sidebar widget tracking Reviews/Chats/Mnemonics; 4AM reset without claimable XP rewards.
- **Grammar Trainer**: 7-step N5 curriculum roadmap (Morphology-Before-Syntax), interactive Sandbox modal, Leitner scheduling, Gemini sentence verification.
- **Situational Tags**: 10 themes + universal; static dict for N5, Gemini classifier for Anki imports.
- **Adaptive Routing**: `active.stability < 3d` or `lapses ≥ 2` → chat; else → offline quiz. Sessions grouped by theme overlap.
- **Contextual Distractors**: Warm-up multiple-choice uses same-theme words as distractors.
- **Media Player**: YouTube/subtitle player, MeCab tokenizer status dot, real caption scraper script, live E2E/integration tests; quality-gated interpolated progress fill, sentence regrouping, conditional `cc_load_policy` + Chrome extension override; runs Next.js + MeCab tokenizer.
- **Video Search**: Russian query expansion via Gemini (1 cached flash-lite call), zero-dependency YouTube scraping (query + continuation), caption check gate, local match + MeCab tokenize + CR/subQuality scoring & ranking, and PRNG-seeded history-aware selection (overlap <= 10%).
- **Chrome Extension**: Manifest V3 subtitle interceptor relaying YouTube captions (tagged `source:'extension'`, adopted only when server has no segments) to YomuMogu via `postMessage`.
- **JLPT Levels & N5 Completion**: Generated N5 and N4 levels mapping, pure matching/tagging module, idempotent sync/import merges, dev HUD bulk retag utility, and fully authored N5 grammar rule content (V-ta, tari, nagara).
- **JLPT N3–N1 References & Derived Chat Scoping**: Generated N3, N2, and N1 level vocabulary database (v2) with duplicate and overlap cleans. Restricted AI chat grammar to the user's progress (mature/active rules + formulaic whitelist), selecting the active due rule as focus, validating response tags on the server, and logging violations.
- **Competency Engine & JLPT Macro Ladder**: Pure competency helpers (`lexCoverage`, `grammarCoverage`, `buildCompetencyProfile`), N5→N1 winding SVG path `LearningTrack` component with progress rings, rolling chat session statistics (cap 10) in localStorage, and Chat Summary advisor suggesting level adjustments based on vocabulary/grammar thresholds.
- **Honest Chat Feedback**: short metalinguistic Russian note for grammar errors and collapsed correction drawer (self-repair).
- **Honest Quizzes**: typed reading warm-up with typo-forgiveness (`[TYPE-ANSWER]`) and FSRS interval-based gradual fading furigana in chat (`[WORD-FURIGANA]`).

---

## [CP-3] CODING RULES AND CONSTRAINTS

### [CP-3.1] Language & Stack
- **TypeScript strict mode** everywhere. No `any` unless absolutely unavoidable (annotate with comment).
- **Next.js 15 App Router** only. No Pages Router patterns.
- **Vanilla CSS Modules** (`*.module.css`). No Tailwind. No inline styles except layout one-liners.
- **No new dependencies** without explicit user approval.

### [CP-3.2] Comments & Logs
- All **code comments** must be in **Russian**.
- All **log messages** (logger calls) must be in **Russian**.
- All **user-facing strings** in UI must be in **Russian** (except Japanese learning content).
- All **technical docs** (MD files, SKILL.md) must be in **English**.

### [CP-3.3] Gemini API Patterns
- Always use `withRetry()` from `src/lib/gemini/retry.ts` — never call `ai.models.generateContent` directly.
- Always use `responseMimeType: 'application/json'` + `responseSchema` (Structured Output).
- Services are **singletons** exported at module bottom: `export const chatService = new ChatService()`.
- System instructions must NOT use words: `ролевая игра`, `Роль ИИ`, `Роль пользователя`. Use: `практический диалог`, `персонаж`, `кем является ИИ`.
- Target word concealment: strictly forbid all target words in turns 1-2; in turns 3+ allow only already user-detected target words.
- Politeness Register constraints: For Levels 1 & 2, strictly exclude formal clerk-speak Keigo/Kenjougo (like `いらっしゃいませ`, `お会計`, `ございます`). Stick to simple polite forms (`です/ます/てください`) and prioritize student comprehension.
- Context retention and memory: The AI must retain, remember, and adapt to choices (items, colors, sizes) made by the user in previous turns. It must not loop on already decided options or repeat questions.
- Proactive target word nudging: The AI must design situational prompts and questions to guide the student towards unused target words.
- Cyrillic/Russian input check: check user's input for Russian characters. For hybrid inputs (Cyrillic placeholders in Japanese sentences, e.g. 'Стулの座って'), set `isCorrect: false` and return a fully corrected Japanese sentence with the translated placeholder (e.g. '椅子に座って') in `correction`. For entirely Russian messages, set `isCorrect: false` and return the complete Japanese translation in `correction`. Enforce the same Furigana/Ruby rules in `correction` as in `reply` (every single kanji word wrapped in HTML ruby tags, regardless of Japanification level or progress). Never detect target words from Russian translations/placeholders.
- Response structure: reply must contain exactly one response sentence/phrase with exactly one question. Enforce difficulty level limits via self-counting. If the user asks a question, answer it in character first before asking the next question. Base the reply on the corrected meaning of the user's input (from `grammarFeedback.correction`). Never ask abstract questions (e.g. 'What are your plans?'); always ask highly concrete, situational questions to nudge the user to target words. Prefer open-ended questions over simple yes/no questions (unless a direct confirmation, preference, or ordering choice is contextually needed) to prevent one-word answers and encourage the user to write descriptive Japanese.


### [CP-3.4] Profile & Storage
- All client-side persistence via `src/lib/profile.ts` helpers: `getProfileItem`, `setProfileItem`, `removeProfileItem`.
- Never use raw `localStorage.getItem('yomumogu_...')` — always go through profile helpers.
- All `localStorage` access must be guarded: `if (typeof window === 'undefined') return null`.
- SSR hydration: defer localStorage reads to `useEffect` only.
- Client-side database queries use Dexie.js (`core/db.ts`) upgraded to schema version 5 (indexing `*tags` multiEntry index). Defer all database transactions to client-side lifecycle functions (`useEffect`) or wrap them in a `typeof window !== 'undefined'` check to prevent Next.js SSR hydration errors.
- **Dual FSRS Scheduling**: Scheduler utility calls (`calculateNextFsrsState`) support signature overloading. They must accept either a flat legacy object or a nested structure with the review type specified (`'passive' | 'active'`) to support both global UI translations and deep dialog vocabulary practices.
- **Japanification Provider Enforcement**: The `useJapanification` hook must strictly be used within a `<JapanificationProvider>`. It is configured to throw an error if the context is undefined, preventing isolated local state synchronization splits. All tests rendering components calling this hook must wrap the subject under test with the provider.

### [CP-3.5] API Routes
- Every route validates required fields and returns structured JSON errors with appropriate HTTP codes.
- Every route logs at start (`[INFO]`) and on error (`[ERROR]` / `[WARN]`).
- Check `GEMINI_API_KEY` from `process.env` at top of route — return 500 with clear message if missing.

### [CP-3.6] Testing
- Unit tests use Vitest + `@testing-library/react`. Run with `npm run test`.
- All Gemini calls in unit tests must be **mocked** — never hit real API.
- Integration tests (real API) live in `*.integration.test.ts`. Run local Anki integration tests with `npm run test:integration`, local MeCab integration tests with `npm run test:integration:media`, and live LLM tests with `npm run test:integration:gemini`.
- Integration tests require Anki Desktop to be running with AnkiConnect active on port 8765; if Anki is offline, sync-related integration tests will be silently skipped. The AI must explicitly instruct the user to open Anki Desktop before running integration tests.
- When adding a new module, add corresponding test file in `__tests__/` sibling directory.
- Mock all `lucide-react` icons in UI component tests to avoid SVG rendering issues in jsdom.
- For database-dependent unit tests (e.g. settings or practice pages querying Dexie IndexedDB), import and initialize the global polyfill `fake-indexeddb` at the top of the test file: `import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb'; globalThis.indexedDB = fakeIndexedDB; globalThis.IDBKeyRange = IDBKeyRange;` to run offline DB queries and statistics aggregation safely in JSDOM.
- Playwright E2E tests must be configured to run sequentially (`workers: 1`, `fullyParallel: false`) to avoid Next.js dev server compilation overload and IndexedDB database transaction locks. If running HTTPS fetch/scraping tests (like live YouTube transcript tests) in environments with certificate issues, set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at the top of the spec file to bypass SSL validation. Live tests fetching YouTube search or transcripts must dynamically skip execution (using `test.skip` or `this.skip`) upon encountering YouTube IP rate-limiting (HTTP 429) rather than failing, as rate limits are an environmental condition.


### [CP-3.7] File Modification Rules
- Always read target file before proposing or making any change. Never guess existing content.
- Preserve all existing comments and docstrings not related to the change.
- Do not duplicate file content in chat responses — use tool edits and summarize briefly.
- Preserve module registry integrity. Adding/removing/renaming source files requires updating `PROJECT_LOGIC.md [PL-2.2]` via the `CMD-1` command from the `yomumogu-docs-update` skill.
- **Prime Directive**: Timed subtitles and transcript metadata must strictly match scraper/generator outputs, never hand-written mock files. Any resource representing external media reality must be generated by code.

### [CP-3.8] Component Rules
- Client components must have `'use client'` at top.
- Do not use `dangerouslySetInnerHTML` anywhere except chat message bubbles, grammar feedback cards, and hint text (Gemini HTML with `<ruby>` tags).
- `stripRuby(html)` must be used when inserting AI-generated text into plain `<textarea>`.

### [CP-3.9] Temporary Scratch Scripts & Log
- All temporary, diagnostic, test-runner, or scratch files created during development (e.g., under `scratch/` or in the workspace root) must be logged in `scratch/SCRATCH_LOG.md` immediately upon creation.
- The log serves as a permanent historical audit trail. Never delete rows from the log table.
- Before deleting a temporary script, you must run its cleanup/teardown routine to eliminate all side-effects (e.g. databases, files, modified environment configs, Anki decks) and update the script's status in the log table to "Deleted (Cleaned up)" or "Deleted (Leftovers: [description])" so it can be referenced in the future if any issues arise.

### [CP-3.10] Changelog
- When implementing a feature, refactor, or documentation update, you must update the root `CHANGELOG.md` file (which is public and tracked in Git) using the `CMD-4` command from the `yomumogu-docs-update` skill.
- The changelog is excluded from mandatory Route A pre-reads to optimize token footprint. Read it only when specifically tasked with troubleshooting version history or onboarding onto a new codebase session.

### [CP-3.11] Git Safety & Local Commits
- AI is allowed to automatically run GW-1 to stage and commit changes locally upon completing milestones/refactors to keep history clean.
- Automated `git push` is strictly forbidden and must only be run on explicit user instruction.

### [CP-3.12] Local Auxiliary Files
- All files prefixed with `_nogit_` (e.g., `_nogit_roadmap.md`, `_nogit_audit_report.md`) are local auxiliary documents and are strictly ignored in Git. They must be used for temporary notes, roadmaps, and developer-only tasks.

---

## [CP-4] DESIGN SYSTEM

- **Color Palette**: Duolingo-inspired. CSS variables in `globals.css`: `--color-green`, `--color-blue`, `--color-orange`, `--color-red`, `--color-yellow`, with `-shadow` variants.
- **Typography**: Nunito (Google Fonts), loaded via `layout.tsx`.
- **Buttons**: `.btn-3d` global class with color modifiers (`.btn-green`, `.btn-blue`, `.btn-red`, `.btn-orange`, `.btn-yellow`, `.btn-gray`, `.btn-purple`). 3D shadow depth effect.
- **Cards**: `.card-friendly` global class.
- **Inputs**: `.input-friendly` global class.
- **Ruby/Furigana**: `ruby { ruby-position: over; }` + `rt { font-size: 0.55em; user-select: none; }` in `globals.css`.

---

## [CP-5] SCOPE BOUNDARY

- Only code generation, bug fixing, and feature implementation.
- No architectural decisions without Route B (proposal audit) first.

---

## [CP-6] HOW TO RESPOND

- No preamble. No sycophancy. Start with the result.
- If you modified files → brief summary only, link the files.
- After feature implementation → flag if CMD-1/CMD-2/CMD-3 is needed.
- For non-trivial changes → always create `implementation_plan.md` first (RNA-Blueprint).

# CONTEXT_PROMPT.md — YomuMogu AI Onboarding

## [CP-1] ROLE

You are an expert **TypeScript / Next.js 15** developer. Your specialty is App Router architecture, Gemini API integration, React client components, and CSS Modules. You write clean, typed, modular code that is maintainable and well-documented in Russian.

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
- **Anki Integration**: Connect to local AnkiConnect HTTP API, load decks/cards, filter by status (new/learning/review/mature) aligned with Anki's due dates using search queries. Enabled by default unless explicitly disabled in the environment (`ANKI_ENABLED='false'`).
- **Gemini Session Generation**: Structured JSON output, 3 sessions with target words (4–6 words each, prioritized by status).
- **Chat System**: Multi-turn dialogue with AI character (history window set to 20 messages preserving up to 10 turns of context). System prompt enforces character persona, conversational memory/context retention, active target word nudging, and grammar analysis.
- **Difficulty Levels (1–5)**: Control Japanese complexity and furigana rendering in chat. Level 1 and 2 rules strictly exclude formal clerk-speak / Keigo.
- **Furigana**: Levels 1–3 render `<ruby>` tags via `dangerouslySetInnerHTML`. Levels 4–5 no furigana.
- **Hint System**: `/api/chat/hint` generates 3 response variants (easy/medium/advanced).
- **Progression & XP System**: An XP-based progression system (levels 0–6) that serves as a decorative progress overlay on the dashboard to visualize study metrics.
- **Profile System**: All user data namespaced in localStorage under `yomumogu_profile_${profileId}_${key}`. Default profile: `default`. Multi-profile UI with create/switch/delete.
- **Gamified Landing Page & Start Menu**: A Duolingo-styled root dashboard featuring an interactive mascot 🍵 that wiggles and greets the user with random motivational phrases upon clicking, a primary 3D button that dynamically toggles between starting a new session and resuming an active one and routes directly to `/practice`, a persistent horizontal progress card widget rendering levels, XP progress bar, and learning stats directly in the central dashboard column, a secondary grid containing settings links, tabbed help guide, and profile modal, all styled as solid cards overlaying a premium, traditional Japanese Kumiko (Asanoha) geometric grid pattern with a warm washi paper texture background.
- **Practice Launcher View (`/practice`)**: A dedicated view to launch practice sessions, manage generated conversational scenarios, resume or discard active sessions, and display learning progress stats, completely decoupled from configuration settings. Features a clean split between "New Words" (with progress tracking and daily limits) and "Active Reviews" (FSRS-due items), reactive offset modification ("➕ Добавить +10"), and redirects finished warmup runs directly to a Quiz page with the studied cards list in `mode=new`. Organizes widgets as clean cards floating over the Kumiko background, structured in a two-column sidebar layout on desktop (main column for learning activities, right column for learning source information and FSRS tips) that adapts to a single column on smaller viewports.
- **Chat Session Persistence**: Automatic state serialization and saving to localStorage (profile-namespaced format `chat_state_${sessionId}`). Restores conversation, collected words, and progress state on page reload/navigation. Features blue "Продолжить практику" / "Продолжить" buttons on homepage and settings grid, accompanied by red "Сбросить" / "Сброс" buttons for active/in-progress sessions.
- **Session Safeguard**: Session validation checks inside `/chat` that detect corrupted or outdated states and render a fallback UI to reset the session safely.
- **Refined Chat Exit & Confirmation Flow**: Non-destructive back navigation that allows returning to the landing dashboard without destroying session progress, a dedicated orange "Завершить" 3D button in the chat header, and a custom 3D modal confirmation card that serializes state (`showExitConfirm`) to `localStorage` and routes to the Bonus Test and audit pipeline upon confirmation.
- **Retry/Fallback**: Gemini calls retry with exponential backoff, fallback across model list (`gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite`).
- **Logging**: Structured logger with levels (debug/info/warn/error), file output to `logs/`.
- **Testing**: Vitest unit tests (mocked) + separate integration config for real Gemini API.
- **Session Completion & Audit**: Dialogue word/Anki auditor that runs a written translation Bonus Test for unused words, extracts key vocabulary with Gemini, looks up definitions offline in local JitenDex SQLite database (via Python script), and provides sync options to review due cards with manual review grading (Again, Hard, Good, Easy) or add new notes in Anki using Gemini AI note creation based on active model layout, including TTS and images. Supports individual word/card synchronization and note creation directly from the results screen.
- **Local-First Database & Bilateral Synchronization**: Client-side IndexedDB database (via Dexie.js) cache for imported decks. Features a robust bilateral synchronization engine (`/api/anki/sync-db`) supporting: review log deduplication (idempotence to handle connection drops), bulk queries to eliminate connection bottlenecks, FSRS schedule parameter approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) for pre-existing cards without review logs, and 4:00 AM local time daily boundary alignment. Maintains dual FSRS states (`passive` for recognition and `active` for recall/usage) with active state as the primary sync anchor. Cleans and strips HTML from imported card translations, inserting `; ` separators on block/span elements to prevent word clumping. Programmatically cleans existing clumped translations on profile startup.
- **Contextual Sentence Examples**: Automatically parses and saves user-generated sentences and translations as `contextExamples` inside IndexedDB under the associated word entity when target words are used successfully in dialogue chat.
- **Offline Local Starter Deck & Diagnostic Assessment**: Supports completely offline practice without Anki. Includes a 500-word lazy-loaded starter list (`starter_deck.json`), a fullscreen diagnostic assessment grid (grouped by JLPT and part of speech) with additive progress protection (learning/review status is locked), and FSRS scheduling prioritizing due words, daily new limits (10/day), and mature fallbacks.
- **Per-Deck Field Mappings**: Allows configuring distinct Front, Back, Audio, and Image field names for each individual Anki deck, stored in a namespaced local storage object. Resolves mismatched deck field mapping errors when syncing all decks under the `__all__` deck selector.
- **CSRF Protection**: All mutating POST API routes proxying requests to local Anki are secured by same-origin Origin and Referer verification checks.
- **Unified Error Handling Boundaries & API Hook**: Global class-based React `ErrorBoundary` and UI fallback component catch rendering exceptions, and a custom `useApiCall` hook consolidates client-side loading, error state, and retry logic.
- **Dropdown Keyboard Accessibility (a11y)**: The LanguageSwitcher component is fully navigable using standard keyboard bindings (Arrows, Escape, Space, Enter) with active focus synchronization.
- **Local Active Recall Quiz & FSRS Alignment**: Offline-first client-side quiz page (`/practice/quiz`) with Cloze Deletions, fallback direct translation, and dual hint systems (first character and JitenDex offline lookup with target word masking). Integrates with chat results via ad-hoc redirect (`?words=...`) and FSRS due-based reviews. Features bilateral scheduling curve alignment (`alignPassiveToActiveState`) to prevent passive curve lag, and skips passive log synchronization to Anki. Features manual-override FSRS grading bar (Again, Hard, Good, Easy) with custom button colors, typo-forgiveness modal bypass ("Опечатка / Принять ответ"), inline `<ruby>` furigana visualization on feedback cards, and custom keyboard shortcuts.
- **Warm-up Trainer (Priming)**: Inline React-overlay trainer on the practice page, offering a 3-step learning warmup (Sight & Sound with TTS audio, Kana Check, Translation Check) for up to 10 new words without updating FSRS progress in IndexedDB.
- **Phonosemantic Hints (声符)**: Custom Accordion component displaying a phonetic key and relatives with meanings and readings to reinforce Kanji associations, integrated into both Warm-up trainer and Quiz screens.
- **Interactive Mnemonics & AI Etymology**: User notes / mnemonics saved to IndexedDB inside the Quiz, featuring a "✨ ИИ-Этимология" button to query radical breakdowns and origins using Gemini API, automatically auto-filling user notes.
- **FSRS New Status Exclusions**: Due words calculation and scheduling filters explicitly exclude `new` status words from the due count to avoid initial vocabulary inflation.
- **Debug HUD Side Drawer (Developer layer)**: Toggleable side drawer panel enabled only in development/testing mode. Displays FSRS trajectories (stability, difficulty, reps, lapses, due date) for active/passive cards, visualizes raw Gemini prompt templates and dialogue history, lists words studied today (reviews log), and provides developer utilities to switch profiles, inspect localStorage values, trigger database resets, or simulate XP progression.
- **Interactive Mascot Widget**: Floating client-side vector SVG mascot 🍵 in `/chat` with custom animations (floating, bouncing, nodding, shaking) that reacts to target words detection (`happy`), grammar corrections (`worried` with a visual tilt/pointer to the feedback card), and correct inputs (`cheering`).
- **Memory Decay Heatmap (Kumiko Grid)**: Landing page 2D SVG aggregator displaying 500 words of the starter deck in a 10x5 (50 cells) traditional Japanese Kumiko woodworking grid. Colors reflect memory stability (white, yellow, green, gold), and cells pulsate to flag due dates (memory cooling).
- **Gradual Furigana Opacity (JpUI)**: Seamless `<ruby>` furigana opacity fade-outs based on FSRS intervals (<3d: opacity 1; <21d: opacity 0.6; >=21d: opacity 0, appearing on hover) built to secure vertical line-height constraints and prevent Cumulative Layout Shift (CLS).
- **Visual Learning Tracks (Duolingo-style Path)**: A vertical winding roadmap on `/practice` mapping 5 nodes (3 AI sessions, 1 review marathon, 1 bonus quiz) with locked/active/completed state transitions, dynamic SVG background connectors, wiggling hover animations, and detail popovers.
- **Daily Quests Widget**: Right-sidebar widget on `/practice` tracking Reviews (10 FSRS checks), Chats (1 conversation scenario), and Mnemonics (2 notes saved/edited) with a 4:00 AM local time daily boundary reset and reward XP claiming.
- **Grammar Roadmap & Trainer**: A winding vertical roadmap (Duolingo-style SVG path) on the Practice page implementing a strict 7-step N5 grammar curriculum aligned with the Morphology-Before-Syntax pedagogy (1.1 Noun Predicate → 1.2 Adjectives → 2 Verb Classification → 3 ます-form → 4 ない-form → 5 て-form → 6 て-constructions). Features a linear unlock chain (each step requires the previous), snake-pattern node layout, and post-ladder placeholders (た-form, 〜たりする, 〜ながら, N5 Final). Practicing a rule launches the interactive client Grammar Trainer modal, presenting a dynamic "Grammar Lab / Sandbox" sentence workbench with live-updating grammatical cards (reacting to formality, polarity, and contractions), tooltip help popovers, custom pill labels, reactive mascot 🍵 animations, tabbed spoken Japanese secrets, and sentence composition checks verified by a dedicated Gemini API route. Active grammar practice routes dynamically prompt the AI to focus on dialogue usage and trigger Leitner spaced repetition updates (`[1, 3, 7, 14, 30]` days step scheduling) with user confidence grading checkboxes upon exit.
- **Situational Tagging System**: Automatic categorization of words into 10 themes (`shopping`, `restaurant`, `travel`, `home`, `work`, `hobbies`, `social`, `health`, `weather`, `education`) or `universal`, utilizing a local static dictionary (`situational_dictionary.json`) for N5 starter deck and a schema-enforced lazy Gemini classifier (`/api/gemini/classify`) for custom Anki imports.
- **Adaptive Reviews Gating & Scenario Selection**: Dynamic routing of FSRS review cards. Words with active stability < 3 days or lapses >= 2 are routed to conversational dialogue chat (Gemini), while stable words are routed to offline translation quizzes. Dialogue session generation programmatically groups active words by overlapping situational themes, selecting nouns matching a theme and blending universal verbs/adjectives to create coherent scenarios.
- **Contextual Distractors**: Optimization of the multiple-choice Warm-up selector by querying words matching the target's situational tag to provide contextually similar high-quality distractors.

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
- Cyrillic/Russian input check: check user's input for Russian characters. For hybrid inputs (Cyrillic placeholders in Japanese sentences, e.g. 'Стулの座って'), set `isCorrect: false` and return a fully corrected Japanese sentence with the translated placeholder (e.g. '椅子に座って') in `correction`. For entirely Russian messages, set `isCorrect: false` and return the complete Japanese translation in `correction`. Enforce the same Furigana/Ruby rules in `correction` as in `reply` (for levels 1 & 2, furigana is strictly 100% present in both fields, regardless of Japanification level or progress). Never detect target words from Russian translations/placeholders.
- Response structure: reply must contain exactly one response sentence/phrase with exactly one question. Enforce difficulty level limits via self-counting. If the user asks a question, answer it in character first before asking the next question. Base the reply on the corrected meaning of the user's input (from `grammarFeedback.correction`). Never ask abstract questions (e.g. 'What are your plans?'); always ask highly concrete, situational questions to nudge the user to target words. Prefer open-ended questions over simple yes/no questions (unless a direct confirmation, preference, or ordering choice is contextually needed) to prevent one-word answers and encourage the user to write descriptive Japanese.


### [CP-3.4] Profile & Storage
- All client-side persistence via `src/lib/profile.ts` helpers: `getProfileItem`, `setProfileItem`, `removeProfileItem`.
- Never use raw `localStorage.getItem('yomumogu_...')` — always go through profile helpers.
- All `localStorage` access must be guarded: `if (typeof window === 'undefined') return null`.
- SSR hydration: defer localStorage reads to `useEffect` only.
- Client-side database queries use Dexie.js (`lib/db.ts`) upgraded to schema version 5 (indexing `*tags` multiEntry index). Defer all database transactions to client-side lifecycle functions (`useEffect`) or wrap them in a `typeof window !== 'undefined'` check to prevent Next.js SSR hydration errors.
- **Dual FSRS Scheduling**: Scheduler utility calls (`calculateNextFsrsState`) support signature overloading. They must accept either a flat legacy object or a nested structure with the review type specified (`'passive' | 'active'`) to support both global UI translations and deep dialog vocabulary practices.
- **Japanification Provider Enforcement**: The `useJapanification` hook must strictly be used within a `<JapanificationProvider>`. It is configured to throw an error if the context is undefined, preventing isolated local state synchronization splits. All tests rendering components calling this hook must wrap the subject under test with the provider.

### [CP-3.5] API Routes
- Every route validates required fields and returns structured JSON errors with appropriate HTTP codes.
- Every route logs at start (`[INFO]`) and on error (`[ERROR]` / `[WARN]`).
- Check `GEMINI_API_KEY` from `process.env` at top of route — return 500 with clear message if missing.

### [CP-3.6] Testing
- Unit tests use Vitest + `@testing-library/react`. Run with `npm run test`.
- All Gemini calls in unit tests must be **mocked** — never hit real API.
- Integration tests (real API) live in `*.integration.test.ts`. Run local Anki integration tests with `npm run test:integration` and live LLM tests with `npm run test:integration:gemini`.
- Integration tests require Anki Desktop to be running with AnkiConnect active on port 8765; if Anki is offline, sync-related integration tests will be silently skipped. The AI must explicitly instruct the user to open Anki Desktop before running integration tests.
- When adding a new module, add corresponding test file in `__tests__/` sibling directory.
- Mock all `lucide-react` icons in UI component tests to avoid SVG rendering issues in jsdom.
- For database-dependent unit tests (e.g. settings or practice pages querying Dexie IndexedDB), import and initialize the global polyfill `fake-indexeddb` at the top of the test file: `import fakeIndexedDB, { IDBKeyRange } from 'fake-indexeddb'; globalThis.indexedDB = fakeIndexedDB; globalThis.IDBKeyRange = IDBKeyRange;` to run offline DB queries and statistics aggregation safely in JSDOM.

### [CP-3.7] File Modification Rules
- Always read target file before proposing or making any change. Never guess existing content.
- Preserve all existing comments and docstrings not related to the change.
- Do not duplicate file content in chat responses — use tool edits and summarize briefly.
- Preserve module registry integrity. Adding/removing/renaming source files requires updating `PROJECT_LOGIC.md [PL-2.2]` via the `CMD-1` command from the `yomumogu-docs-update` skill.

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

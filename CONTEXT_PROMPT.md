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
- **Anki Integration**: Connect to local AnkiConnect HTTP API, load decks/cards, filter by status (new/learning/review/mature) aligned with Anki's due dates using search queries.
- **Gemini Session Generation**: Structured JSON output, 3 sessions with target words (4–6 words each, prioritized by status).
- **Chat System**: Multi-turn dialogue with AI character. System prompt enforces character persona, initiative, grammar analysis.
- **Difficulty Levels (1–5)**: Control Japanese complexity and furigana rendering in chat.
- **Furigana**: Levels 1–3 render `<ruby>` tags via `dangerouslySetInnerHTML`. Levels 4–5 no furigana.
- **Hint System**: `/api/chat/hint` generates 3 response variants (easy/medium/advanced).
- **Japanification System**: XP-based progression (levels 0–6) that gradually switches UI labels to Japanese.
- **Profile System**: All user data namespaced in localStorage under `yomumogu_profile_${profileId}_${key}`. Default profile: `default`. Multi-profile UI with create/switch/delete.
- **Gamified Landing Page & Start Menu**: A Duolingo-styled root dashboard featuring an animated bobbing mascot with an adaptive, Japanification-level-based speech bubble greeting (supporting full Ruby/Furigana rendering), a primary 3D button that dynamically toggles between starting a new session and resuming an active one (with a collected target words count tracker), and a secondary dashboard containing settings links, a tabbed help guide, and a profile progress overlay showing XP, tier, levels, and comprehensive statistics.
- **Chat Session Persistence**: Automatic state serialization and saving to localStorage (profile-namespaced format `chat_state_${sessionId}`). Restores conversation, collected words, and progress state on page reload/navigation. Features blue "Продолжить практику" / "Продолжить" buttons on homepage and settings grid, accompanied by red "Сбросить" / "Сброс" buttons for active/in-progress sessions.
- **Session Safeguard**: Session validation checks inside `/chat` that detect corrupted or outdated states and render a fallback UI to reset the session safely.
- **Refined Chat Exit & Confirmation Flow**: Non-destructive back navigation that allows returning to the landing dashboard without destroying session progress, a dedicated orange "Завершить" 3D button in the chat header, and a custom 3D modal confirmation card that serializes state (`showExitConfirm`) to `localStorage` and routes to the Bonus Test and audit pipeline upon confirmation.
- **Retry/Fallback**: Gemini calls retry with exponential backoff, fallback across model list (`gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite`).
- **Logging**: Structured logger with levels (debug/info/warn/error), file output to `logs/`.
- **Testing**: Vitest unit tests (mocked) + separate integration config for real Gemini API.
- **Session Completion & Audit**: Dialogue word/Anki auditor that runs a written translation Bonus Test for unused words, extracts key vocabulary with Gemini, looks up definitions offline in local JitenDex SQLite database (via Python script), and provides sync options to review due cards with manual review grading (Again, Hard, Good, Easy) or add new notes in Anki using Gemini AI note creation based on active model layout, including TTS and images.
- **Local-First Database & Bilateral Synchronization**: Client-side IndexedDB database (via Dexie.js) cache for imported decks. Features a robust bilateral synchronization engine (`/api/anki/sync-db`) supporting: review log deduplication (idempotence to handle connection drops), bulk queries to eliminate connection bottlenecks, FSRS schedule parameter approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) for pre-existing cards without review logs, and 4:00 AM local time daily boundary alignment.

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
- Cyrillic/Russian input check: check user's input for Russian characters. For hybrid inputs (Cyrillic placeholders in Japanese sentences, e.g. 'Стулの座って'), set `isCorrect: false` and return a fully corrected Japanese sentence with the translated placeholder (e.g. '椅子に座って') in `correction`. For entirely Russian messages, set `isCorrect: false` and return the complete Japanese translation in `correction`. Enforce the same Furigana/Ruby rules in `correction` as in `reply` (for levels 1 & 2, furigana is strictly 100% present in both fields, regardless of Japanification level or progress). Never detect target words from Russian translations/placeholders.
- Response structure: reply must contain exactly one response sentence/phrase with exactly one question. Enforce difficulty level limits via self-counting. If the user asks a question, answer it in character first before asking the next question. Base the reply on the corrected meaning of the user's input (from `grammarFeedback.correction`). Never ask abstract questions (e.g. 'What are your plans?'); always ask highly concrete, situational questions to nudge the user to target words. Prefer open-ended questions over simple yes/no questions (unless a direct confirmation, preference, or ordering choice is contextually needed) to prevent one-word answers and encourage the user to write descriptive Japanese.


### [CP-3.4] Profile & Storage
- All client-side persistence via `src/lib/profile.ts` helpers: `getProfileItem`, `setProfileItem`, `removeProfileItem`.
- Never use raw `localStorage.getItem('yomumogu_...')` — always go through profile helpers.
- All `localStorage` access must be guarded: `if (typeof window === 'undefined') return null`.
- SSR hydration: defer localStorage reads to `useEffect` only.
- Client-side database queries use Dexie.js (`lib/db.ts`). Defer all database transactions to client-side lifecycle functions (`useEffect`) or wrap them in a `typeof window !== 'undefined'` check to prevent Next.js SSR hydration errors.

### [CP-3.5] API Routes
- Every route validates required fields and returns structured JSON errors with appropriate HTTP codes.
- Every route logs at start (`[INFO]`) and on error (`[ERROR]` / `[WARN]`).
- Check `GEMINI_API_KEY` from `process.env` at top of route — return 500 with clear message if missing.

### [CP-3.6] Testing
- Unit tests use Vitest + `@testing-library/react`. Run with `npm run test`.
- All Gemini calls in unit tests must be **mocked** — never hit real API.
- Integration tests (real API) live in `*.integration.test.ts`. Run with `npm run test:integration`.
- When adding a new module, add corresponding test file in `__tests__/` sibling directory.
- Mock all `lucide-react` icons in UI component tests to avoid SVG rendering issues in jsdom.

### [CP-3.7] File Modification Rules
- Read target file before proposing any change.
- Preserve all existing comments and docstrings not related to the change.
- Do not duplicate file content in chat responses — use tool edits and summarize briefly.

### [CP-3.8] Component Rules
- Client components must have `'use client'` at top.
- Do not use `dangerouslySetInnerHTML` anywhere except chat message bubbles, grammar feedback cards, and hint text (Gemini HTML with `<ruby>` tags).
- `stripRuby(html)` must be used when inserting AI-generated text into plain `<textarea>`.

### [CP-3.9] Temporary Scratch Scripts & Log
- All temporary, diagnostic, test-runner, or scratch files created during development (e.g., under `scratch/` or in the workspace root) must be logged in `scratch/SCRATCH_LOG.md` immediately upon creation.
- The log serves as a permanent historical audit trail. Never delete rows from the log table.
- Before deleting a temporary script, you must run its cleanup/teardown routine to eliminate all side-effects (e.g. databases, files, modified environment configs, Anki decks) and update the script's status in the log table to "Deleted (Cleaned up)" or "Deleted (Leftovers: [description])" so it can be referenced in the future if any issues arise.

### [CP-3.10] Changelog
- When implementing a feature, refactor, or documentation update, you must update the root `CHANGELOG.md` file using the `CMD-4` command from the `yomumogu-docs-update` skill.
- The changelog is excluded from mandatory Route A pre-reads to optimize token footprint. Read it only when specifically tasked with troubleshooting version history or onboarding onto a new codebase session.

---

## [CP-4] DESIGN SYSTEM

- **Color Palette**: Duolingo-inspired. CSS variables in `globals.css`: `--color-green`, `--color-blue`, `--color-orange`, `--color-red`, `--color-yellow`, with `-shadow` variants.
- **Typography**: Nunito (Google Fonts), loaded via `layout.tsx`.
- **Buttons**: `.btn-3d` global class with color modifiers (`.btn-green`, `.btn-blue`, `.btn-red`, `.btn-orange`). 3D shadow depth effect.
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

# YomuMogu Changelog

All notable changes to the YomuMogu project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.21.0] - 2026-05-26
### Added
- Added client-only Warm-up Trainer (Priming) on the practice page, offering a 3-step learning overlay (Sight & Sound, Kana Check, Translation Check) for up to 10 new words from the local vocabulary without affecting FSRS intervals.
- Added Phonosemantic Hints (声符) Accordion component showcasing phonetic components and semantic relatives (kanji, reading, meaning) for JLPT N5-N3 kanji, populated via a static `phonosemantics.json` file containing ~50 frequent keys.
- Added interactive mnemonics and user notes editing directly in the Quiz page feedback screen, with automatic blur saving.
- Added a POST API endpoint `/api/gemini/etymology` and corresponding unit test coverage in `src/app/api/gemini/__tests__/etymology.test.ts` mock-verifying etymology extraction.
- Integrated a "✨ ИИ-Этимология" action in the Quiz note editor calling the etymology API to extract Kanji components and mnemonics using the Gemini API.
- Integrated FSRS status filters to exclude `new` status words from active due counts and launcher loaders, solving the daily pool inflation bug.

### Fixed
- Fixed TypeScript compiler type checking errors across multiple files (`src/app/chat/page.tsx`, `src/app/settings/page.tsx`, `src/app/api/chat/analyze/route.ts`) caused by flat `LocalWord` property references.
- Fixed TypeScript type constraints and compiler errors in legacy test cases in `src/core/__tests__/scheduler.test.ts` and `src/core/__tests__/db.test.ts` by introducing explicit type casting and mapping flat entities correctly.
- Added missing Lucide React icon imports (e.g. `BookOpen`) on the chat page results.

## [1.20.0] - 2026-05-26
### Added
- Added client-side active recall quiz page `/practice/quiz` with Cloze Deletions, fallback Russian-Japanese translation tests, and dual hint systems (first character reveal and offline JitenDex definitions lookup with target word masking `***`).
- Added offline dictionary search API route `/api/dict/lookup/route.ts` proxying offline SQLite lookup requests.
- Integrated FSRS active due count indicator and quiz launcher button in the Practice page dashboard (`/practice`).
- Added complete unit test coverage for the quiz page in `src/app/practice/quiz/__tests__/page.test.tsx` verifying loading states, standard/ad-hoc modes, feedback, and hint functionality.
- Added database-dependent JSDOM page integration regression tests for settings page (`src/app/settings/__tests__/page.test.tsx`) and practice page (`src/app/practice/__tests__/page.test.tsx`) that mock local Dexie database entries and verify statistics and due quiz counts in local mode.
- Added automatic synchronization of existing local database words with the updated starter deck (`syncExistingLocalWordsWithStarterDeck`) upon initializing settings or practice page dashboards, fixing text and transcription typos automatically on the client side without losing FSRS progress.

### Changed
- Replaced the inline Bonus Test screen in `/chat` page with an ad-hoc quiz redirect (`/practice/quiz?words=...`) rendering checklist dialog examples with user selection controls.
- Integrated FSRS dual-curve alignment (`alignPassiveToActiveState`) inside the remote review synchronization replayer (`db.ts`) and client-side chat review updates, assuring passive recognition stability updates synchronously with active production trials.
- Configured local reviews synchronization (`/api/anki/sync-db`) to filter out and skip local reviews of type `passive` to avoid polluting the single Anki FSRS curve.
- Updated `GEMINI.md` and `CONTEXT_PROMPT.md` to enforce procedural TDD checks (naming reproducing tests in plans before execution) and to provide clear setup instructions for `fake-indexeddb` database-dependent unit testing.
- Renamed the user-facing term "Локальная колода" (local deck) to "Локальный список" (local list) in settings and practice pages to decouple the offline vocabulary source from Anki terminology, preserving internal database indices to protect user progress.

### Fixed
- Corrected Cyrillic character typo in the reading of word 115 (忙しい) inside the offline starter deck database (`starter_deck.json`).
- Corrected Japanese reading typos for words 425 (アドバイスする) and 459 (ネガティブ) inside the offline starter list database (`starter_deck.json`).
- Stabilized quiz page test assertions by adding focus checks (`toHaveFocus`) before typing values to prevent mock rendering loop race conditions.

## [1.19.0] - 2026-05-25
### Added
- Added dual-state FSRS scheduling support (`passive` and `active` states) for each vocabulary item in IndexedDB to separately track recognition (reading) and recall/usage (chat dialog writing).
- Added contextual sentence examples (`contextExamples` field) to local vocabulary entities, which automatically captures and saves user-generated sentences and translations upon correct usage in dialogue chat.

### Changed
- Upgraded local Dexie database schema to Version 3, with nested indexes for `passive.due` and `active.due` and migration logic to convert flat FSRS fields to the new nested format.
- Refactored `scheduler.ts` to support both flat FSRS structures (for backward compatibility and UI tests) and nested structures by checking signatures (`typeOrNow instanceof Date`).
- Updated bilateral database synchronization logic (`sync-db/route.ts`) to use active FSRS state as primary scheduling sync anchor, replay remote reviews to both active/passive curves, and clean/sanitize HTML from imported card translations.
- Modified `/chat` page dialog submission logic to check the active word list, update the corresponding FSRS state (active if in collected target words, passive otherwise), and record the contextual sentences when target words are successfully used.

## [1.18.0] - 2026-05-25
### Added
- Created dedicated Practice page `/practice` (`src/app/practice/page.tsx` and `src/app/practice/practice.module.css`) to isolate the Gemini conversation practice launcher, scenario generation, and session continuation/discard controls from the configuration UI.
- Unit tests for the practice page in `src/app/practice/__tests__/page.test.tsx` checking page rendering, word source metadata loading, empty states, and mock session generation.

### Changed
- Decoupled configuration settings from practice launcher: removed the Gemini sessions grid, sessions list, and session methods from settings page (`src/app/settings/page.tsx`).
- Renamed the settings tab "Импорт & Anki" to "Источник обучения" (Learning Source).
- Updated home page `/` "Начать практику" button to route directly to `/practice` and updated mascot greeting case 0.
- Allowed Anki integration to be enabled by default by updating backend routes and frontend controls to check `ANKI_ENABLED !== 'false'` and `NEXT_PUBLIC_ANKI_ENABLED !== 'false'`.
- Updated settings page unit tests in `src/app/settings/__tests__/page.test.tsx` and home page unit tests in `src/app/__tests__/page.test.tsx` to align with tab renaming, route redirection, and session block removal.

### Fixed
- Fixed TypeScript compilation error in `src/components/ErrorBoundary.tsx` due to a mismatch in `logger.error` signature argument count.
- Fixed a compilation error by exporting `AnkiWord` from `src/plugins/anki/filter.ts` and updating its import paths to `@/plugins/anki/filter` in `src/lib/gemini/client.ts` and its test files.

## [1.17.0] - 2026-05-25
### Added
- Unit test `src/__tests__/next.config.test.ts` to verify the Content-Security-Policy header configuration across development and production environments.

### Fixed
- Fixed the React `eval() is not supported in this environment` error in development mode (e.g. under Next.js Turbopack) by conditionally appending `'unsafe-eval'` to the `script-src` directive of the Content-Security-Policy header when `process.env.NODE_ENV === 'development'`.

## [1.16.0] - 2026-05-25
### Added
- Configured `ANKI_ENABLED` and `NEXT_PUBLIC_ANKI_ENABLED` environment variables in `vitest.setup.ts` to resolve 403 authorization failures in API route and UI settings tests.

### Changed
- Relocated test files to align with the core/plugins module structure: moved `localDeckService.test.ts` and `db.test.ts` to `src/core/__tests__/`, renamed and moved `fsrs.test.ts` to `src/core/__tests__/scheduler.test.ts`, and moved `client.test.ts` and `filter.test.ts` to `src/plugins/anki/__tests__/`.
- Updated test imports and corrected home page test heading text expectations to match the decoupled branding copy.

### Fixed
- Fixed a path resolution build error in `src/core/localDeckService.ts` by correcting the dynamic import path of `starter_deck.json`.

## [1.15.0] - 2026-05-25
### Added
- Expanded chat history context window passed to Gemini from the last 5 messages to the last 20 messages in `chat.ts` to improve contextual memory.
- Stricter context retention instructions in prompt templates (`prompts.ts`) to prevent dialogue loops and repeat questions about already selected items/colors.
- Active target word nudging instructions in `prompts.ts` forcing the AI to design prompts to guide the user towards remaining unused words.
- Live dialogue integration test scenarios suite (`scenarios.integration.test.ts`) covering memory retention, Keigo exclusion, target word nudging, and ambiguity/loop resolution.

### Changed
- Level instructions for Levels 1 and 2 updated to strictly forbid complex business honorifics (Keigo/Kenjougo) and store-clerk registers, ensuring simple polite structures (〜です/〜ます) are used to prioritize beginner comprehension.
- Split integration tests: `npm run test:integration` now runs only local Anki integration tests (free), while a new script `npm run test:integration:gemini` runs live Gemini API integration tests (paid).

### Fixed
- Fixed minor Japanese text typos in Level 2 examples (`доко` -> `どこ`, `ка` -> `か`).

## [1.14.0] - 2026-05-24
### Added
- CSRF validation utility (`src/lib/csrf.ts`) verifying Origin/Referer headers on mutating POST routes.
- Unified React Class-based `ErrorBoundary` and companion custom styled `ErrorFallback` component.
- Typed `useApiCall` custom hook wrapping API calls with auto-retry and loading/error states.
- Next.js page-level global error boundary at `src/app/error.tsx`.
- Dev/test package overrides for `postcss` (v8.5.10+) to fix CSS parser vulnerabilities.
- Multi-browser/Vitest environment overrides in CSRF validation and AnkiConnectClient browser guard.
- 10 new unit tests covering the error boundary, error fallback component, and api call hook.

### Changed
- Next.js configurations consolidated: CSP headers merged from `next.config.mjs` into `next.config.ts`, and the redundant `.mjs` file deleted.
- Hook memoization: optimized `useJapanification` return value to prevent cascading component re-renders. Enforced provider check throws errors outside provider scope.
- Updated `LanguageSwitcher` to support full keyboard navigation (a11y Arrows, Space, Enter, Escape keys) with active item focus trap logic.

### Fixed
- Fixed Vitest unit test suite failures by wrapping tests inside `JapanificationProvider` and bypassing environment checks on test runners.

## [1.13.0] - 2026-05-23
### Fixed
- FSRS interval inflation bug: reviews inserted into Anki with wrong `reviewType=0` (Learn) instead of `reviewType=1` (Review) for already-learned cards, causing stability explosion during FSRS replay when `elapsed_days >> scheduled_days`.
- `lastInterval` correction: when syncing a card for the first time locally, `lastInterval=0` was sent to Anki even for mature cards; now cross-references `getCardsInfo` to use the card's actual Anki interval.
- Review `duration` field set to 5000ms (5 seconds) instead of 0ms for chat-practice reviews to avoid suspicious stats in Anki.

### Added
- 5 new FSRS unit tests: interval ordering (Again < Hard < Good < Easy) for review and mature cards, overdue interval sanity, new card first interval bounds, and sequential review growth validation.
- `getCardsInfo` lookup in sync-db route for accurate `reviewType` determination based on actual Anki card state (interval/queue).

### Changed
- Sync-db route now determines `reviewType` by querying Anki card metadata instead of inferring from `lastInterval` value alone.

## [1.12.0] - 2026-05-23
### Added
- Individual word synchronization and card adding buttons (represented by 3D compact `RefreshCw` and `Plus` buttons next to each word) on the chat completion summary results page.
- Detailed error messages displayed locally below each word row on individual synchronization/adding failures.
- Step-by-step logging with `[Session: sessionId] [Step: stepName]` prefixes in server-side proxy routes: `POST /api/anki/sync-db` and `POST /api/anki/add` to allow session-level error debugging by AI assistants.

### Changed
- Refactored full sync button handler `handleSyncAndAdd` to use `syncLocalDatabaseWithAnki` helper instead of raw fetch calls, correcting a bug where local review logs were not uploaded during full synchronization.
- Updated client-side database helper `syncLocalDatabaseWithAnki` and page logic to pass `session.id` to the API routes.

### Fixed
- FSRS parameters calculation errors during historical reviews replay inside `syncLocalDatabaseWithAnki` by introducing reference date support in `mapLocalToFsrsCard` to compute correct `elapsed_days`.
- Initial import due date initialization defaulting to today for mature cards with no history logs; now approximates due timestamp based on Anki's card interval.

## [1.11.0] - 2026-05-23
### Added
- Unit tests in `src/lib/__tests__/db.test.ts` covering compound key validation and database safety guards.

### Changed
- Updated `README.md`, `PROJECT_LOGIC.md`, and `CONTEXT_PROMPT.md` to document that running Anki Desktop with AnkiConnect active is required to run the full integration test suite, establishing a coding rule to explicitly instruct the user about this before executing tests.

### Fixed
- Dexie.js database error `Invalid key provided` during bilateral Anki synchronization and chat progress saving by introducing strict key validation checks (`isValidIndexedDbKey`). Invalid/NaN/undefined keys are now skipped/logged rather than causing IndexedDB query failures.

## [1.10.0] - 2026-05-23
### Added
- Per-deck Anki field mapping configurations stored in profile-namespaced `deck_mappings` key within `localStorage`.
- Support for dynamic field mappings mapping in card matching inside `parseAndFilterCards` helper.
- Support for passing dynamic mappings in endpoints: GET `/api/anki/words`, POST `/api/anki/sync-db`, and POST `/api/chat/analyze`.
- Settings page fields input forms supporting editing specific configured decks individually.

### Fixed
- HTML hydration and button nesting console errors on landing page by introducing an `interactive` prop to `<JpUI>` to render static spans instead of nested `<button>`s inside links and other buttons.

## [1.9.0] - 2026-05-23
### Added
- Tabbed interface navigation to the settings page (`src/app/settings/page.tsx`), partitioning configuration into three clean tabs: **Профиль** (profile, settings, presets, levels, multi-profile selector), **Импорт & Anki** (Anki connection, diagnostic assessment, sessions grid, words table), and **Облако** (a clean "В разработке" card).
- React Context provider (`JapanificationProvider`) wrapping the root layout to eliminate global state desynchronization for language/immersion switching.
- Support for URL hash `#profile` to automatically select the Profile tab on settings load.

### Changed
- Decoupled smart mode translations from XP levels, leaving virtual levels/XP purely as decorative progress markers.
- Updated immersion explanation copy in the homepage help modal to explain FSRS-driven translations and clarify that XP levels are decorative progress placeholders.
- Removed the unused "В чат" link from settings header.
- Renamed the hooks hook file from `useJapanification.ts` to `useJapanification.tsx` to support JSX context provider.

### Fixed
- Fixed styling syntax errors in `src/app/page.tsx` (`className="btn-3d styles.secondaryBtn"` -> `className={\`btn-3d \${styles.secondaryBtn}\`}`).
- Fixed key casing in settings inline styles (`justify-content` -> `justifyContent`).
- Aligned homepage and settings page unit tests to match tabbed structure, updated headers, and new help tab text.

## [1.8.0] - 2026-05-23
### Added
- Compact global `LanguageSwitcher` dropdown component styling in 3D Duolingo theme (options: Русский, Smart, 日本語).
- Global language switcher dropdown integration in headers of dashboard (landing page) and settings page.

### Changed
- Replaced the large, orange full-screen emergency "Вернуть на русский" button block in settings with the global `LanguageSwitcher` dropdown in the header.
- Hidden all user-facing "Japanification" (Японизация) branding in Russian UI: renamed "Уровень японизации" to "Уровень" in Profile, and renamed the "Японизация" help tab to "Погружение" (Immersion) along with updating the help documentation.
- Updated `useJapanification` hook and schema definitions to track `uiMode` (`ru` | `smart` | `ja`) and dynamically compute virtual progression levels under-the-hood.

### Fixed
- Updated and fixed unit tests in `src/app/__tests__/page.test.tsx` and `src/app/settings/__tests__/page.test.tsx` to match the new UI strings and mock required Lucide icons (`Globe`, `ChevronDown`, `Check`).

## [1.7.0] - 2026-05-23
### Added
- Granular UI FSRS Japanification system using `ts-fsrs` mathematical scheduler.
- `<JpUI>` React wrapper component and `JpUIProvider` context manager, which handles smart localization, loading state from IndexedDB (`ui_words` table), and sessionStorage-based upgrade session lockout.
- Local IndexedDB table `ui_words` schema and database interface methods (`getLocalUiWords`, `saveLocalUiWord`, `resetLocalUiWords`).
- Floating interactive tooltip in `<JpUI>` with FSRS assessment actions ("Забыл (Рус)" / "Знаю"), showing furigana readings using `<ruby>` tags if reviews count is low (`reps <= 2`).
- Emergency panic button "Переключить на русский" in UI settings page to instantly reset visualization mode without discarding FSRS data.
- UI FSRS Reset button in settings page to delete `ui_words` table records.

### Changed
- Settings page: Integrated 3-way radio selection for UI localization mode (Russian, Smart Japanification, Japanese).
- Landing page: Wrapped navigation links with `<JpUI>` tags for gradual translation.
- Simplified `useJapanification` hook to compute derived virtual properties (XP, virtual level, normal speed) and support the new `uiMode` state structure.

### Fixed
- Resolved all TypeScript compiler type checking errors (`tsc --noEmit`) and Next.js build-time bundling issues.
- Fixed `ts-fsrs` card interface compatibility error by adding `learning_steps` property to `mapLocalToFsrsCard`.
- Fixed `fake-indexeddb` type declaration issues in tests by importing `IDBKeyRange` from the root of the package instead of subpaths.
- Corrected unit test mock definitions (e.g. adding missing `type` field to `AnkiCardInfo` mock in `add.test.ts`).

## [1.6.0] - 2026-05-22
### Added
- Configurable dynamic daily new words quota limit configuration in user profile settings.
- Profile-namespaced persistence of user quota preset selection (`quota_preset`) and custom quota value (`daily_new_words_limit`).
- Dynamic limit calculations in local deck service `getDailyNewWordsLimit` supporting preset boundaries (5, 10, 20) and custom ranges (1-50) with fallback.

### Changed
- Settings UI: Added dynamic daily quota selector group under the profile card, supporting Easy, Standard, Hard, and Custom numeric input.
- Local Deck Mode: Replaced hardcoded daily limit display and stats labels with dynamic values reflecting the active profile limit.

## [1.5.0] - 2026-05-22
### Added
- Local Offline Deck Mode: implemented client-side starter deck (500 words) using IndexedDB (`deckMode === 'local'`), enabling full practice offline without requiring Anki.
- Dynamic Diagnostic Assessment Modal: fullscreen grid checklist organized by JLPT N5, N4, and Conversational categories for marking known/mature words.
- Safe Additive Progress Mode: repeat assessment loading retrieves current DB status, disabling checkbox toggling for words already in progress (`learning` or `review`).
- Service Layer (`localDeckService.ts`): handles database population, active pool generation (due-only + new quota + mature fallback), and daily quota tracking (10 new words limit, aligned to 4:00 AM local time).
- Polyfilled IndexedDB in Vitest: added `fake-indexeddb` setup in `vitest.setup.ts` to ensure clean jsdom test runs.

### Changed
- Settings page: added local deck configuration, real-time stats display, and custom start triggers.

---

## [1.4.0] - 2026-05-22
### Added
- Session discard control: added a red "Сброс" (Discard) button next to "Продолжить" button inside the session grid cards on the settings page (`src/app/settings/page.tsx`).
- Session crash safeguard: implemented session integrity validation checks inside the chat page (`src/app/chat/page.tsx`). Added a user-friendly fallback view with a red "Сбросить сессию" button to safely purge corrupted or outdated sessions.

### Changed
- Removed "Anki" branding from the header logo, renaming it to simply "YomuMogu".
- Converted the header logo container into a clickable `Link` pointing to the root dashboard (`/`), enabling direct navigation back to the landing page from settings or profiles.

---

## [1.3.0] - 2026-05-22
### Changed
- Integrated "Strict Sensei" mode rules into the conversational Gemini system prompts (`src/lib/gemini/prompts.ts`), adding behavior constraints for strict tone, no superficial praise, objective feedback, and topic adherence.
- Upgraded Japanese difficulty level instructions (1-5) in `src/lib/gemini/prompts.ts` to include simulated slow speech and level-appropriate vocabulary/complexity (short sentences for L1-L2, clear desu/masu for L3, advanced/fluent structures for L4-L5).

### Fixed
- Fixed target word nudging behavior (homograph bug) by passing the actual client-side `collectedWords` state to the `/api/chat` route and prioritizing it over history substring matching in prompt generation.

---

## [1.2.0] - 2026-05-22
### Added
- Root `CHANGELOG.md` for high-level version history and project change tracking.
- `CMD-4` command routing inside the `yomumogu-docs-update` skill to handle automated changelog updates.
- Operational constraint `[PL-8.12]` and coding rule `[CP-3.10]` mapping changelog update requirements.

### Changed
- Excluded `CHANGELOG.md` from the mandatory pre-read paths of daily Route A tasks to optimize token consumption and prevent context bloat.

---

## [1.1.0] - 2026-05-22
### Added
- Permanent diagnostic and sandbox script registry [scratch/SCRATCH_LOG.md](file:///c:/YomuMogu/scratch/SCRATCH_LOG.md) to track all temporary code and prevent residual resource pollution.
- Operational constraint `[PL-8.11]` and coding rule `[CP-3.9]` enforcing logging of all scratch files.
- Safe Anki Integration Testing Guidelines in `README.md` warning developers to use separate, unsynced Anki profiles.

### Fixed
- Residual test deck pollution issues by removing old hardcoded test references and implementing clean, isolated run guidelines.

---

## [1.0.0] - 2026-05-22
### Added
- Core bilateral synchronization between local Anki Desktop (AnkiConnect on port 8765) and client-side IndexedDB database (Dexie.js).
- Bilateral review sync coordinator with query deduplication and bulk fetching of card review histories.
- FSRS mathematical scheduler approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) to preserve pre-existing mature card intervals.
- Day boundary alignment shifting schedule resets to 4:00 AM local time matching Anki Desktop.

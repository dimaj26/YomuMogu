# YomuMogu (よむもぐ)

YomuMogu is an interactive Japanese language learning web application that integrates with local Anki flashcards and utilizes the Google Gemini API to generate contextual conversation practice sessions.

---

## Prerequisites
- **Node.js**: 20+
- **Python**: 3.11+ (for fast offline dictionary querying of the SQLite database)
- **Anki**: Local application running with the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) plugin enabled on port `8765`.
- **JitenDex Database**: Local SQLite dictionary database file `jitendex.db` placed inside the `jitendex/` directory.

---

## Installation & Setup

1. **Install Dependencies**:
   ```powershell
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and add your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Database Setup**:
   Ensure `jitendex.db` is present in the `jitendex/` folder of the workspace.

---

## Running the App

Start the Next.js development server:
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start practicing.

### Testing
- **Unit Tests** (offline/mocked):
  ```powershell
  npm run test
  ```
- **Local Integration Tests** (free, local; requires local Anki Desktop running with AnkiConnect active):
  ```powershell
  npm run test:integration
  ```
- **Gemini API Integration Tests** (online, uses real Gemini API key; costs money):
  ```powershell
  npm run test:integration:gemini
  ```
- **Anki Integration Tests Shortcut** (uses real local Anki Desktop):
  ```powershell
  npm run test:anki
  ```

> [!WARNING]
> **Anki Integration Testing Requirements & Safety:**
> - Running local integration tests (`npm run test:integration` or `npm run test:anki`) connects directly to your active Anki Desktop profile via AnkiConnect.
> - **Important Requirement**: For the integration tests to run completely and verify real synchronization logic, **Anki Desktop must be open and running** on your local machine with the AnkiConnect plugin active on port 8765. If Anki is offline, the Anki integration tests will be skipped automatically to prevent test suite failure.
> - **Strongly Recommended**: Switch to an isolated, unsynced Anki profile (e.g., `YomuMoguTest`) in Anki Desktop before running these tests. Do not run tests on your primary study profile to avoid polluting your card review history or syncing test garbage to your AnkiWeb account.



---

## Key Features

- **Gamified Start Menu & Mascot**: Beautiful bobbing cup mascot 🍵 that is interactive, wiggles, and shows random motivational phrases upon clicking. Features a persistent horizontal progression widget card (displaying levels, XP bar, and learning stats) embedded directly in the main column flow, a decorative grid pattern background, and 3D overlay modals for Help documentation and Profile management.
- **Refined Chat Exit & Confirmation Flow**: Supports non-destructive back navigation from the active chat directly to the dashboard, and features a dedicated "Завершить" button with a custom 3D confirmation modal to transition into the Bonus Test.
- **Anki Deck Integration**: Automatically imports cards from selected Anki decks, prioritizing new/learning status words. Supports configuring distinct Front, Back, Audio, and Image field mappings per deck to handle custom note templates.
- **CSRF Protection**: All mutating API endpoints proxying requests to local Anki are protected by strict Origin/Referer verification checks.
- **Unified Error Handling Boundaries & API Hook**: Reusable React `ErrorBoundary` and companion `ErrorFallback` UI wrap rendering exceptions, and a custom `useApiCall` hook handles loading, error, and retry state management on client fetches.
- **Language Switcher Dropdown (a11y)**: Compact 3D Duolingo-styled global language switcher dropdown in the header, fully keyboard navigable (Arrows, Space, Enter, Escape) with active focus synchronization.
- **Granular UI FSRS Japanification**: Under-the-hood smart localization wrapper component (`<JpUI>`) and provider (`JpUIProvider`) driven by the `ts-fsrs` mathematical scheduler. In Smart mode, it dynamically translates UI elements (up to 1 new word per session), plays gold pulse animations on new translations, provides hover translation tooltips, and supports interactive FSRS assessments ("Забыл" / "Знаю") directly in the UI. All user-facing "Japanification" branding is hidden (referred to as Immersion / "Погружение" or "Уровень" in Russian).
- **Practice Launcher View (`/practice`)**: A dedicated view to launch practice sessions, manage generated conversational scenarios, resume or discard active sessions, and display learning progress stats, completely decoupled from configuration settings. Features a clean split between "New Words" (with progress tracking and daily limits) and "Active Reviews" (FSRS-due items), reactive offset modification ("➕ Добавить +10"), and redirects finished warmup runs directly to a Quiz page with the studied cards list in `mode=new`.
- **Chat Session Persistence**: Automatically serializes and restores complete chat history, targets, and progress states across page reloads and navigation. In-progress sessions can be resumed via homepage or settings CTA buttons.
- **Multi-Profile Isolation**: Isolates learning progress, XP statistics, imported words, and active chat states under unique profile namespaces to support multiple local users.
- **Local-First Database Cache**: Caches imported decks and review logs locally using a Dexie.js (IndexedDB) database for high responsiveness and offline capability. Captures and saves user-generated contextual sentences under vocabulary entities.
- **Bilateral FSRS Sync**: Synchronizes local review logs and card states with local Anki Desktop using a robust synchronizer featuring query deduplication (idempotence), FSRS parameter approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) to preserve mature card history, and 4:00 AM day boundary alignment. Maintains dual `passive` and `active` scheduling state curves aligned via remote review replay, utilizing the active state as the primary sync anchor. Cleans and truncates HTML from imported card translations.
- **Session Completion Flow**:
  - *Bonus Test*: Redirects to client-side Cloze Deletion active recall quiz.
  - *Gemini-Powered Chat Audit*: Automatically extracts new N4+ vocabulary used during practice.
  - *Offline Dictionary lookup*: Integrates JitenDex offline dictionary definitions (HTML).
  - *Anki Review Sync*: Seamlessly checks Anki card status to sync reviews or create new cards.
- **Warm-up Trainer (Priming)**: Client-only React-overlay on `/practice` facilitating a 3-step learning warmup (Sight & Sound, Kana Check, Translation Check) for up to 10 new words without FSRS modifications.
- **Phonosemantic Hints (声符)**: Custom Accordion component displaying Kanji phonetic components and semantic relative chips, aiding vocabulary association.
- **Interactive Mnemonics & AI Etymology**: Offline notes editor in the Quiz with a "✨ ИИ-Этимология" action to fetch origin breakdowns from Gemini API.

---

## Architecture Overview

```
src/
  app/                    # Next.js pages and API routes
    page.tsx              # Root landing page & dashboard start menu
    chat/                 # Conversation UI & Bonus/Sync flow
    practice/             # Practice launcher, session management, & stats
    settings/             # Deck settings, profile management, & field mappings
    api/                  # Proxy routes to Gemini & AnkiConnect
    error.tsx             # Global layout error fallback page
  components/             # UI Components (LanguageSwitcher, JpUI, ErrorBoundary)
  hooks/                  # Custom state hooks (JapanificationState, useApiCall)
  core/                   # Core local-first services & DB
    db.ts                 # IndexedDB database definition (Dexie.js)
    scheduler.ts          # Dual-state FSRS mathematical scheduling engine
    localDeckService.ts   # Starter deck importer and local DB manager
    types.ts              # Core type definitions
    pluginRegistry.ts     # Interface for custom data sources & plugins
  lib/
    dict/                 # SQLite dictionary lookup script and helper
    gemini/               # Gemini content generation, fallbacks, & withRetry wrapper
    logger.ts             # Structured log writer
    profile.ts            # Namespaced profile storage helpers
    csrf.ts               # CSRF verification helper
```

---

## Development & Diagnostic Sandbox

All temporary, diagnostic, and scratch scripts used for testing or debugging during development are stored in the `scratch/` directory.

To prevent clutter, avoid residual resource pollution, and ensure full traceability of all temporary activities, the project enforces a strict logging policy:
- **Permanent Registry**: Every temporary script is registered in [scratch/SCRATCH_LOG.md](file:///c:/YomuMogu/scratch/SCRATCH_LOG.md) upon creation.
- **Audit History**: Deleted scripts remain in the registry permanently. If the project exhibits unexplained behaviors or leftover resources, refer to [scratch/SCRATCH_LOG.md](file:///c:/YomuMogu/scratch/SCRATCH_LOG.md) to trace the history of past scratch files and their documented side-effects (e.g., test databases, Anki decks, mock configs).
- **Cleanup Requirement**: Before deleting any temporary file, developers (and AI assistants) must run its cleanup routines to purge its side-effects from local storage and Anki.

---

## Troubleshooting

### Anki Connect Offline Error
- **Symptom**: Settings or results screen displays a connection failure banner.
- **Fix**: Verify that Anki is open and running on your local machine, and the AnkiConnect plugin is configured properly.

### SQLite / Native Node Module Error
- **Symptom**: Node throws errors when trying to read SQLite database on Windows.
- **Fix**: YomuMogu uses a Python helper script (`lookup.py`) running in a subprocess via `execFile` to eliminate native binary compile issues. Ensure Python 3.11+ is in your system path.

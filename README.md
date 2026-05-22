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
- **Integration Tests** (online, uses real Gemini API key):
  ```powershell
  npm run test:integration
  ```
- **Anki Integration Tests** (uses real local Anki Desktop):
  ```powershell
  npm run test:anki
  ```

> [!WARNING]
> **Anki Integration Testing Guidelines & Safety:**
> - Running integration tests (`npm run test:integration` or `npm run test:anki`) connects directly to your active Anki Desktop profile via AnkiConnect.
> - The tests create a temporary deck named `Test YomuMogu`, add test cards, perform bilateral sync, and automatically delete the deck upon completion.
> - **Strongly Recommended**: Switch to an isolated, unsynced Anki profile (e.g., `YomuMoguTest`) in Anki Desktop before running these tests. Do not run tests on your primary study profile to avoid polluting your card review history or syncing test garbage to your AnkiWeb account.


---

## Key Features

- **Gamified Start Menu & Mascot**: Beautiful bobbing cup mascot 🍵 with adaptive Furigana speech bubble greetings depending on the user's current Japanification level. Includes 3D overlay modals for Stats (XP progress tracker) and a tabbed Help documentation guide.
- **Refined Chat Exit & Confirmation Flow**: Supports non-destructive back navigation from the active chat directly to the dashboard, and features a dedicated "Завершить" button with a custom 3D confirmation modal to transition into the Bonus Test.
- **Anki Deck Integration**: Automatically imports cards from selected Anki decks, prioritizing new/learning status words.
- **Dynamic Scenario Generation**: Leverages Gemini to build custom practice dialogue sessions based on selected vocab.
- **Target Word Concealment**: Persona-based AI hides target words until used by the user, prompting natural retrieval.
- **Interactive Grammar Feedback**: Evaluates Cyrillic/Russian input errors and Japanese grammatical correctness on the fly.
- **Furigana Rendering**: Multi-level furigana display rules using `<ruby>` tags based on user preference.
- **Language Switcher Dropdown**: Compact 3D Duolingo-styled global language switcher dropdown in the header, letting the user switch between Russian (`ru`), Smart progressive immersion (`smart`), and Japanese (`ja`) modes.
- **Granular UI FSRS Japanification**: Under-the-hood smart localization wrapper component (`<JpUI>`) and provider (`JpUIProvider`) driven by the `ts-fsrs` mathematical scheduler. In Smart mode, it dynamically translates UI elements (up to 1 new word per session), plays gold pulse animations on new translations, provides hover translation tooltips, and supports interactive FSRS assessments ("Забыл" / "Знаю") directly in the UI. All user-facing "Japanification" branding is hidden (referred to as Immersion / "Погружение" or "Уровень" in Russian).
- **Chat Session Persistence**: Automatically serializes and restores complete chat history, targets, and progress states across page reloads and navigation. In-progress sessions can be resumed via homepage or settings CTA buttons.
- **Multi-Profile Isolation**: Isolates learning progress, XP statistics, imported words, and active chat states under unique profile namespaces to support multiple local users.
- **Local-First Database Cache**: Caches imported decks and review logs locally using a Dexie.js (IndexedDB) database for high responsiveness and offline capability.
- **Bilateral FSRS Sync**: Synchronizes local review logs and card states with local Anki Desktop using a robust synchronizer featuring query deduplication (idempotence), FSRS parameter approximation (`stability = interval`, `difficulty = 5.0`, `reps = 1`) to preserve mature card history, and 4:00 AM day boundary alignment.
- **Session Completion Flow**:
  - *Bonus Test*: Interactive written translation quiz for unused target words.
  - *Gemini-Powered Chat Audit*: Automatically extracts new N4+ vocabulary used during practice.
  - *Offline Dictionary lookup*: Integrates JitenDex offline dictionary definitions (HTML).
  - *Anki Review Sync*: Seamlessly checks Anki card status to sync reviews or create new cards.

---

## Architecture Overview

```
src/
  app/                    # Next.js pages and API routes
    page.tsx              # Root landing page & dashboard start menu
    chat/                 # Conversation UI & Bonus/Sync flow
    settings/             # Deck imports, session list, XP profiles
    api/                  # Proxy routes to Gemini & AnkiConnect
  hooks/                  # Custom state hooks (JapanificationState)
  lib/
    anki/                 # AnkiConnect client, card filtering, & FSRS scheduler
    dict/                 # SQLite dictionary lookup script and helper
    gemini/               # Gemini content generation, fallbacks, & withRetry wrapper
    db.ts                 # Client-side IndexedDB database (Dexie.js)
    logger.ts             # Structured log writer
    profile.ts            # Namespaced profile storage helpers
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

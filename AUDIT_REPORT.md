
# Audit Report: Anki-Centric Dependencies in YomuMogu

## 1. Executive Summary

YomuMogu is a Japanese‑language learning web application that currently treats **Anki Desktop (via AnkiConnect) as its
primary data backend**. The entire import, review, and synchronization pipeline is built around Anki’s card model, and
the user interface presents Anki as a central, required feature.

A significant amount of **independent logic already exists** – a local IndexedDB database (Dexie.js), a local starter
deck (500 words), offline FSRS scheduling, and a fully functional chat system that does not require Anki. However, the
codebase is tightly coupled to Anki in many places, making the refactoring to an optional plugin non‑trivial.

This report identifies every Anki dependency, documents existing standalone code, proposes a modular architecture for
decoupling, suggests front‑end changes to demote Anki, and highlights risks.

---

## 2. Current State (Anki Dependencies)

### 2.1 Backend / API Routes

| File | Lines / Dependencies | Severity |
|---|---|---|
| `src/app/api/anki/connect/route.ts` | Entire file – pings AnkiConnect. | High |
| `src/app/api/anki/decks/route.ts` | Entire file – fetches deck list from AnkiConnect. | High |
| `src/app/api/anki/words/route.ts` | Entire file – fetches cards from AnkiConnect. | High |
| `src/app/api/anki/sync/route.ts` | Entire file – syncs review grades to AnkiConnect. | High |
| `src/app/api/anki/sync-db/route.ts` | Entire file – bilateral sync with AnkiConnect. | High |
| `src/app/api/anki/setup-deck/route.ts` | Entire file – creates deck/note type in AnkiConnect. | High |
| `src/app/api/anki/add/route.ts` | Entire file – adds cards to AnkiConnect. | High |
| `src/app/api/chat/analyze/route.ts` | Uses `deckName`, `frontField`, `backField` from Anki; calls
`ankiClient.getCardsInfo`. | Medium |
| `src/app/api/chat/route.ts` | No direct Anki calls, but `targetWords` originate from Anki import. | Low |
| `src/app/api/chat/hint/route.ts` | No direct Anki calls. | Low |
| `src/app/api/gemini/sessions/route.ts` | Input `words` come from Anki import. | Low |

### 2.2 Frontend / UI Components

| File | Lines / Dependencies | Severity |
|---|---|---|
| `src/app/settings/page.tsx` | Entire page is centered around Anki: deck selector, import button, sync buttons,
“Standard” deck mode (creates Anki deck). The “Local” mode exists but is secondary. | High |
| `src/app/chat/page.tsx` | Uses `deckName`, `frontField`, `backField` for analysis; sync buttons reference Anki. |
Medium |
| `src/app/page.tsx` | No direct Anki references, but the “Start” button leads to settings which require Anki. | Low |
| `src/components/JpUI.tsx` | No Anki references. | None |
| `src/components/JpUIProvider.tsx` | No Anki references. | None |
| `src/components/LanguageSwitcher.tsx` | No Anki references. | None |
| `src/components/ErrorBoundary.tsx` | No Anki references. | None |
| `src/components/ErrorFallback.tsx` | No Anki references. | None |

### 2.3 Library / Service Layer

| File | Lines / Dependencies | Severity |
|---|---|---|
| `src/lib/anki/client.ts` | Entire file – `AnkiConnectClient` class, all methods call AnkiConnect. | High |
| `src/lib/anki/filter.ts` | Entire file – `filterAndClassifyCards()` expects Anki card data. | High |
| `src/lib/anki/fsrs.ts` | FSRS scheduler – currently used only for Anki cards, but could be reused for local cards. |
Medium |
| `src/lib/db.ts` | Contains `syncLocalDatabaseWithAnki()` which calls `/api/anki/sync-db`. | High |
| `src/lib/deck/localDeckService.ts` | Independent – works without Anki. | None |
| `src/lib/gemini/client.ts` | No Anki references. | None |
| `src/lib/gemini/chat.ts` | No Anki references. | None |
| `src/lib/gemini/retry.ts` | No Anki references. | None |
| `src/lib/gemini/prompts.ts` | No Anki references. | None |
| `src/lib/profile.ts` | No Anki references. | None |
| `src/lib/csrf.ts` | No Anki references. | None |
| `src/lib/logger.ts` | No Anki references. | None |
| `src/lib/dict/jitendex.ts` | No Anki references. | None |

### 2.4 Configuration / Documentation

| File | Lines / Dependencies | Severity |
|---|---|---|
| `PROJECT_LOGIC.md` | Entire document describes Anki as primary backend. | High |
| `CONTEXT_PROMPT.md` | Many rules assume Anki is required. | Medium |
| `README.md` | Prerequisites list Anki as required. | Medium |
| `CHANGELOG.md` | Many entries describe Anki‑related changes. | Low |
| `ROADMAP.md` | Mentions AnkiWeb cloud integration. | Low |

### 2.5 Summary of Anki Dependency Count

- **Backend API routes**: 7 files (all high severity)
- **Frontend pages**: 2 files (high/medium)
- **Library services**: 4 files (high/medium)
- **Documentation**: 4 files (medium/low)

---

## 3. Existing Independent Logic (Standalone Foundation)

The following code already works **without any Anki connection**:

| Component | Description |
|---|---|
| **Local IndexedDB Database** (`src/lib/db.ts`) | Stores words, reviews, UI words. All CRUD operations work offline. |
| **Local Starter Deck** (`src/lib/deck/localDeckService.ts`) | 500‑word built‑in deck, diagnostic assessment, daily
quota, FSRS scheduling. |
| **FSRS Scheduler** (`src/lib/anki/fsrs.ts`) | Mathematical scheduler – can be reused for local cards. |
| **Chat System** (`src/app/chat/page.tsx`, `src/lib/gemini/chat.ts`) | Full conversation flow, hint generation,
grammar feedback. No Anki calls during chat. |
| **Gemini Session Generation** (`src/lib/gemini/client.ts`) | Generates sessions from a word list – the word list can
come from local DB. |
| **Japanification / UI FSRS** (`src/components/JpUI.tsx`, `JpUIProvider.tsx`) | Works entirely on local `ui_words`
table. |
| **Profile System** (`src/lib/profile.ts`) | localStorage‑based, no Anki. |
| **Error Handling** (`ErrorBoundary`, `ErrorFallback`) | No Anki. |
| **Language Switcher** (`LanguageSwitcher.tsx`) | No Anki. |
| **Offline Dictionary** (`src/lib/dict/jitendex.ts`) | No Anki. |

**Key insight**: The chat, session generation, FSRS scheduling, and UI immersion system are already Anki‑agnostic. The
only missing piece is a **local word source** that does not require Anki import.

---

## 4. Architectural Plan for Decoupling (Backend)

### 4.1 Core Module (`src/core/`)

Create a new directory `src/core/` that contains all Anki‑agnostic logic:

```
src/core/
  db.ts              # IndexedDB operations (move from lib/db.ts, remove syncLocalDatabaseWithAnki)
  scheduler.ts       # FSRS scheduler (move from lib/anki/fsrs.ts)
  localDeckService.ts # Move from lib/deck/localDeckService.ts
  wordSource.ts      # Interface for word providers
  types.ts           # Core types (AnkiWord, LocalWord, etc.)
```

**`wordSource.ts`** defines an interface:

```typescript
export interface WordSource {
  name: string;
  getWords(): Promise<LocalWord[]>;
  addWord(word: LocalWord): Promise<void>;
  syncReviews(reviews: LocalReview[]): Promise<void>;
}
```

### 4.2 Anki Plugin (`src/plugins/anki/`)

Move all Anki‑specific code into a plugin directory:

```
src/plugins/anki/
  client.ts          # AnkiConnectClient (from lib/anki/client.ts)
  filter.ts          # filterAndClassifyCards (from lib/anki/filter.ts)
  wordSource.ts      # Implements WordSource using AnkiConnect
  api/               # API routes (move from app/api/anki/)
    connect/route.ts
    decks/route.ts
    words/route.ts
    sync/route.ts
    sync-db/route.ts
    setup-deck/route.ts
    add/route.ts
```

The plugin registers itself with the core via a **plugin registry**:

```typescript
// src/core/pluginRegistry.ts
export interface Plugin {
  name: string;
  wordSource?: WordSource;
  // other hooks
}

const plugins: Plugin[] = [];

export function registerPlugin(plugin: Plugin) {
  plugins.push(plugin);
}

export function getWordSources(): WordSource[] {
  return plugins.filter(p => p.wordSource).map(p => p.wordSource!);
}
```

### 4.3 Dependency Inversion

- The core module **never imports** from `src/plugins/anki/`.
- The plugin imports from `src/core/` (e.g., `WordSource` interface, `db.ts`).
- At application startup (e.g., in `layout.tsx` or a server initializer), the Anki plugin is conditionally loaded:

```typescript
if (process.env.ANKI_ENABLED === 'true') {
  const { AnkiPlugin } = await import('@/plugins/anki');
  registerPlugin(new AnkiPlugin());
}
```

### 4.4 API Route Restructuring

- Keep `/api/anki/*` routes inside the plugin (they will only be registered if the plugin is active).
- Create a new `/api/words` route in the core that returns words from the **active word source** (local deck or Anki).
- The chat analyze route should use the core word source instead of directly calling Anki.

---

## 5. Frontend Demotion Plan (UI/UX)

### 5.1 Main Dashboard (`/`)

- **Current**: “Start” button leads to settings that require Anki.
- **Proposed**: The dashboard should work immediately with the local starter deck. Add a prominent “Начать практику”
(Start Practice) button that uses the local deck by default.
- Move “Подключить Anki” (Connect Anki) to a secondary “Интеграции” (Integrations) section.

### 5.2 Settings Page (`/settings`)

- **Current**: Three tabs: Профиль, Импорт & Anki, Облако.
- **Proposed**: Rename “Импорт & Anki” to “Источник слов” (Word Source). The first option should be “Локальная колода”
(Local Deck) – already exists but should be the default and highlighted.
- Move all Anki‑specific controls (deck selector, import button, sync buttons) into a sub‑section “Интеграция с Anki”
that is collapsed by default.
- Add a toggle “Использовать Anki” (Use Anki) that, when off, hides all Anki UI.

### 5.3 Chat Page (`/chat`)

- **Current**: Sync buttons and analysis assume Anki.
- **Proposed**: The “Анализ” (Analyze) button should work with the local word source. The sync buttons should only
appear if Anki integration is enabled.
- Add a small indicator “Источник: Локальная колода” or “Источник: Anki” in the header.

### 5.4 Navigation / Labels

- Replace “Anki” with “Интеграции” in the main navigation.
- In the settings tab, rename “Импорт & Anki” to “Источник слов”.
- In the chat summary, rename “Синхронизировать с Anki” to “Синхронизировать” (if Anki is active) or hide it.

### 5.5 Onboarding Flow

- **Current**: First‑time user must connect Anki.
- **Proposed**: First‑time user is offered the local starter deck immediately. A small “Подключить Anki” link is
available but not required.

---

## 6. Risks and Open Questions

### 6.1 Tight Coupling in `syncLocalDatabaseWithAnki`

The function `syncLocalDatabaseWithAnki()` in `src/lib/db.ts` is deeply coupled to the Anki sync‑db route. It is called
from multiple places (chat summary, settings). Refactoring this to be plugin‑aware will require changing all call
sites.

**Mitigation**: Introduce a `syncService` in the core that delegates to the active plugin’s sync method.

### 6.2 `AnkiWord` Type Pervasiveness

The `AnkiWord` interface is used throughout the codebase – in chat, session generation, UI components. Changing its
name or structure will affect many files.

**Mitigation**: Keep `AnkiWord` as a core type (rename to `CardWord` or `WordItem`) and have the Anki plugin map its
data to this type.

### 6.3 `filterAndClassifyCards` Logic

The card classification logic (`filter.ts`) is tightly coupled to Anki’s internal queue/interval values. A local deck
uses different statuses.

**Mitigation**: Move classification into the plugin. The core should only deal with `status` as a string, not the logic
to derive it.

### 6.4 API Route Registration

Next.js App Router does not support dynamic route registration easily. The `/api/anki/*` routes are currently static
files.

**Mitigation**: Keep the route files in place but guard them with a check for `process.env.ANKI_ENABLED`. If disabled,
return a 404 or a message “Anki integration is not enabled”. This is a pragmatic compromise.

### 6.5 Test Coverage

Many unit tests mock Anki calls. After decoupling, tests for the core module must not depend on Anki mocks.

**Mitigation**: Separate test suites: `npm run test:core` (no Anki mocks) and `npm run test:anki` (with Anki mocks).
Update `vitest.config.ts` accordingly.

### 6.6 User Data Migration

Users who currently have Anki‑imported words in IndexedDB will need a migration path when switching to local‑only mode.

**Mitigation**: Provide a one‑time migration script that copies Anki words into the local deck format, preserving FSRS
state.

### 6.7 Documentation Updates

`PROJECT_LOGIC.md`, `CONTEXT_PROMPT.md`, and `README.md` all assume Anki is primary. They must be updated after the
refactoring.

**Mitigation**: Schedule a documentation update as the final step of the refactoring.

---

## Appendix: Quick Reference of Files Requiring Changes

| File | Change Type |
|---|---|
| `src/lib/db.ts` | Remove `syncLocalDatabaseWithAnki`, add core DB |
| `src/lib/anki/client.ts` | Move to plugin |
| `src/lib/anki/filter.ts` | Move to plugin |
| `src/lib/anki/fsrs.ts` | Move to core (rename) |
| `src/lib/deck/localDeckService.ts` | Move to core |
| `src/app/api/anki/*` | Move to plugin (or guard) |
| `src/app/api/chat/analyze/route.ts` | Use core word source |
| `src/app/settings/page.tsx` | Restructure UI |
| `src/app/chat/page.tsx` | Conditionally show Anki UI |
| `src/app/page.tsx` | Default to local deck |
| `PROJECT_LOGIC.md` | Update architecture description |
| `CONTEXT_PROMPT.md` | Update coding rules |
| `README.md` | Update prerequisites |
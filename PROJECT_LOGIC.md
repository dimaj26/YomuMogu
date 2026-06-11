# PROJECT_LOGIC.md — YomuMogu Technical Reference

## [PL-1] PROJECT IDENTITY & STACK

| Property | Value |
|---|---|
| **App Name** | YomuMogu |
| **Purpose** | Japanese learning via Anki + Gemini AI conversation practice |
| **Runtime** | Node.js 20+ / Next.js 16 (App Router) |
| **Language** | TypeScript (strict mode) |
| **UI** | React 19 client components, Vanilla CSS Modules |
| **AI** | Google Gemini API (`@google/genai`), models: `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite` |
| **Anki** | AnkiConnect HTTP API (local, port 8765) |
| **Storage** | localStorage (client profile data), `process.env` (secrets), `logs/` (file logs) |
| **Testing** | Vitest + @testing-library/react (unit) / `vitest.integration.config.ts` (real API) |
| **Dev Server** | `npm run dev` → http://localhost:3000 |
| **OS** | Windows / PowerShell |

---

## [PL-2] ARCHITECTURAL OVERVIEW

### [PL-2.1] App Structure

```
src/
  app/                    # Next.js App Router pages + API routes
    page.tsx              # Root landing page / gamified dashboard
    page.module.css       # Root landing page CSS module
    layout.tsx            # Root layout (Nunito font, global CSS)
    globals.css           # Design system tokens, global classes
    settings/             # /settings page — Anki config, profile switching, and field mapping configurations
      page.tsx
      settings.module.css
      __tests__/page.test.tsx
    practice/             # /practice page — Practice launcher, session management, scenario generation
      page.tsx
      practice.module.css
      __tests__/page.test.tsx
      quiz/               # /practice/quiz page — Active Recall FSRS quiz interface
        page.tsx
        quiz.module.css
        __tests__/page.test.tsx
    chat/                 # /chat page — AI conversation interface
      page.tsx
      chat.module.css
    error.tsx             # Global Next.js error boundary page
    api/
      anki/               # Anki proxy routes (server → AnkiConnect)
        connect/route.ts  # GET  /api/anki/connect
        decks/route.ts    # GET  /api/anki/decks
        words/route.ts    # GET  /api/anki/words
        sync/route.ts     # POST /api/anki/sync
          __tests__/sync.test.ts
        sync-db/route.ts  # POST /api/anki/sync-db (bilateral FSRS sync)
          __tests__/sync-db.test.ts
        setup-deck/route.ts # POST /api/anki/setup-deck (create deck + model)
          __tests__/setup-deck.test.ts
        add/route.ts      # POST /api/anki/add
          __tests__/add.test.ts
        __tests__/connect.test.ts
      words/
        route.ts          # GET  /api/words (plugin-aware word source with local DB fallback)
      gemini/
        sessions/route.ts # POST /api/gemini/sessions
        etymology/route.ts # POST /api/gemini/etymology
        classify/
          route.ts        # POST /api/gemini/classify
        grammar-verify/
          route.ts        # POST /api/gemini/grammar-verify
        __tests__/sessions.test.ts, etymology.test.ts, grammar-verify.test.ts, classify.test.ts
      chat/
        route.ts          # POST /api/chat (send message)
        hint/route.ts     # POST /api/chat/hint (generate hints)
        analyze/route.ts  # POST /api/chat/analyze
        __tests__/chat.test.ts, analyze.test.ts
        hint/__tests__/hint.test.ts
      dict/
        lookup/route.ts   # GET  /api/dict/lookup (offline JitenDex query)
      media/
        parse/route.ts    # POST /api/media/parse (YouTube/file subtitle scraping & parsing)
          __tests__/parse.test.ts
        tokenize/route.ts # POST /api/media/tokenize (morphological analyzer proxy)
          __tests__/tokenize.test.ts
  hooks/
    useJapanification.tsx # XP progression, level, speed, chatLevel state
    useQuests.ts          # Daily quests state tracking (reviews, chats, mnemonics)
    useMediaRecommendation.ts # Smart video/podcast recommendation CR/FSRS overlaps hook
    useApiCall.ts         # Custom hook consolidating client-side loading, error state, and retry logic
    __tests__/
      useJapanification.test.ts
      useQuests.test.ts   # Unit tests for useQuests hook
      useApiCall.test.ts  # Unit tests for useApiCall hook
      useMediaRecommendation.test.ts # Unit tests for useMediaRecommendation hook
  core/
    db.ts                 # Decoupled IndexedDB database
    localDeckService.ts   # Local word management
    scheduler.ts          # FSRS math scheduling
    pluginRegistry.ts     # WordSource and Plugin interfaces
    types.ts              # Core types
  plugins/
    anki/                 # Anki integration plugin
      client.ts
      filter.ts
      wordSource.ts
      index.ts
      __tests__/
        client.test.ts
        filter.test.ts
        sync.integration.test.ts
  extension/              # Browser extension files for YouTube subtitles
    manifest.json
    background.js
    content.js
  components/
    JpUIProvider.tsx      # UI FSRS word state provider
    JpUI.tsx              # Granular Smart Japanification wrapper
    JpUI.module.css       # JpUI CSS module (tooltips, pulse animation)
    LanguageSwitcher.tsx  # Compact global Language Switcher dropdown component
    LanguageSwitcher.module.css # Styles for LanguageSwitcher dropdown
    PhonosemanticHint.tsx # Accordion component displaying phonosemantic keys and relatives
    PhonosemanticHint.module.css # Styles for PhonosemanticHint accordion
    DebugDrawer.tsx       # Client component implementing the sliding debug drawer HUD
    DebugDrawer.module.css # Styles for the DebugDrawer
    LearningTrack.tsx     # Duolingo winding SVG track client component
    LearningTrack.module.css # Styles for the LearningTrack component
    GrammarTrack.tsx      # Duolingo winding SVG path client component for grammar rules
    GrammarTrack.module.css # Styles for the GrammarTrack component
    GrammarTrainer.tsx    # Interactive overlays displaying theory and AI feedback for grammar rules
    GrammarTrainer.module.css # Styles for the GrammarTrainer component
    MediaInteractivePlayer.tsx # Interactive subtitle player component supporting YouTube/Audio media
    MediaInteractivePlayer.module.css # CSS module for MediaInteractivePlayer
    __tests__/
      ErrorBoundary.test.tsx
      ErrorFallback.test.tsx
      DebugDrawer.test.tsx # Unit tests for DebugDrawer component
      JpUI.test.tsx        # Unit tests for JpUI component FSRS opacity
      LearningTrack.test.tsx # Unit tests for LearningTrack component
      GrammarTrack.test.tsx  # Unit tests for GrammarTrack component
      GrammarTrainer.test.tsx # Unit tests for GrammarTrainer component
      MediaInteractivePlayer.test.tsx # Unit tests for MediaInteractivePlayer component
  resources/
    phonosemantics.json   # 50 phonosemantic keys and relative kanji data
    situational_dictionary.json # Static situational tags mapping for 500 N5 words
    starter_deck.json     # 500-word offline starter vocabulary deck
    grammar_rules.json    # 7-step JLPT N5 grammar curriculum (IDs: g_n5_s1_1..g_n5_s6)
    media_feed.json       # Static metadata for recommended video/podcast channels
    media_transcripts.json # Pre-generated timed transcripts for recommended YouTube videos
  services/
    tokenizer/
      server.py           # MeCab FastAPI microservice (port 8000)
      Dockerfile          # Container definition for MeCab service
  lib/
    logger.ts             # Structured logger (debug/info/warn/error → logs/)
    profile.ts            # localStorage profile helpers + multi-profile management
    csrf.ts               # CSRF protection helpers (same-origin Origin/Referer verification)
    sanitize.ts           # DOMPurify HTML sanitization utility for dangerouslySetInnerHTML
    media/
      youtube.ts          # Zero-dependency Japanese YouTube caption extractor
      parser.ts           # SRT/VTT subtitle parser and duration rounding utility
```

### [PL-2.2] File Registry

| File | Role |
|---|---|
| `core/db.ts` | Dexie.js client-side database definitions, schemas, and FSRS transaction helpers |
| `core/scheduler.ts` | Polymorphic FSRS mathematical calculation engine supporting active/passive states |
| `core/localDeckService.ts` | Offline local starter deck service and local db operations |
| `core/types.ts` | Central TypeScript interface definitions for db schemas, reviews, and FSRS states |
| `core/pluginRegistry.ts` | Interfaces for custom learning plugins and active `WordSource` providers |
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
| `lib/media/youtube.ts` | Zero-dependency Japanese YouTube caption extractor; json3-first (`fmt=json3` → `parseJson3ToSegments`), XML fallback with Russian logs per path |
| `lib/media/parser.ts` | SRT/VTT subtitle file parser; `SubtitleSegment` interface (incl. optional `words[]`, `source`); `normalizeSegments` — sticky timing, gap-fill, overlap clamp, last-segment duration cap |
| `lib/media/json3.ts` | TypeScript json3 subtitle parser: `parseJson3ToSegments(data)` preserving per-word `offsetMs` from `segs[].tOffsetMs` |
| `lib/media/sentences.ts` | Pure `regroupIntoSentences(segments)` — merges consecutive segments until Japanese terminal punctuation (。？！) with 90-char / 15-second safety caps; rebases `words[]` offsetMs |
| `lib/media/availability.ts` | oEmbed/caption availability checker for YouTube videos |
| `lib/media/karaokeQuality.ts` | Pure function `assessKaraokeQuality(segment)` that evaluates if subtitle segments pass quality criteria for karaoke rendering |
| `lib/media/karaokeProgress.ts` | Pure function `computeFillFraction` for piecewise-linear progress interpolation, and `interpolatePlayerTime` for display clock estimation |
| `lib/media/__tests__/availability.test.ts` | Unit tests for media availability helpers |
| `lib/media/__tests__/json3.test.ts` | Unit tests for json3 subtitle parser |
| `lib/media/__tests__/sentences.test.ts` | Unit tests for sentence regrouping logic |
| `lib/media/__tests__/karaokeQuality.test.ts` | Unit tests for karaoke quality gate module |
| `lib/media/__tests__/karaokeProgress.test.ts` | Unit tests for karaoke progress interpolation module |
| `lib/media/__tests__/feed.integration.test.ts` | Integration tests verifying oEmbed embedding and caption tracks in media feed |
| `lib/media/__tests__/feed-language.integration.test.ts` | Integration tests verifying that every video in the recommended feed has a valid Japanese caption track |
| `lib/media/__tests__/transcript-fidelity.integration.test.ts` | Integration tests verifying that pregenerated transcripts match live scraped YouTube captions with high fidelity |
| `components/MediaInteractivePlayer.tsx` | Subtitle-synchronized player component: sticky segment matching, quality-gated smooth progress fill karaoke rendering, requestAnimationFrame display clock resynchronization, sentence regrouping pipeline, CC dedup (`cc_load_policy` conditional, extension priority guard, CC toggle button) |
| `components/__tests__/MediaInteractivePlayer.test.tsx` | Unit tests for MediaInteractivePlayer component |
| `hooks/useMediaRecommendation.ts` | Hook calculating Comprehension Rate (CR) and FSRS-due vocabulary matches for videos |
| `hooks/__tests__/useMediaRecommendation.test.ts` | Unit tests for useMediaRecommendation hook |
| `resources/media_feed.json` | Static metadata list of recommended video channels/audio podcast feeds |
| `resources/media_transcripts.json` | Pre-generated timed dialogues/monologues JSON transcripts for recommended YouTube videos |
| `core/__tests__/tagger.test.ts` | Unit tests for tagger, FSRS routing, and session grouping helpers |
| `components/PhonosemanticHint.tsx` | Accordion component displaying phonosemantic keys and relative kanji |
| `components/DebugDrawer.tsx` | Client component implementing the sliding debug drawer HUD |
| `resources/phonosemantics.json` | 50 phonosemantic keys and relative kanji data |
| `resources/situational_dictionary.json` | Static situational tags mapping for 500 N5 words |
| `app/practice/quiz/page.tsx` | Gamified Active Recall quiz component supporting ad-hoc, FSRS modes, mnemonics, and phonosemantic hints |
| `lib/dict/jitendex.ts` | `lookupWord(word)` — offline SQLite JitenDex dictionary lookup |
| `lib/dict/lookup.py` | Python script invoked via Node `execFile` to query SQLite dictionary database |
| `lib/gemini/client.ts` | `GeminiClient.generateSessions(words)`, `generateEtymology(word)` — singleton `geminiClient` |
| `lib/gemini/chat.ts` | `ChatService.sendMessage()`, `ChatService.generateHints()` — singleton `chatService` |
| `lib/gemini/prompts.ts` | Centralized prompt templates for Gemini AI character persona and difficulty levels |
| `lib/gemini/retry.ts` | Singleton wrapper implementing exponential backoffs and model fallback loops |
| `lib/gemini/__tests__/scenarios.integration.test.ts` | Integration tests verifying multi-turn conversational scenarios against live Gemini API |
| `scratch/SCRATCH_LOG.md` | Permanent historical audit registry tracking sandbox scripts and side effects |
| `hooks/useQuests.ts` | React custom hook managing namespaced daily quest progression and XP rewards |
| `components/LearningTrack.tsx` | Duolingo winding vertical pathway component with 3D nodes and popovers |
| `components/__tests__/LearningTrack.test.tsx` | Unit tests for LearningTrack component rendering and popover triggers |
| `components/GrammarTrack.tsx` | Duolingo winding SVG path component for 7-step N5 grammar curriculum with linear unlock chain (1.1→1.2→2→3→4→5→6) |
| `components/GrammarTrainer.tsx` | Interactive overlays explaining grammar theory and prompting user custom sentences checked by AI |
| `components/__tests__/GrammarTrainer.test.tsx` | Unit tests verifying GrammarTrainer component rendering and interactive sandbox |
| `src/resources/grammar_rules.json` | 7-step JLPT N5 grammar curriculum JSON (IDs: `g_n5_s1_1`..`g_n5_s6`) aligned with Morphology-Before-Syntax pedagogy |
| `app/api/gemini/grammar-verify/route.ts` | POST endpoint using Gemini client to verify user Japanese sentences against grammar rules |
| `app/api/gemini/__tests__/grammar-verify.test.ts` | Unit tests verifying the grammar verification API route behavior under standard inputs |
| `app/api/anki/sync-db/route.ts` | POST endpoint for bilateral FSRS sync between IndexedDB and Anki; handles deduplication, bulk queries, FSRS approximation |
| `app/api/anki/sync-db/__tests__/sync-db.test.ts` | Unit tests for sync-db route |
| `app/api/anki/setup-deck/route.ts` | POST endpoint to create a YomuMogu deck and note model in Anki if absent |
| `app/api/anki/setup-deck/__tests__/setup-deck.test.ts` | Unit tests for setup-deck route |
| `app/api/words/route.ts` | GET endpoint resolving words via active `WordSource` plugin or local IndexedDB fallback |
| `services/tokenizer/server.py` | FastAPI MeCab microservice providing morphological analysis on port 8000; `GET /health` returns `{status:'ok'\|'error'}` |
| `services/tokenizer/Dockerfile` | Docker container definition for the MeCab tokenizer service |
| `scripts/generate-transcripts.mjs` | Node script to scrape real `ja` captions for all feed videos and output `media_transcripts.json` |
| `tests/e2e/media-live.spec.ts` | Playwright E2E tests verifying real Japanese subtitle player interaction, karaoke highlighting, and dictionary lookup |
| `tests/e2e/media-tokenizer-down.spec.ts` | Playwright E2E tests verifying player degradation, warning banner, and disabled highlights when tokenizer is offline |

---


## [PL-3] DATA SCHEMA & STORAGE

### [PL-3.1] localStorage Key Namespace
All client data stored under: `yomumogu_profile_${profileId}_${key}`

Default profile ID: `default`

| Key | Type | Content |
|---|---|---|
| `japanification` | JSON `JapanificationState` | uiMode, points (XP), level, percentage, speed, totalWordsUsed, sessionsCompleted, showTranslationsAlways, chatLevel |
| `selected_deck` | string | Anki deck name |
| `front_field` | string | Anki front field name (Japanese) |
| `back_field` | string | Anki back field name (Russian) |
| `words` | JSON `AnkiWord[]` | Imported Anki cards |
| `sessions` | JSON `GeneratedSession[]` | AI-generated conversation sessions |
| `active_session` | JSON `SessionData` | Currently selected session for `/chat` |
| `chat_state_${sessionId}` | JSON `SavedChatState` | Saved chat session progress (messages, state, collected words) |
| `quota_preset` | string | Preset selection for daily new words quota ('easy', 'standard', 'hard', 'custom') |
| `daily_new_words_limit` | string | Custom daily limit of new words (validated between 1 and 50) |
| `daily_new_words_${YYYY-MM-DD}` | string | Number of new words studied on a specific date |
| `daily_new_words_limit_offset_${YYYY-MM-DD}` | string | Daily limit offset for new words on a specific date |
| `deck_mappings` | JSON `Record<string, { frontField: string; backField: string; audioField?: string; imageField?: string }>` | Per-deck field mapping configurations |

Profile metadata (not namespaced):
- `yomumogu_active_profile_id` — active profile ID string
- `yomumogu_profiles` — JSON `ProfileInfo[]` — list of all profiles

### [PL-3.2] Legacy Key Migration
`getProfileItem(key)` automatically migrates from legacy format `yomumogu_${key}` to `yomumogu_profile_default_${key}` for the `default` profile only.

### [PL-3.3] Core TypeScript Interfaces

```typescript
// AnkiWord (plugins/anki/filter.ts)
interface AnkiWord {
  id: number;
  word: string;        // Japanese
  translation: string; // Russian
  interval: number;    // days
  status: 'new' | 'learning' | 'review' | 'mature';
  deckName: string;
  rawFront: string;
  rawBack: string;
  tags?: string[];
}

// GeneratedSession (lib/gemini/client.ts)
interface GeneratedSession {
  id: string;
  title: string;
  description: string;
  scenario: string;
  targetWords: TargetWord[];
}

// JapanificationState (hooks/useJapanification.ts)
type UiMode = 'ru' | 'smart' | 'ja';

interface JapanificationState {
  uiMode: UiMode;
  level: number;             // 0–6 (virtual level)
  percentage: number;        // 0–100
  speed: 'slow'|'normal'|'fast';
  points: number;
  totalWordsUsed: number;
  sessionsCompleted: number;
  showTranslationsAlways: boolean;
  chatLevel: number;         // 1–5 (Japanese difficulty in chat)
}

// ProfileInfo (lib/profile.ts)
interface ProfileInfo {
  id: string;
  name: string;
  createdAt: string;
}

// AnalyzedWord (app/api/chat/analyze/route.ts)
interface AnalyzedWord {
  word: string;
  reading: string;
  translation: string;
  definitionHtml: string;
  inAnki: boolean;
  cardId?: number;
  status?: 'new' | 'learning' | 'review' | 'mature';
  isDue: boolean;
}

// SavedChatState (src/app/chat/page.tsx)
interface SavedChatState {
  messages: ChatMessageData[];
  collectedWords: string[];
  isComplete: boolean;
  showBonusTest: boolean;
  unusedTargetWords: TargetWord[];
  currentBonusIndex: number;
  bonusInput: string;
  bonusChecked: boolean;
  bonusFeedback: { isCorrect: boolean; message: string } | null;
  showSummaryScreen: boolean;
  analyzedWords: AnalyzedWord[];
  selectedSyncCards: number[];
  selectedAddWords: string[];
  syncCardGrades?: Record<number, number>;
  showExitConfirm?: boolean;
}

// ChatMessageData (src/app/chat/page.tsx)
interface ChatMessageData {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string;
  grammarFeedback?: GrammarFeedback;
  wordsDetected?: string[];
}

// GrammarFeedback (src/app/chat/page.tsx)
interface GrammarFeedback {
  isCorrect: boolean;
  correction: string;
  explanation: string;
}

// LocalWord (lib/db.ts)
interface LocalWord {
  profileId: string;
  id: number; // cardId from Anki
  word: string;
  reading: string;
  translation: string;
  category: string; // replaces deckName
  source: 'anki' | 'starter' | 'manual';
  passive: FsrsState;
  active: FsrsState;
  contextExamples?: WordContextExample[];
  mnemonic?: string; // User note / AI etymology
  tags?: string[];
}

interface FsrsState {
  stability: number;
  difficulty: number;
  interval: number; // interval in days
  due: number; // timestamp (ms) of next review
  lastReview?: number; // timestamp of last review
  reps: number;
  lapses: number;
  status: 'new' | 'learning' | 'review' | 'mature';
}

interface WordContextExample {
  sentence: string;
  translation?: string;
  timestamp: number;
}

// LocalReview (lib/db.ts)
interface LocalReview {
  id?: number; // local auto-incrementing ID
  profileId: string;
  cardId: number; // cardId from Anki
  ease: number; // grade (1-4)
  interval: number; // new interval in days
  lastInterval: number; // previous interval in days
  duration: number; // answer duration in ms
  timestamp: number; // timestamp of review in ms
  synced: number; // 0 = unsynced, 1 = synced
  reviewType?: 'passive' | 'active';
}

// UiWord (lib/db.ts)
interface UiWord {
  profileId: string;
  id: string; // HTML element ID
  word: string;
  reading: string;
  translation: string;
  status: 'new' | 'learning' | 'review' | 'mature';
  stability: number;
  difficulty: number;
  interval: number;
  due: number;
  lastReview?: number;
  reps: number;
  lapses: number;
}
```

### [PL-3.4] IndexedDB Schema

For local-first operation and off-session scheduling, YomuMogu maintains client-side storage using Dexie.js (upgraded to Schema Version 5):
- **`words` Table** (`[profileId+id]` compound key):
  - Stores the local replication of Anki cards including calculated FSRS variables and situational tags.
  - Indexes: `id`, `word`, `category`, `passive.due`, `active.due`, `*tags`, `profileId`.
- **`reviews` Table** (`id` auto-increment key):
  - Stores local review logs generated during dialogue practice.
  - Indexes: `[profileId+cardId]`, `cardId`, `timestamp`, `synced`, `profileId`.
- **`ui_words` Table** (`[profileId+id]` compound key):
  - Stores local FSRS progression metrics for each localized UI text snippet.
  - Indexes: `id`, `status`, `due`, `profileId`.
- **`grammar_progress` Table** (`[profileId+ruleId]` compound key):
  - Stores user grammar Leitner progress step intervals.
  - Indexes: `ruleId`, `status`, `due`, `profileId`.

---

## [PL-4] API ROUTE CONTRACTS

### [PL-4.1] Anki Routes
All Anki routes proxy requests to AnkiConnect at `http://localhost:8765`.

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/anki/connect` | GET | — | `{ connected: boolean, error?: string }` |
| `/api/anki/decks` | GET | — | `{ decks: string[] }` |
| `/api/anki/words` | GET | `?deck=&frontField=&backField=&mappings=` | `{ words: AnkiWord[] }` |
| `/api/anki/sync` | POST | `{ cards?: Array<{ cardId: number; ease: number }>, cardIds?: number[] }` | `{ success: boolean }` |
| `/api/anki/sync-db` | POST | `{ profileId, deckName, frontField?, backField?, deckMappings?, localReviews?, localWords?, sessionId? }` | `{ success: boolean, remoteCards: AnkiWord[], remoteReviews: Record<number, AnkiReview[]> }` |
| `/api/anki/setup-deck` | POST | `{ deckName?, modelName? }` | `{ success: boolean, deckName: string, modelName: string }` |
| `/api/anki/add` | POST | `{ deckName, frontField, backField, word, reading, translation, definitionHtml, history?: Array<{ role: string; text: string }>, sessionId? }` | `{ success: boolean }` |

### [PL-4.2] Gemini & Dict Routes

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/gemini/sessions` | POST | `{ words: AnkiWord[] }` | `{ sessions: GeneratedSession[] }` |
| `/api/gemini/etymology` | POST | `{ word }` | `{ components: string[], etymology: string }` |
| `/api/gemini/classify` | POST | `{ words: string[] }` | `{ classifications: Array<{ word: string; tags: string[] }> }` |
| `/api/gemini/grammar-verify` | POST | `{ ruleId, userInput }` | `{ isCorrect: boolean, correction: string, explanation: string }` |
| `/api/chat` | POST | `{ scenario, targetWords, history, message, level, grammarInJapanese, collectedWords? }` | `ChatResponse` |
| `/api/chat/hint` | POST | `{ scenario, targetWords, history, level }` | `HintResponse` |
| `/api/chat/analyze` | POST | `{ history, deckName, frontField, backField, deckMappings? }` | `{ words: AnalyzedWord[] }` |
| `/api/dict/lookup` | GET | `?word=WORD` | `{ definition: string }` |
| `/api/media/parse` | POST | `{ url }` or `{ srtText }` | `{ success: boolean, lemmas: string[], segments: SubtitleSegment[] }` — segments tagged with `source: 'pregenerated' | 'scraped' | 'upload'` |
| `/api/media/tokenize` | POST | `{ text, mode? }` | `{ tokens: MeCabToken[] }` or `{ lemmas: string[] }` or `{ tokenizationSkipped: true, tokens: [], lemmas: [] }` |

### [PL-4.3] ChatResponse & HintResponse
```typescript
interface ChatResponse {
  reply: string;          // Japanese AI response (may contain <ruby> tags on levels 1-3)
  translation: string;    // Russian translation of reply
  grammarFeedback: {
    isCorrect: boolean;
    correction: string;   // Corrected sentence or ""
    explanation: string;  // Explanation in Russian (or Japanese if grammarInJapanese)
  };
  wordsDetected: string[]; // Target words found in user's message
  _debug?: {
    systemInstruction: string;
    contents: any;
  };
}

interface HintResponse {
  hints: Array<{
    level: 'easy' | 'medium' | 'advanced';
    japanese: string;    // May contain <ruby> tags on chat levels 1-3
    translation: string;
  }>;
  _debug?: {
    systemInstruction: string;
    contents: any;
  };
}
```

---

## [PL-5] GEMINI API PATTERNS

### [PL-5.1] Always Use withRetry
```typescript
import { withRetry, GeminiModel } from './retry';

const result = await withRetry(async (model: GeminiModel) => {
  const response = await this.ai.models.generateContent({ model, contents, config });
  if (!response.text) throw new Error('Empty response');
  return JSON.parse(response.text);
});
```

### [PL-5.2] Retry Configuration
- Models: `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite` (automatic fallback chain)
- maxRetries: 3 per model, exponential backoff: 1s → 2s → 4s
- Retryable: HTTP 429, 500, 503. Non-retryable (400, 401): throw immediately.

### [PL-5.3] Structured Output Pattern
Always pair `responseMimeType: 'application/json'` with `responseSchema`. Never rely on free-form JSON parsing.

### [PL-5.4] System Instruction Language Safety
Forbidden words in system instructions (content policy):
- `ролевая игра`, `Роль ИИ`, `Роль пользователя`

Required alternatives:
- `практический диалог`, `персонаж`, `кем является ИИ в этом диалоге`

### [PL-5.5] Furigana Levels
| Chat Level | Furigana Rule |
|---|---|
| 1 (Child) | ALL kanji wrapped in `<ruby>kanji<rt>reading</rt></ruby>`. Ultra-short phrases. |
| 2 (Elementary) | ALL kanji with furigana. Short sentences. |
| 3 (Conversational) | Only N3+ kanji get furigana. |
| 4 (Advanced) | No furigana. Extended sentences. |
| 5 (Fluent) | No furigana. Natural native-level Japanese. |

### [PL-5.6] Target Word Concealment
To prevent "leakage" of target words and encourage user recall:
- **Turns 1-2**: The AI character is strictly forbidden from using, mentioning, or translating any of the target words (in Japanese and Russian) in its responses.
- **Turns 3+**: The AI character can only use target words that the user has already used/detected in previous turns or the latest message. Unused target words remain strictly concealed.

### [PL-5.7] Enforced Japanese Input and Placeholders
- **Hybrid Input (Cyrillic Placeholders)**: If the user uses a Cyrillic/Russian word placeholder in a Japanese sentence (e.g., 'Стулの座って'), `grammarFeedback.isCorrect` is set to `false`, and `grammarFeedback.correction` is populated with the fully corrected Japanese sentence containing the translated placeholder (e.g., '椅子に座って').
- **Entirely Russian Input**: If the user's input is entirely in Russian, `grammarFeedback.isCorrect` is set to `false`, `correction` is populated with the complete Japanese translation of their message, and `explanation` explains the error in Russian.
- **Furigana in Correction**: The corrected sentence in `grammarFeedback.correction` must strictly follow the level's Furigana/Ruby rules (levels 1-2: all kanji wrapped; level 3: N3+ kanji wrapped; levels 4-5: no furigana). On levels 1 and 2, Furigana is strictly kept at 100% of kanji in both reply and correction, completely independent of Japanification level or progress.
- Detection of target words (`wordsDetected`) must base strictly on Japanese text; Russian translations do not trigger detection.

### [PL-5.8] Response and Question Constraints
- **Conversational Coherence**: If the user asks a question (e.g. "What book?", "What to write?"), the AI MUST answer that question in character first before asking its next concrete, situational question.
- **Respond to Corrected Meaning**: The AI response in the `reply` field must be built upon the *intended/corrected* version of the user's sentence (from `grammarFeedback.correction`) rather than interpreting grammatical mistakes literally.
- The AI reply must contain exactly one response message with exactly one question to keep the conversation flowing without stacking questions.
- **Concreteness & Specificity**: General, abstract open questions (e.g., "What are your plans?", "How are you?", "What's on your mind?") are strictly forbidden. The AI must ask highly focused, concrete, situational questions that narrow down options and nudge the user toward using the target words (e.g. asking "Are you thirsty?" to nudge the user to say "I want to drink").
- Tight sentence length limits (under 15/20/30/50 characters depending on level) are verified by the model via a self-count instruction.


### [PL-5.9] Adaptive Reviews & Situational Routing
- **FSRS Stability Gating**: Reviews are adaptively routed between rapid recognition checks (offline translation quiz) and conversation writing (Gemini chat) based on active FSRS stability. If `active.stability < 3` days or `lapses >= 2`, the word is routed to dialog practice; otherwise, it is scheduled for the offline quiz.
- **Situational Clustering**: The system programmatically groups the daily active vocabulary pool using `groupWordsIntoThemes` by finding overlaps among the 10 situational themes (`shopping`, `restaurant`, `travel`, `home`, `work`, `hobbies`, `social`, `health`, `weather`, `education`). It matches nouns matching a specific theme and fills the remaining slots with `universal` verbs and adjectives to form coherent 4-6 word target sets for dialogue practice.
- **Contextual Distractors**: The multiple-choice Warm-up selector queries words matching the target's situational tag to provide high-quality, contextually similar distractors.


---

## [PL-6] ANKI INTEGRATION PATTERNS

### [PL-6.1] AnkiConnect HTTP Protocol
```
POST http://localhost:8765
Body: { "action": "...", "version": 6, "params": {} }
```

### [PL-6.2] Card Status Classification (filter.ts)
| Anki Internal / Condition | YomuMogu Status |
|---|---|
| `effectiveQueue === 0` (or `interval === 0` and `effectiveQueue !== 1` and `effectiveQueue !== 3`) | `new` |
| `effectiveQueue === 1` or `effectiveQueue === 3` | `learning` |
| `effectiveQueue === 2` and card ID is in `dueCardIds` (or fallback `interval < 21`) | `review` |
| `effectiveQueue === 2` and card ID is NOT in `dueCardIds` (or fallback `interval ≥ 21`) | `mature` |

### [PL-6.3] Batch Loading
Cards loaded in batches of 500 (`findCards` → `cardsInfo`). Words array capped at top 100 for UI display; all words passed to Gemini for session generation.
During chat analysis, to prevent lookup issues caused by HTML ruby tags or brackets containing readings (e.g. `笑う[わらう]`), all cards from the selected deck are loaded in-memory once, stripped of Japanese readings/HTML tags, and compared directly.

### [PL-6.4] AI Note Creation & Model Field Inspection
When adding a new card:
1. The route queries `findCards` for the target deck, fetches `getCardsInfo` of the first card, and extracts the model field names ordered by their internal `order` index.
2. If the deck is empty, it falls back to a Basic note type with `Front` and `Back` fields.
3. It constructs a dynamic JSON schema for Gemini using the detected field names.
4. Gemini is instructed to fill these fields dynamically:
   - Word without furigana in the main word field.
   - Conversation context (example sentences) extracted from the chat history.
   - Text-to-Speech audio link in the format `[sound:https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=WORD]`.
   - Low-resolution Unsplash HTML image tag.
   - Accent details and frequency where appropriate.

### [PL-6.5] Bilateral FSRS Synchronization & Offline Scheduling

To ensure state parity and permit offline study without losing scheduling progress:
1. **Review Deduplication**: Prior to inserting local reviews (`localReviews`) into Anki via `insertReviews`, the sync engine retrieves Anki's existing logs using `ankiClient.getReviewsOfCards(localCardIds)`. Local logs whose timestamps are already recorded in Anki are skipped. This ensures sync idempotency and prevents primary key violations on network retries.
2. **Bulk Querying**: Rather than executing individual `getReviewsOfCard` requests concurrently via `Promise.all` which triggers connection bottlenecks in AnkiConnect, a single `getReviewsOfCards` bulk request is used.
3. **FSRS Parameter Approximation**: When caching imported cards that have an interval in Anki (`interval > 0`) but no remote reviews history, the database approximates FSRS state by initializing `stability = card.interval`, `difficulty = 5.0` (standard intermediate difficulty), and `reps = 1` (simulated initial review) on the first sync. This prevents ts-fsrs from resetting mature card intervals down to 1-3 days on the first local review.
4. **Day Boundary Alignment**: The scheduler's daily boundary alignment function (`alignToDayBoundary`) sets the review date timestamp to `04:00 AM` local time instead of midnight, matching the default new day boundary in Anki Desktop.
5. **ReviewType Determination**: When inserting reviews into Anki, the sync engine queries `getCardsInfo` for each synced card to determine the correct `reviewType` (0=Learn, 1=Review, 2=Relearn) based on the card's actual Anki state (interval/queue), rather than inferring from `lastInterval`. This prevents falsely tagging mature card reviews as "Learn" steps, which would corrupt FSRS replay stability calculations.
6. **LastInterval Correction**: If a local review has `lastInterval=0` but the card in Anki has `interval > 0`, the sync engine corrects `lastInterval` to the Anki card's actual interval. This prevents FSRS from treating an established card's review as a first-time learning step.
7. **Dual-State FSRS**: Vocabulary entities maintain two distinct scheduling trajectories (`passive` and `active`). Passive scheduling handles recognition/reading, while active scheduling handles speech/writing production.
8. **Anki Integration for Dual-States**: Anki sync processes use the active FSRS state as the primary scheduling data synced with Anki. Remote reviews are replayed to align both passive and active states, and imported translations have HTML cleanings applied.
9. **Contextual Sentence Examples**: Sentences correctly produced by the user in dialogue are preserved as contextual examples in IndexedDB under the associated word entity's `contextExamples` field.
10. **Quiz Manual FSRS Override & Typo Forgiveness**: To decouple scheduling transactions from strict input checks, the Quiz feedback view renders an interactive override bar displaying calculated intervals for rating buttons (Again, Hard, Good, Easy) in real-time. If an answer fails correctness check, the "Простил опечатку" button allows the user to manually flip validation state to correct, updating the default grade to Good, and revealing the FSRS rating override controls for manual assessment.
11. **nJMdict Import Translation Spacing & Tag Separation**: To prevent text clumping when parsing Anki cards containing multiple block elements, `stripHtml` converts closing tags like `</span>`, `</div>`, `<br>` to a semicolon/space (`; `) before stripping tags. Additionally, `cleanTranslationJunk` runs a `fixConcatenatedTranslation` regex helper inserting spaces after closing parentheses/brackets if followed by a letter to correct run-on translations.
12. **Database-Wide Profile Correction**: The database synchronizer runs `manuallyFixTestProfileWords` on startup to scan IndexedDB records for the active profile, patching specific historical concatenated entries (like `sadmiserableunhappysorrowfulof a person` and `warp (waving)longitude`) directly in the user's browser.

---

## [PL-7] PROGRESSION & IMMERSION DECORATION

To encourage user engagement, YomuMogu displays decorative progression levels and XP stats in the UI.

### [PL-7.1] Decorative XP and Level
- XP is displayed as a decorative progress bar on the dashboard.
- Levels (0–6) are calculated based on earned XP to serve as a decorative progress indicator.

### [PL-7.2] XP Sources
- Word used correctly in chat: +1 XP per word
- Grammar correct: +1 XP bonus
- Session completed (80% words collected): +5 XP

---

## [PL-8] ARCHITECTURAL & CODE CONSTRAINTS

1. **[PL-8.1] No direct localStorage access.** All client persistence via `profile.ts` helpers.
2. **[PL-8.2] No direct Gemini SDK calls.** Always wrap in `withRetry()`.
3. **[PL-8.3] SSR guard.** Never access `localStorage`/`window` outside `useEffect` or without `typeof window !== 'undefined'` check.
4. **[PL-8.4] dangerouslySetInnerHTML scope.** Only allowed in chat message bubbles, grammar feedback cards, and hint text (for `<ruby>` rendering).
5. **[PL-8.5] No Tailwind.** CSS Modules only.
6. **[PL-8.6] Test coverage.** Every new API route needs unit test with mocked Gemini/Anki.
7. **[PL-8.7] System instruction language.** Never use forbidden words (see PL-5.4).
8. **[PL-8.8] Prime Directive: Subtitle Truth.** Timed subtitles/metadata must strictly match scraper/generator results, never hand-written mocks. Any resource representing external media reality must be generated by code.


---

## [PL-9] TESTING INFRASTRUCTURE

### [PL-9.1] Configs
- `vitest.config.ts` — unit tests, excludes `*.integration.test.ts`
- `vitest.integration.config.ts` — integration tests only, reads `.env.local`
- `vitest.setup.ts` — jsdom setup, `@testing-library/jest-dom` matchers
- `playwright.config.ts` — end-to-end tests (Chromium), requires running dev server

### [PL-9.2] Commands
```powershell
npm run test                     # Unit tests (mocked, offline)
npm run test:integration         # Anki integration tests (requires local Anki Desktop on port 8765)
npm run test:integration:gemini  # Live LLM integration tests (uses Gemini API, costs money)
npm run test:integration:media   # MeCab integration tests (requires tokenizer on port 8000)
npm run test:e2e                 # Playwright end-to-end tests (requires running dev server)
```

### [PL-9.3] Test Categories
| Category | Location | Mock strategy |
|---|---|---|
| Anki Client | `plugins/anki/__tests__/` | Mock `fetch` |
| Local Database | `core/__tests__/` | `fake-indexeddb` polyfill |
| Anki Filter | `plugins/anki/__tests__/` | Pure function, no mocks |
| Gemini Client | `lib/gemini/__tests__/` | Mock `@google/genai` |
| API Routes | `app/api/*/__tests__/` | Mock service singletons |
| UI Components | `app/__tests__/`, `app/chat/__tests__/`, `app/settings/__tests__/`, `app/practice/__tests__/`, `app/practice/quiz/__tests__/` | Mock `fetch`, `lucide-react`, `next/navigation` |
| Hooks | `hooks/__tests__/` | Mock state and time |
| Integration (Anki) | `plugins/anki/__tests__/sync.integration.test.ts` | Real local AnkiConnect |
| Integration (Gemini) | `lib/gemini/__tests__/*.integration.test.ts` | Real Gemini API call |
| Integration (MeCab) | `app/api/media/parse/__tests__/parse.integration.test.ts` | Real local MeCab microservice |

### [PL-9.4] Current Test Count

321 unit/integration tests across 48 test files. All passing. Playwright E2E tests fully aligned with sequential execution and offline spec.

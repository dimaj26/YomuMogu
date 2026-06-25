---
name: data-schema
description: Client storage model — localStorage namespace, core TypeScript interfaces, IndexedDB schema, and the YouTube cache.
---

# Data Schema & Storage

Formerly `PROJECT_LOGIC.md` [PL-3]. Storage rules (always via `profile.ts` helpers, SSR guards) are in [coding-rules](coding-rules.md) and [constraints](constraints.md).

## [PL-3.1] localStorage Key Namespace
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
| `activity_log` | JSON `Strand[]` | Rolling log of recent user actions classified into 'structure' or 'immersion' strands |

Profile metadata (not namespaced):
- `yomumogu_active_profile_id` — active profile ID string
- `yomumogu_profiles` — JSON `ProfileInfo[]` — list of all profiles

## [PL-3.2] Legacy Key Migration
`getProfileItem(key)` automatically migrates from legacy format `yomumogu_${key}` to `yomumogu_profile_default_${key}` for the `default` profile only.

## [PL-3.3] Core TypeScript Interfaces

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
  isHard?: boolean;
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
  shortNote?: string;
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
  active: FsrsState; // single FSRS curve (dual-curve collapsed)
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
  reviewType?: 'active'; // passive reviews removed; always 'active' (field kept for Anki sync compat)
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

## [PL-3.4] IndexedDB Schema

For local-first operation and off-session scheduling, YomuMogu maintains client-side storage using Dexie.js (upgraded to Schema Version 8):
- **`words` Table** (`[profileId+id]` compound key):
  - Stores the local replication of Anki cards including calculated FSRS variables and situational tags.
  - Indexes: `id`, `word`, `category`, `active.due`, `*tags`, `profileId`.
  - Schema v8 (dual-curve collapse) removed the `passive.due` index and strips the legacy `passive` field from existing records during upgrade.
- **`reviews` Table** (`id` auto-increment key):
  - Stores local review logs generated during dialogue practice.
  - Indexes: `[profileId+cardId]`, `cardId`, `timestamp`, `synced`, `profileId`.
- **`ui_words` Table** (`[profileId+id]` compound key):
  - Stores local FSRS progression metrics for each localized UI text snippet.
  - Indexes: `id`, `status`, `due`, `profileId`.
- **`grammar_progress` Table** (`[profileId+ruleId]` compound key):
  - Stores user grammar Leitner progress step intervals.
  - Indexes: `ruleId`, `status`, `due`, `profileId`.

## [PL-3.5] Persistent YouTube Cache Schema

To minimize outbound scraping requests and avoid YouTube rate limits (HTTP 429), YomuMogu writes a local, Git-ignored JSON file `_nogit_youtube_cache.json` in the project root.

```typescript
interface YoutubeCacheData {
  availability: Record<string, boolean>; // Maps video ID to caption availability
  transcripts: Record<string, SubtitleSegment[]>; // Maps video ID to parsed subtitle segments
}
```

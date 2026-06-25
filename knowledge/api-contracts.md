---
name: api-contracts
description: HTTP route contracts — Anki proxy, Gemini, dict, media routes, and the ChatResponse/HintResponse shapes.
---

# API Route Contracts

Formerly `PROJECT_LOGIC.md` [PL-4]. Implementing AI behaviour for these routes is governed by [gemini-patterns](gemini-patterns.md) and [coding-rules](coding-rules.md) (CP-3.5 route rules).

## [PL-4.1] Anki Routes
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

## [PL-4.2] Gemini & Dict Routes

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/gemini/sessions` | POST | `{ words: AnkiWord[] }` | `{ sessions: GeneratedSession[] }` |
| `/api/gemini/etymology` | POST | `{ word }` | `{ components: string[], etymology: string }` |
| `/api/gemini/classify` | POST | `{ words: string[] }` | `{ classifications: Array<{ word: string; tags: string[] }> }` |
| `/api/gemini/grammar-verify` | POST | `{ ruleId, userInput }` | `{ isCorrect: boolean, correction: string, explanation: string }` |
| `/api/chat` | POST | `{ scenario, targetWords, history, message, level, grammarInJapanese, collectedWords?, grammarFocus?, grammarScope? }` | `ChatResponse` |
| `/api/chat/hint` | POST | `{ scenario, targetWords, history, level }` | `HintResponse` |
| `/api/chat/analyze` | POST | `{ history, deckName, frontField, backField, deckMappings? }` | `{ words: AnalyzedWord[] }` |
| `/api/dict/lookup` | GET | `?word=WORD` | `{ definition: string }` |
| `/api/media/parse` | POST | `{ url }` or `{ srtText }` | `{ success: boolean, lemmas: string[], segments: SubtitleSegment[] }` — segments tagged with `source: 'pregenerated' | 'scraped' | 'upload'` |
| `/api/media/tokenize` | POST | `{ text, mode? }` | `{ tokens: MeCabToken[] }` or `{ lemmas: string[] }` or `{ tokenizationSkipped: true, tokens: [], lemmas: [] }` |
| `/api/media/search` | POST | `{ query, excludeIds?, seed?, continuation?, knownWords?, pageSize?, tier? }` (`tier`: `'beginner' \| 'bridge' \| 'acquisition'`, default `acquisition`) | `{ success: boolean, results: Array<{ id, title, description, url, platform, lemmas, comprehensionRate, subQuality, levelFit, durationFit, score, trackKind }>, continuation: string \| null, theme: string \| null }` |

## [PL-4.3] ChatResponse & HintResponse
```typescript
interface ChatResponse {
  reply: string;          // Japanese AI response (may contain <ruby> tags on levels 1-3)
  translation: string;    // Russian translation of reply
  grammarFeedback: {
    isCorrect: boolean;
    correction: string;   // Corrected sentence or ""
    explanation: string;  // Explanation in Russian (or Japanese if grammarInJapanese)
    shortNote: string;    // Короткая метаязыковая заметка об ошибке на русском
  };
  wordsDetected: string[]; // Target words found in user's message
  grammarRuleDetected: boolean; // True if the user correctly used the active grammarFocus rule
  usedConstructions?: string[]; // Grammar rules/tags utilized by Gemini in the reply
  _debug?: {
    systemInstruction: string;
    contents: any;
  };
}

interface HintResponse {
  hints: Array<{
    level: 'easy' | 'medium' | 'advanced';
    keywords: Array<{ word: string; translation: string }>; // 2–4 элемента; word может содержать <ruby> по правилам уровня
    patternHint: string; // русский каркас фразы с японскими частицами
  }>;
  _debug?: {
    systemInstruction: string;
    contents: any;
  };
}
```

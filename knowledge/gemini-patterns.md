---
name: gemini-patterns
description: Gemini API usage — withRetry, structured output, language-safety taboos, furigana, target-word concealment, input enforcement, adaptive routing, and grammar scoping.
---

# Gemini API Patterns

Formerly `PROJECT_LOGIC.md` [PL-5]. The hard rules ("always withRetry", forbidden words) are mirrored as constraints in [coding-rules](coding-rules.md) (CP-3.3) and [constraints](constraints.md) (PL-8).

## [PL-5.1] Always Use withRetry
```typescript
import { withRetry, GeminiModel } from './retry';

const result = await withRetry(async (model: GeminiModel) => {
  const response = await this.ai.models.generateContent({ model, contents, config });
  if (!response.text) throw new Error('Empty response');
  return JSON.parse(response.text);
});
```

## [PL-5.2] Retry Configuration
- Models: `gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash-lite` (automatic fallback chain)
- maxRetries: 3 per model, exponential backoff: 1s → 2s → 4s
- Retryable: HTTP 429, 500, 503. Non-retryable (400, 401): throw immediately.

## [PL-5.3] Structured Output Pattern
Always pair `responseMimeType: 'application/json'` with `responseSchema`. Never rely on free-form JSON parsing.

## [PL-5.4] System Instruction Language Safety
Forbidden words in system instructions (content policy):
- `ролевая игра`, `Роль ИИ`, `Роль пользователя`

Required alternatives:
- `практический диалог`, `персонаж`, `кем является ИИ в этом диалоге`

## [PL-5.5] Gradual Furigana System
Furigana (ruby tags) is wrapped around EVERY kanji word in Gemini replies and corrections at all difficulty levels. Client-side, the furigana visibility (rt class) is dynamically controlled based on the user's FSRS active interval:
- **`interval < 3` days** (unknown or newly learned words): Full visibility.
- **`3 <= interval < 21` days** (learning/review words): Faded furigana (`.rtFade` class, opacity: 0.6).
- **`interval >= 21` days** (mature words): Hidden furigana (`.rtHidden` class, opacity: 0 by default, fully visible on hover).

## [PL-5.6] Target Word Concealment
To prevent "leakage" of target words and encourage user recall:
- **Turns 1-2**: The AI character is strictly forbidden from using, mentioning, or translating any of the target words (in Japanese and Russian) in its responses.
- **Turns 3+**: The AI character can only use target words that the user has already used/detected in previous turns or the latest message. Unused target words remain strictly concealed.

## [PL-5.7] Enforced Japanese Input and Placeholders
- **Hybrid Input (Cyrillic Placeholders)**: If the user uses a Cyrillic/Russian word placeholder in a Japanese sentence (e.g., 'Стулの座って'), `grammarFeedback.isCorrect` is set to `false`, and `grammarFeedback.correction` is populated with the fully corrected Japanese sentence containing the translated placeholder (e.g., '椅子に座って').
- **Entirely Russian Input**: If the user's input is entirely in Russian, `grammarFeedback.isCorrect` is set to `false`, `correction` is populated with the complete Japanese translation of their message, and `explanation` explains the error in Russian.
- **Furigana in Correction**: The corrected sentence in `grammarFeedback.correction` must strictly follow the gradual furigana FSRS active-interval-based rules (all kanji words wrapped in ruby tags, visibility classes added on the client).
- Detection of target words (`wordsDetected`) must base strictly on Japanese text; Russian translations do not trigger detection.

## [PL-5.8] Response and Question Constraints
- **Conversational Coherence**: If the user asks a question (e.g. "What book?", "What to write?"), the AI MUST answer that question in character first before asking its next concrete, situational question.
- **Respond to Corrected Meaning**: The AI response in the `reply` field must be built upon the *intended/corrected* version of the user's sentence (from `grammarFeedback.correction`) rather than interpreting grammatical mistakes literally.
- The AI reply must contain exactly one response message with exactly one question to keep the conversation flowing without stacking questions.
- **Concreteness & Specificity**: General, abstract open questions (e.g., "What are your plans?", "How are you?", "What's on your mind?") are strictly forbidden. The AI must ask highly focused, concrete, situational questions that narrow down options and nudge the user toward using the target words (e.g. asking "Are you thirsty?" to nudge the user to say "I want to drink").
- Tight sentence length limits (under 15/20/30/50 characters depending on level) are verified by the model via a self-count instruction.

## [PL-5.9] Adaptive Reviews & Situational Routing
- **FSRS Stability Gating**: Reviews are adaptively routed between rapid recognition checks (offline translation quiz) and conversation writing (Gemini chat) based on active FSRS stability. If `active.stability < 3` days or `lapses >= 2`, the word is routed to dialog practice; otherwise, it is scheduled for the offline quiz.
- **Situational Clustering**: The system programmatically groups the daily active vocabulary pool using `groupWordsIntoThemes` by finding overlaps among the 10 situational themes (`shopping`, `restaurant`, `travel`, `home`, `work`, `hobbies`, `social`, `health`, `weather`, `education`). It matches nouns matching a specific theme and fills the remaining slots with `universal` verbs and adjectives to form coherent 5–8 word target sets for dialogue practice, prioritizing hard words (`isHard?: boolean` derived from FSRS check) first.
- **Chat Entry Gating**: The user must have at least `CHAT_MIN_ENTRY_WORDS = 5` words currently in study (with active status `learning` or `review`) in order to generate themes and enter Gemini chat practice. This threshold is verified by the pure helper `canEnterChat`.
- **Contextual Distractors**: The multiple-choice Warm-up selector queries words matching the target's situational tag to provide high-quality, contextually similar distractors.

> Implementation note (see [roadmap](../_nogit_roadmap.md) §2.5): `shouldRouteToChat` exists and is unit-tested but the routing described here is partially wired; treat PL-5.9 as the intended contract and verify against code before relying on it.

## [PL-5.10] Derived Chat Grammar Scoping
To ensure the AI chat remains pedagogically accessible and restricts its vocabulary/grammar complexity to the user's current progress:
- **Allowed Scope**: The grammar scope is computed on the client side based on the user's Leitner progress. The allowed scope contains:
  1. Mature grammar nodes (`status === 'mature'`).
  2. Active/target grammar nodes that are unlocked but not yet mature (`unlocked && status !== 'new'`).
  3. A formulaic chunk whitelist (`FORMULAIC_CHUNKS` e.g., `ください`, `お願いします`, `すみません`, etc.) which are exempt from checking.
- **Active Focus Node**: The system automatically determines a focus grammar construction for the chat. It prioritizes the active/unlocked rule in progress with the nearest Leitner due date. If none exist, it picks the oldest overdue mature rule for spaced repetition. Otherwise, it falls back to the base rule (`g_n5_s1_1`, `АはБです`).
- **Server-Side Validation**: The client sends the calculated `grammarScope` to `/api/chat`. The server generates a prompt constraint list and passes it to Gemini. Gemini is instructed to return the list of tags of all grammar constructions it used in the `usedConstructions` field of its JSON response. The server validates `usedConstructions` against the allowed scope and logs warnings in cases of violations.

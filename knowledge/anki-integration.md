---
name: anki-integration
description: AnkiConnect protocol, card-status classification, batch loading, AI note creation, and bilateral FSRS synchronization.
---

# Anki Integration Patterns

Formerly `PROJECT_LOGIC.md` [PL-6]. Anki is an opt-in word source (see [architecture](architecture.md)); the FSRS model is a single `active` curve (see [data-schema](data-schema.md)).

## [PL-6.1] AnkiConnect HTTP Protocol
```
POST http://localhost:8765
Body: { "action": "...", "version": 6, "params": {} }
```

## [PL-6.2] Card Status Classification (filter.ts)
| Anki Internal / Condition | YomuMogu Status |
|---|---|
| `effectiveQueue === 0` (or `interval === 0` and `effectiveQueue !== 1` and `effectiveQueue !== 3`) | `new` |
| `effectiveQueue === 1` or `effectiveQueue === 3` | `learning` |
| `effectiveQueue === 2` and card ID is in `dueCardIds` (or fallback `interval < 21`) | `review` |
| `effectiveQueue === 2` and card ID is NOT in `dueCardIds` (or fallback `interval ≥ 21`) | `mature` |

## [PL-6.3] Batch Loading
Cards loaded in batches of 500 (`findCards` → `cardsInfo`). Words array capped at top 100 for UI display; all words passed to Gemini for session generation.
During chat analysis, to prevent lookup issues caused by HTML ruby tags or brackets containing readings (e.g. `笑う[わらう]`), all cards from the selected deck are loaded in-memory once, stripped of Japanese readings/HTML tags, and compared directly.

## [PL-6.4] AI Note Creation & Model Field Inspection
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

## [PL-6.5] Bilateral FSRS Synchronization & Offline Scheduling

To ensure state parity and permit offline study without losing scheduling progress:
1. **Review Deduplication**: Prior to inserting local reviews (`localReviews`) into Anki via `insertReviews`, the sync engine retrieves Anki's existing logs using `ankiClient.getReviewsOfCards(localCardIds)`. Local logs whose timestamps are already recorded in Anki are skipped. This ensures sync idempotency and prevents primary key violations on network retries.
2. **Bulk Querying**: Rather than executing individual `getReviewsOfCard` requests concurrently via `Promise.all` which triggers connection bottlenecks in AnkiConnect, a single `getReviewsOfCards` bulk request is used.
3. **FSRS Parameter Approximation**: When caching imported cards that have an interval in Anki (`interval > 0`) but no remote reviews history, the database approximates FSRS state by initializing `stability = card.interval`, `difficulty = 5.0` (standard intermediate difficulty), and `reps = 1` (simulated initial review) on the first sync. This prevents ts-fsrs from resetting mature card intervals down to 1-3 days on the first local review.
4. **Day Boundary Alignment**: The scheduler's daily boundary alignment function (`alignToDayBoundary`) sets the review date timestamp to `04:00 AM` local time instead of midnight, matching the default new day boundary in Anki Desktop.
5. **ReviewType Determination**: When inserting reviews into Anki, the sync engine queries `getCardsInfo` for each synced card to determine the correct `reviewType` (0=Learn, 1=Review, 2=Relearn) based on the card's actual Anki state (interval/queue), rather than inferring from `lastInterval`. This prevents falsely tagging mature card reviews as "Learn" steps, which would corrupt FSRS replay stability calculations.
6. **LastInterval Correction**: If a local review has `lastInterval=0` but the card in Anki has `interval > 0`, the sync engine corrects `lastInterval` to the Anki card's actual interval. This prevents FSRS from treating an established card's review as a first-time learning step.
7. **Single-Curve FSRS** (dual-curve collapsed): Vocabulary entities maintain a single `active` scheduling trajectory. The former passive curve was removed — passive learning is treated as immersion (content comprehensibility + decaying furigana, both computed off `active`), not a measured `due`-scheduled subsystem. Chat only records an `active` review for words the learner actually used (collected); merely-seen words produce no review.
8. **Anki Integration**: Anki sync processes use the `active` FSRS state as the scheduling data synced with Anki. Remote reviews are replayed onto the single `active` curve, and imported translations have HTML cleanings applied.
9. **Contextual Sentence Examples**: Sentences correctly produced by the user in dialogue are preserved as contextual examples in IndexedDB under the associated word entity's `contextExamples` field.
10. **Quiz Manual FSRS Override & Typo Forgiveness**: To decouple scheduling transactions from strict input checks, the Quiz feedback view renders an interactive override bar displaying calculated intervals for rating buttons (Again, Hard, Good, Easy) in real-time. If an answer fails correctness check, the "Простил опечатку" button allows the user to manually flip validation state to correct, updating the default grade to Good, and revealing the FSRS rating override controls for manual assessment.
11. **nJMdict Import Translation Spacing & Tag Separation**: To prevent text clumping when parsing Anki cards containing multiple block elements, `stripHtml` converts closing tags like `</span>`, `</div>`, `<br>` to a semicolon/space (`; `) before stripping tags. Additionally, `cleanTranslationJunk` runs a `fixConcatenatedTranslation` regex helper inserting spaces after closing parentheses/brackets if followed by a letter to correct run-on translations.
12. **Database-Wide Profile Correction**: The database synchronizer runs `manuallyFixTestProfileWords` on startup to scan IndexedDB records for the active profile, patching specific historical concatenated entries (like `sadmiserableunhappysorrowfulof a person` and `warp (waving)longitude`) directly in the user's browser.

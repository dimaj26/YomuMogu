---
name: module-registry-app
description: Per-file roles for the app & UI layer — app/ pages and api/ routes, components/, hooks/, tests/e2e/. Part of the module registry (PL-2.2).
---

# Module Registry — App & UI

Per-file source of truth (formerly `PROJECT_LOGIC.md` [PL-2.2], app/UI slice). Sibling slices: [core/infra](module-registry-core.md), [lib](module-registry-lib.md). Directory tree: [directory-layout](directory-layout.md). Keep in sync on file add/remove/rename.

| File | Role |
|---|---|
| `app/error.tsx` | Next.js App Router global error boundary page |
| `app/practice/quiz/page.tsx` | Gamified Active Recall quiz component supporting ad-hoc, FSRS modes, mnemonics, and phonosemantic hints |
| `app/api/words/route.ts` | GET endpoint resolving words via active `WordSource` plugin or local IndexedDB fallback |
| `app/api/dict/lookup/route.ts` | GET endpoint for offline dictionary lookup |
| `app/api/gemini/etymology/route.ts` | POST endpoint to generate word etymologies and mnemonic hints |
| `app/api/gemini/classify/route.ts` | POST endpoint to classify words by situational tags using Gemini |
| `app/api/gemini/grammar-verify/route.ts` | POST endpoint using Gemini client to verify user Japanese sentences against grammar rules |
| `app/api/anki/sync-db/route.ts` | POST endpoint for bilateral FSRS sync between IndexedDB and Anki; handles deduplication, bulk queries, FSRS approximation |
| `app/api/anki/setup-deck/route.ts` | POST endpoint to create a YomuMogu deck and note model in Anki if absent |
| `app/api/media/parse/route.ts` | POST endpoint parsing YouTube subtitles/metadata or SRT/VTT file transcripts |
| `app/api/media/tokenize/route.ts` | POST endpoint proxying tokenization to local MeCab microservice |
| `app/api/media/search/route.ts` | POST endpoint to orchestrate query expansion, YouTube scraping, subtitle quality check, CR-ranking, and page diversity selection |
| `app/api/anki/sync/__tests__/sync.test.ts` | Unit tests for `/api/anki/sync` route |
| `app/api/anki/add/__tests__/add.test.ts` | Unit tests for `/api/anki/add` route |
| `app/api/anki/sync-db/__tests__/sync-db.test.ts` | Unit tests for sync-db route |
| `app/api/anki/setup-deck/__tests__/setup-deck.test.ts` | Unit tests for setup-deck route |
| `app/api/chat/analyze/__tests__/analyze.test.ts` | Unit tests for `/api/chat/analyze` route |
| `app/api/chat/hint/__tests__/hint.test.ts` | Unit tests for `/api/chat/hint` route |
| `app/api/gemini/__tests__/etymology.test.ts` | Unit test for etymology route using mocked Gemini client |
| `app/api/gemini/__tests__/classify.test.ts` | Unit test for classify route using mocked Gemini client |
| `app/api/gemini/__tests__/grammar-verify.test.ts` | Unit tests verifying the grammar verification API route behavior under standard inputs |
| `app/api/media/parse/__tests__/parse.test.ts` | Unit tests for parse media endpoint |
| `app/api/media/parse/__tests__/parse.integration.test.ts` | Integration tests for parse media endpoint against running MeCab |
| `app/api/media/tokenize/__tests__/tokenize.test.ts` | Unit tests for tokenize endpoint |
| `app/api/media/tokenize/__tests__/tokenize.integration.test.ts` | Integration tests for tokenize media endpoint against running MeCab |
| `app/api/media/search/__tests__/route.test.ts` | Unit tests for search API route funnel orchestration |
| `hooks/useApiCall.ts` | Custom React hook consolidating client-side loading, error state, and retry logic |
| `hooks/useQuests.ts` | React custom hook managing namespaced daily quest progression and XP rewards |
| `hooks/useMediaRecommendation.ts` | Hook calculating Comprehension Rate (CR) and FSRS-due vocabulary matches for videos |
| `hooks/__tests__/useApiCall.test.ts` | Unit tests for useApiCall hook |
| `hooks/__tests__/useMediaRecommendation.test.ts` | Unit tests for useMediaRecommendation hook |
| `components/ErrorBoundary.tsx` | Global class-based React error boundary catching rendering exceptions |
| `components/ErrorFallback.tsx` | UI fallback component rendered by ErrorBoundary on crash |
| `components/MediaInteractivePlayer.tsx` | Subtitle-synchronized player component: sticky segment matching, quality-gated smooth progress fill karaoke rendering, requestAnimationFrame display clock resynchronization, sentence regrouping pipeline, CC dedup (`cc_load_policy` conditional, extension priority guard, CC toggle button); tap-to-add (B2.1) sends the active subtitle line as live context and branches local (`addWord` → IndexedDB FSRS, no Anki/Gemini) vs Anki (`/api/anki/add` + `syncLocalDatabaseWithAnki`), with a soft daily-limit notice |
| `components/PhonosemanticHint.tsx` | Accordion component displaying phonosemantic keys and relative kanji |
| `components/DebugDrawer.tsx` | Client component implementing the sliding debug drawer HUD |
| `components/AssessmentModal.tsx` | Reusable knowledge-diagnostics modal (load starter deck, mark known words, `importStarterDeck`); props `isOpen/profileId/onClose/onSaved/onError`; used on `/settings` and `/` (dashboard onboarding) |
| `components/AssessmentModal.module.css` | Styles for the AssessmentModal (extracted from settings) |
| `components/ServiceUnavailable.tsx` | Reusable "service unavailable" block (human message + optional "what still works" hint + optional Retry shown only when `retryable && onRetry`) |
| `components/ServiceUnavailable.module.css` | Styles for ServiceUnavailable |
| `components/JpUIProvider.tsx` | UI-FSRS provider; `upgradeWord` gated by `CONTENT_JP_MIN_LEVEL` (content stays Russian until immersion level ≥ 2); chrome elements never upgrade |
| `components/LearningTrack.tsx` | N5→N1 macro JLPT competency ladder — shows lexCoverage and grammarCoverage progress bars per level; receives `MacroLadderProfile` prop |
| `components/GrammarTrack.tsx` | Winding SVG path component for grammar rules curriculum showing forks and connections dynamically generated from prerequisite DAG |
| `components/GrammarTrainer.tsx` | Interactive overlays explaining grammar theory and prompting user custom sentences checked by AI |
| `components/ScienceTip.tsx` | Informational tooltip icon component showing scientific rationale for features |
| `components/ScienceTip.module.css` | CSS module for ScienceTip tooltip and popover alignment |
| `components/BalanceWidget.tsx` | Sidebar widget showing target vs actual structure-immersion balance with spacing advice |
| `components/BalanceWidget.module.css` | CSS module for recommended and actual balance bar visual progress indicators |
| `components/__tests__/MediaInteractivePlayer.test.tsx` | Unit tests for MediaInteractivePlayer component |
| `components/__tests__/AssessmentModal.test.tsx` | Unit tests for AssessmentModal render/save/onSaved |
| `components/__tests__/ServiceUnavailable.test.tsx` | Unit tests for ServiceUnavailable |
| `components/__tests__/LanguageSwitcher.test.tsx` | Unit test for LanguageSwitcher mode descriptions |
| `components/__tests__/LearningTrack.test.tsx` | Unit tests for macro ladder node states, coverage bars, and popover content |
| `components/__tests__/GrammarTrainer.test.tsx` | Unit tests verifying GrammarTrainer component rendering and interactive sandbox |
| `components/__tests__/ScienceTip.test.tsx` | Unit tests for ScienceTip open/close behavior and missing fallback checks |
| `components/__tests__/BalanceWidget.test.tsx` | Unit tests for BalanceWidget rendering under empty and complete activity logs |
| `tests/e2e/media-search-live.spec.ts` | Playwright E2E tests verifying search input, refresh diversity, and player loading |
| `tests/e2e/media-live.spec.ts` | Playwright E2E tests verifying real Japanese subtitle player interaction, karaoke highlighting, and dictionary lookup |
| `tests/e2e/media-tokenizer-down.spec.ts` | Playwright E2E tests verifying player degradation, warning banner, and disabled highlights when tokenizer is offline |

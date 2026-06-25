---
name: architecture
description: Project identity, stack, directory layout, and the core user flow that ties the pieces together.
---

# Architecture & Stack

YomuMogu is a Japanese language-learning web app: Anki + Gemini AI conversation practice, local-first with an offline starter deck. Detailed file roles live in [module-registry](module-registry.md); schemas in [data-schema](data-schema.md).

## [PL-1] Project Identity & Stack

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

## [PL-2.1] App Structure

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
        search/route.ts   # POST /api/media/search (funnel search route)
          __tests__/route.test.ts
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
    LearningTrack.tsx     # N5→N1 macro competency ladder — SVG winding track showing JLPT-level coverage progress rings
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
    grammar_rules.json    # JLPT N5 and N4 grammar curriculum JSON with coordinates and prerequisite mapping
    media_feed.json       # Static metadata for recommended video/podcast channels
    media_transcripts.json # Pre-generated timed transcripts for recommended YouTube videos
    jlpt_levels.json      # Generated versioned JLPT levels resource containing N5 and N4 vocabulary lists
    science_tips.json     # Versioned static registry of pedagogy research and citations (science tips)
  services/
    tokenizer/
      server.py           # MeCab FastAPI microservice (port 8000)
      Dockerfile          # Container definition for MeCab service
  lib/
    logger.ts             # Structured logger (debug/info/warn/error → logs/)
    profile.ts            # localStorage profile helpers + multi-profile management
    csrf.ts               # CSRF protection helpers (same-origin Origin/Referer verification)
    sanitize.ts           # DOMPurify HTML sanitization utility for dangerouslySetInnerHTML
    chat/
      fluency.ts          # Pure logic and calculations for fluency mode
      furigana.ts         # FSRS interval-based faded furigana logic
      __tests__/
        fluency.test.ts   # Unit tests for fluency module
        furigana.test.ts  # Unit tests for gradual furigana processor
    grammar/
      graph.ts            # Pure, side-effect-free graph operations (validation, unlocks, edges generation) for grammar DAG
      promptScope.ts      # Derived grammar scope calculator, validator, and prompt builder
      __tests__/
        graph.test.ts     # Unit tests for grammar DAG graph validation
        promptScope.test.ts # Unit tests for active grammar scoping and whitelist validation
    jlpt/
      levels.ts           # JLPT level detection and tag merging logic
      __tests__/
        levels.test.ts    # Unit tests for JLPT levels detection
    competency/
      profile.ts          # Competency engine: lexCoverage, grammarCoverage, recentCorrectionRate, buildCompetencyProfile, getPresetAdvice
      __tests__/
        profile.test.ts   # Unit tests for competency profile logic
    science/
      tips.ts             # Pedagogy tips retrieval library
      __tests__/
        tips.test.ts      # Unit tests for science tips
    balance/
      balance.ts          # Structure-vs-immersion activity balance calculations
      __tests__/
        balance.test.ts    # Unit tests for balance tracking logic
    media/
      youtube.ts          # Zero-dependency Japanese YouTube caption extractor
      parser.ts           # SRT/VTT subtitle parser and duration rounding utility
      search.ts           # YouTube search page scraper
      ranking.ts          # Candidate scoring and ranking engine
      selection.ts        # Seeded history-aware page diversity selection
      cache.ts            # Persistent file-backed YouTube search and transcript cache
```

## [CP-2.1] Core User Flow

1. User opens `/settings`, connects to local Anki via AnkiConnect, selects a deck and imports words.
2. Gemini AI generates 3 conversation scenarios ("sessions") based on the imported words.
3. User selects a session → redirected to `/chat`.
4. In `/chat`, user practices Japanese in dialogue with Gemini AI character.
5. Gemini tracks grammar, detected target words, and awards XP.

A fresh profile starts on the built-in 500-word local starter deck — no Anki required; the AnkiConnect check is lazy and never blocks a no-Anki user. Anki is an opt-in word source. Local-first state lives in IndexedDB (Dexie.js); secrets in `.env.local`; structured logs in `logs/`.

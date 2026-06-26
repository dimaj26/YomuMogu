---
name: module-registry-core
description: Per-file roles for the core/data/infra layer — core/, plugins/anki/, extension/, resources/, services/, scripts/. Part of the module registry (PL-2.2).
---

# Module Registry — Core / Data / Infra

Per-file source of truth (formerly `PROJECT_LOGIC.md` [PL-2.2], core/infra slice). Sibling slices: [app & UI](module-registry-app.md), [lib](module-registry-lib.md). Directory tree: [directory-layout](directory-layout.md). Keep in sync on file add/remove/rename.

| File | Role |
|---|---|
| `core/db.ts` | Dexie.js client-side database definitions, schemas, and FSRS transaction helpers |
| `core/scheduler.ts` | FSRS mathematical calculation engine over a single `active` curve (dual-curve collapsed) |
| `core/localDeckService.ts` | Offline local starter deck service and local db operations; `addWord` is the single entry point for tap-to-add (dedup by word+reading, idempotent, collision-safe id, optional `contextSentence` → `contextExamples`) |
| `core/types.ts` | Central TypeScript interface definitions for db schemas, reviews, and FSRS states |
| `core/pluginRegistry.ts` | Interfaces for custom learning plugins and active `WordSource` providers |
| `core/intervals.ts` | Single source of truth registry for all timing and interval systems |
| `core/__tests__/intervals.test.ts` | Unit tests for intervals registry |
| `core/__tests__/localDeckService.test.ts` | Unit tests for localDeckService |
| `core/__tests__/db.test.ts` | Unit tests for Dexie.js database functions |
| `core/__tests__/scheduler.test.ts` | Unit tests for FSRS scheduler calculations |
| `core/__tests__/tagger.test.ts` | Unit tests for tagger, FSRS routing, and session grouping helpers |
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
| `resources/phonosemantics.json` | 50 phonosemantic keys and relative kanji data |
| `resources/situational_dictionary.json` | Static situational tags mapping for 500 N5 words |
| `resources/media_feed.json` | Static metadata list of recommended video channels/audio podcast feeds |
| `resources/media_transcripts.json` | Pre-generated timed dialogues/monologues JSON transcripts for recommended YouTube videos |
| `src/resources/grammar_rules.json` | Grammar curriculum JSON with coordinates, aligned with prerequisite DAG |
| `resources/jlpt_levels.json` | Generated versioned JLPT levels resource containing N5 and N4 vocabulary lists |
| `resources/science_tips.json` | Versioned static registry of pedagogy research and citations (science tips) |
| `services/tokenizer/server.py` | FastAPI MeCab microservice providing morphological analysis on port 8000; `GET /health` returns `{status:'ok'\|'error'}` |
| `services/tokenizer/Dockerfile` | Docker container definition for the MeCab tokenizer service |
| `scripts/generate-transcripts.mjs` | Node script to scrape real `ja` captions for all feed videos and output `media_transcripts.json` |
| `scratch/SCRATCH_LOG.md` | Permanent historical audit registry tracking sandbox scripts and side effects |

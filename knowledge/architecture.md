---
name: architecture
description: Project identity, stack, and the core user flow. The directory tree is in directory-layout; per-file roles in the module-registry set.
---

# Architecture & Stack

YomuMogu is a Japanese language-learning web app: Anki + Gemini AI conversation practice, local-first with an offline starter deck. The `src/` tree is in [directory-layout](directory-layout.md); per-file roles in the [module-registry](module-registry-core.md) set; schemas in [data-schema](data-schema.md).

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
The full `src/` directory tree lives in [directory-layout](directory-layout.md). High level: `app/` (App Router pages + `api/` routes), `core/` (Dexie DB, FSRS scheduler, local deck, plugin registry, types), `plugins/anki/` (AnkiConnect integration), `lib/` (Gemini, media, grammar, jlpt, quiz, chat, words, science, balance, dict + logger/profile/csrf/sanitize), `components/`, `hooks/`, `resources/` (static JSON), `services/tokenizer/` (MeCab microservice), `extension/` (Chrome subtitle interceptor).

## [CP-2.1] Core User Flow

1. User opens `/settings`, connects to local Anki via AnkiConnect, selects a deck and imports words.
2. Gemini AI generates 3 conversation scenarios ("sessions") based on the imported words.
3. User selects a session → redirected to `/chat`.
4. In `/chat`, user practices Japanese in dialogue with Gemini AI character.
5. Gemini tracks grammar, detected target words, and awards XP.

A fresh profile starts on the built-in 500-word local starter deck — no Anki required; the AnkiConnect check is lazy and never blocks a no-Anki user. Anki is an opt-in word source. Local-first state lives in IndexedDB (Dexie.js); secrets in `.env.local`; structured logs in `logs/`.

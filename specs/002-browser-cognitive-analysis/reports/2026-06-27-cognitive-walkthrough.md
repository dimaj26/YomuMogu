# Cognitive Walkthrough Report — 2026-06-27

> Browser-driven cognitive analysis of the live YomuMogu dev app, per feature
> [002](../spec.md). Produced against the [report contract](../contracts/report-contract.md).

## 1. Run header

| Field | Value |
|-------|-------|
| **Date** | 2026-06-27 |
| **App URL** | `http://localhost:3000` (pre-existing dev server, PID 24792) |
| **Runtime** | Claude Code (Opus 4.8) |
| **Browser capability** | `@playwright/mcp@0.0.76`, headless, isolated (feature 001 / ADR 0003) |
| **Profile state** | Fresh / uninitialized local profile — XP 0, level 0, deck not yet seeded |
| **Scope (routes attempted)** | `/`, `/practice`, `/practice/quiz`, `/chat`, `/settings` (5) |

## 2. Cognitive map overview

```
                       ┌─────────────────────────────────────────────┐
                       │  /  (gamified dashboard, entry)              │
                       │  • "Пройти диагностику (5 мин)" → modal      │
                       │  • Kumiko grid (50 cells / 500 words)        │
                       │  • nav: Настройки → /settings                │
                       └───────┬───────────────────────┬─────────────┘
                               │ link                   │ "Настройки"
                               ▼                        ▼
        ┌──────────────────────────────┐     ┌──────────────────────────────┐
        │ /practice  (launcher)        │     │ /settings  (3 tabs)          │
        │ • "🎯 Начать разминку"        │     │ • Источник: Локальный список  │
        │   **DISABLED** (list not init)│     │   → "Требуется диагностика"   │
        │ • "Перейти в настройки" link  │────▶│ • "Пройти диагностику" → modal│
        │   → /settings                 │     │   (AssessmentModal opens ✓)   │
        └───────┬──────────────────────┘     └──────────────────────────────┘
                │ (warm-up → quiz, when deck seeded)
                ▼
        ┌──────────────────────────────┐     ┌──────────────────────────────┐
        │ /practice/quiz               │     │ /chat                        │
        │ • empty state: "🎉 Все слова  │     │ • "Сессия не выбрана"         │
        │   повторены!" (no due words)  │     │ • CTA "Перейти в настройки"   │
        │ • → back to /practice         │     │   (but sessions start in      │
        │                               │     │    /practice — see F-02)      │
        └──────────────────────────────┘     └──────────────────────────────┘
```

- **Entry**: `/`.
- **Observed edges**: `/` → `/settings` (header "Настройки" link); `/` → diagnostic
  modal (in-page); `/practice` → `/settings` (two "Перейти в настройки" / "Настроить
  источник" links); `/practice/quiz` → `/practice` (back button); `/settings` →
  diagnostic modal (in-page).
- **Unreachable by in-app navigation in a fresh profile**: `/practice/quiz` and
  `/chat` have **no inbound navigation affordance** from a fresh state — the
  warm-up that leads to the quiz is disabled, and no UI links to `/chat` until a
  session exists. Both were reached only by typing the URL directly. See F-03.
- **Central gate**: every functional surface funnels through **"Пройти
  диагностику"**, which initializes the local 500-word deck. Until then, practice
  warm-up is disabled, the quiz is empty, and chat has no session.

## 3. Per-screen observations

### 3.1 `/` — "YomuMogu — Разговорная практика японского с ИИ"

- **Structure**: Header (logo, "Smart" immersion switcher, "Основной профиль"
  switcher). Mascot 🍵 with greeting. XP widget (Уровень погружения 0, 0/20 XP).
  Stats (0 слов использовано, 0 сессий завершено, сложность чата 1). Marketing H1
  "Превратите ваши слова в живую речь!" + intro paragraph. Primary CTA "Пройти
  диагностику (5 мин)". Kumiko grid ("Очаги памяти") — 50 SVG cells, all "Новые,
  Стабильность 0.0дн". Footer nav: Настройки (→ `/settings`), Профиль, Справка.
  Dev-only Debug HUD present.
- **Outcome**: **advances** — full dashboard renders; primary CTA available.
- **Console signals**: 0 errors, 1 warning — `ErrorFallback_module….css preloaded
  using link preload but not used` (benign Next.js perf hint). See F-05.
- **Network signals**: none observed (0 non-static requests; 29 static only — the
  dashboard is fully client/IndexedDB-driven, no API call on load).
- **Screenshot**: [screenshots/01-home.png](screenshots/01-home.png)

### 3.2 `/practice` — "Практика диалога"

- **Structure**: Back link → `/`. "Новые слова на сегодня" card (Изучено сегодня
  0 из 10; Всего неизученных слов 0). **"🎯 Начать разминку" — disabled**; "➕
  Добавить +10" enabled. Tabs: Карта слов / Карта грамматики / Рекомендации медиа,
  showing "Локальный список еще не инициализирован. Пожалуйста, пройдите
  диагностику в настройках" + "Перейти в настройки" link. Right column: Источник
  обучения (Локальный список, лимит 0 из 10) + "Настроить источник" → `/settings`;
  Баланс обучения N5 (недостаточно данных); Ежедневные квесты (hidden until study);
  Интервальные повторения (FSRS explainer).
- **Outcome**: **advances** — page renders fully, but the primary action (warm-up)
  is gated/disabled pending diagnostics. See F-01, F-03.
- **Console signals**: 0 errors, 1 warning (same CSS-preload warning).
- **Network signals**: none observed (0 non-static; 31 static).
- **Screenshot**: [screenshots/02-practice.png](screenshots/02-practice.png)

### 3.3 `/practice/quiz` — "Интервальный квиз"

- **Structure**: Back button + heading "Интервальный квиз". Empty-state body:
  "🎉 Все слова повторены! На сегодня у вас нет слов для повторения. Отличный
  результат!" + "Вернуться на страницу практики" button.
- **Outcome**: **blocked** — *blocked reason*: no FSRS-due words (local deck
  uninitialized in a fresh profile), so the actual quiz UI (cloze/translation,
  hints, FSRS grading bar) cannot be exercised. The empty state is graceful and
  offers a way back; it is not an error.
- **Console signals**: 0 errors, 1 warning (same CSS-preload warning).
- **Network signals**: none observed (0 non-static; 32 static).
- **Screenshot**: [screenshots/03-practice-quiz.png](screenshots/03-practice-quiz.png)

### 3.4 `/chat` — (no document title change)

- **Structure**: Minimal: "Кот-сэнсей" avatar, paragraph "Сессия не выбрана", and
  a single button "Перейти в настройки". (Session Safeguard / empty state — none
  of the chat UI, input box, mascot interactions render without a session.)
- **Outcome**: **blocked** — *blocked reason*: no active chat session. Sessions are
  generated from the practice/scenario flow, which itself depends on a seeded deck.
- **Console signals**: 0 errors, 1 warning (same CSS-preload warning).
- **Network signals**: none observed (0 non-static; 32 static).
- **Screenshot**: [screenshots/04-chat.png](screenshots/04-chat.png)

### 3.5 `/settings` — "Настройки"

- **Structure**: Header + H1 "Настройки". Three tabs: **Профиль**, **Источник
  обучения** (default), **Облако**. Источник обучения tab: source selector
  (Стандартная Anki / Своя Anki / Локальный список — Локальный список active),
  description of offline 500-word mode, **Статус: Требуется диагностика** + "Пройти
  диагностику". "Импортированные слова" section: "Слова еще не загружены. …
  пройдите диагностику знаний для инициализации локального списка" + "Пройти
  диагностику".
- **Interaction exercised (live-app proof, US1 AC-2)**: clicked **"Пройти
  диагностику"** → the **AssessmentModal opened in-app**: heading "Диагностика
  знаний", instructional copy, a multi-group word-selection grid, and "Отмена" /
  "Сохранить и начать" actions. Post-interaction state captured below.
- **Outcome**: **advances** — interactive; the diagnostic (deck-initialization
  entry point) opens correctly.
- **Console signals**: 0 errors → after opening the modal, 2 warnings (the
  CSS-preload warning + a second warning emitted on modal open). No errors.
- **Network signals**: none observed (0 non-static; 30 static).
- **Screenshots**: [screenshots/05-settings.png](screenshots/05-settings.png),
  modal: [screenshots/06-diagnostic-modal.png](screenshots/06-diagnostic-modal.png)

## 4. Findings (documentation cross-check)

Docs checked: [architecture.md](../../../knowledge/architecture.md)
([CP-2.1] Core User Flow), [features.md](../../../knowledge/features.md),
[directory-layout.md](../../../knowledge/directory-layout.md).

| ID | Type | Screen / flow | Doc ref | Observed vs. expected | Actionable next step |
|----|------|---------------|---------|------------------------|----------------------|
| **F-01** | doc-drift | Onboarding / core flow | `architecture.md` [CP-2.1] | The documented "Core User Flow" leads with Anki: *"User opens /settings, connects to local Anki via AnkiConnect, selects a deck and imports words."* The live default for a fresh profile is the **local-deck + diagnostics** path (Anki is opt-in, as the doc's own trailing paragraph notes). The numbered flow is Anki-centric and does not match the local-first default the UI actually presents. | Rewrite [CP-2.1] so the primary numbered flow is the local-first path (`/` or `/settings` → "Пройти диагностику" → deck seeded → `/practice` warm-up/quiz → chat), with Anki documented as the opt-in branch. |
| **F-02** | ux-gap / broken-flow | `/chat` empty state | `architecture.md` [CP-2.1] step 2–3; `features.md` "Session Generation" | `/chat` with no session shows CTA **"Перейти в настройки"**, but sessions are generated in the **practice/scenario** flow, not in Settings. The CTA sends the user to the wrong place to recover. | Point the empty-`/chat` CTA at `/practice` (where a session is actually started), or clarify the copy. Verify in `src/app/chat/page.tsx`. |
| **F-03** | ux-gap | `/practice/quiz`, `/chat` reachability | `directory-layout.md` (routes exist) | In a fresh profile, `/practice/quiz` and `/chat` have **no inbound navigation affordance** — the warm-up that leads to the quiz is disabled and nothing links to chat until a session exists. Both were reachable only by typing the URL. A first-time user cannot discover them. | Confirm this is intended gating; if so, ensure the "Начать разминку" disabled state has a visible explanation/CTA so the path is discoverable, not a silent dead-end. |
| **F-04** | ux-gap | `/` Kumiko grid vs. deck state | `features.md` "Kumiko Heatmap" / "Offline Mode" | The dashboard renders a 50-cell Kumiko grid described as *"состояние 500 слов вашей стартовой колоды"* (all groups "Новые, 0.0дн") **while** `/practice` and `/settings` report the local list as *"не инициализирован" / "Слова еще не загружены"*. The dashboard implies 500 words exist before diagnostics seeds them — a potentially confusing signal. | Decide the intended pre-diagnostics state: either seed the starter deck on first load, or render the grid in an explicit "not yet initialized" placeholder style so it doesn't imply populated data. |
| **F-05** | ux-gap (console hygiene) | all 5 routes | — (runtime-only; not in docs) | Every route logs `ErrorFallback_module….css was preloaded using link preload but not used within a few seconds`. Benign, but consistent console noise on every page. | Review the preload `as`/usage for the `ErrorFallback` CSS chunk (Next.js/Turbopack preload config) to silence the warning. Low priority. |

**Positive corroboration (not a defect)**: no API/network calls fire on any page
load (all requests static) — this matches the documented **local-first / offline**
architecture ([architecture.md], "Offline Mode"); Gemini/Anki calls are deferred
until the user acts.

## 5. Limitations / snapshot note

- **Point-in-time snapshot.** Captured on a **fresh, uninitialized local profile**
  (XP 0, deck not seeded, no Anki running, no chat session). Time-/state-dependent
  UI (FSRS due counts, AI responses, quest progress) will differ on a profile that
  has run diagnostics and studied.
- **Routes recorded as `blocked`** and what they need next time:
  - `/practice/quiz` → run **"Пройти диагностику"** (or "➕ Добавить +10") to seed
    due words, then re-walk the actual quiz UI (cloze/translation, hints, FSRS bar).
  - `/chat` → start a session from the practice/scenario flow (requires a seeded
    deck and, for AI replies, a Gemini key) to observe the live dialogue UI.
- **Anki source paths** ("Стандартная Anki" / "Своя Anki") were not exercised —
  AnkiConnect (port 8765) was not running locally. A future run with Anki up would
  cover the opt-in branch in F-01.
- **Deeper interactions deferred**: only the diagnostic-modal open was exercised;
  completing diagnostics, a warm-up, a quiz answer, and a chat turn are the natural
  next walkthrough once the deck is seeded.

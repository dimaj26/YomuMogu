# P2 — «Borys, второй заход» — Walkthrough Report (2026-06-27)

> Persona-driven cognitive walkthrough, feature 004. Persona in
> [personas.md](../personas.md). Observation-only — no fixes here.

## 1. Persona header

- **Persona**: P2 «Borys» — returning beginner, came back for a second visit;
  wants to resume, see progress, and continue. Local deck, no Anki.
- **profileId**: `p2_returning` — **state: hybrid (light seed + organic use)**.
  - *Seeded* (test fixture): 25 local words (`__local_starter__`) — 10 `new`, 10
    `learning`, 5 `review` (15 due now); 4 review-history rows; a small activity log.
  - *Organic this run*: generated chat themes, ran a real chat exchange, opened the
    media player, opened the review quiz. Gamification counters (XP, "сессий
    завершено") were **not** seeded, so they read 0 — a disclosure caveat below.
- **Run**: 2026-06-27, `http://localhost:3000`, Playwright MCP headless.
- **Service availability**: Gemini **up** (chat + session generation worked for
  real); MeCab `:8000` **down** → media tokenization blocked; AnkiConnect **down**
  (irrelevant — local deck).

## 2. Journey overview

```
/ (H1 «С возвращением!», «15 слов к повторению») ──"Продолжить обучение"──> /practice
/practice (unlocked: review[15], themes, quests visible)
   ├─ "Сгенерировать темы" ─(Gemini)─> 3 deck-based scenarios
   │      └─ "Начать практику" ──> /chat  (real Gemini dialogue, target words ✓)
   ├─ "Рекомендации медиа" tab ──> deck-aware YouTube recs
   │      └─ "Смотреть и учить" ──> player plays, word-breakdown BLOCKED (MeCab)
   └─ /practice/quiz?mode=review ──> active-recall quiz (1/15)
```

## 3. Per-screen, in-character observations

### 3.1 `/` home (returning)

- **Q1 Clarity**: Strong — H1 «С возвращением!», a «Продолжить обучение» button and
  «15 слов(а) к повторению». The Kumiko grid now has colored learning/review cells.
  I can see I have something to do. ✅
- **Q2 Next step**: Crystal clear — one button to continue. ✅
- **Q3 Missing function**: The top stats say «0 слов использовано / 0 сессий
  завершено / 0 XP / Уровень 0» **at the same time** as «15 к повторению». For a
  returning user that's contradictory — the deck remembers me but the
  gamification/progress header acts like I've never done anything. (Partly a seeding
  caveat, but the **two counters disagreeing on the same screen** is a real
  coherence smell.) ⚠️ (learning-logic / progress representation.)
- **Q4 Convenience**: Good; the resume CTA is front-and-center. ✅
- **Outcome**: advances. Console: 1 benign warning. Screenshot:
  [p2-01-home.png](screenshots/p2-01-home.png).

### 3.2 `/practice`

- **Q1 Clarity**: Much richer now — «Активное повторение [15]» enabled, themes
  panel, quests visible (Охота на долги 0/10, Красноречие 0/1, Творец ассоциаций
  0/2). Readable. ✅
- **Q2 Next step**: Several valid next steps (review / generate themes / warm-up).
  As a returning beginner I'd want a *single* "recommended next" — there are 3-4
  equally-weighted CTAs. Mild choice paralysis. ⚠️
- **Q3 Missing function**: «Изучено сегодня: 4 из 10» — the 4 came from seeded
  review history, but I didn't study today; "сегодня" wording vs seeded history is
  slightly off (disclosure-tied). A clear "what's the optimal thing to do right
  now" hint is missing.
- **Q4 Convenience**: The page does a lot; the left column (warm-up + review) is the
  real action, the right column is dashboards. Fine once you learn it. ✅/⚠️
- **Outcome**: advances. Screenshot: [p2-02-practice.png](screenshots/p2-02-practice.png).

### 3.3 Theme generation (Gemini)

- **Q1 Clarity**: «Сгенерировать темы тренировок» → after ~20s, «Сценарии сегодня»
  with 3 cards (Домашние заботы и питомцы; Описание травм у врача; Заказ блюда в
  ресторане). ✅ A JLPT level selector (N5 active, N4–N1 locked) sits above.
- **Q2 Next step**: Each card has «Начать практику». Clear. ✅
- **Q3 Missing function**: No visible progress/spinner copy during the ~20s wait
  (I waited; a slow user might think it hung). A "generating…" state would reassure.
- **Q4 Convenience**: **Excellent learning-logic** — the 3 themes are built from MY
  words (питомцы=犬猫魚鳥花, травмы=手目口耳足, ресторан=食べる飲む水). The deck and
  the chat are clearly **one connected system**. ✅✅
- **Outcome**: advances (Gemini `/api/gemini/classify`→200, `/sessions`→200).
  Screenshot: [p2-03-themes.png](screenshots/p2-03-themes.png).

### 3.4 `/chat` (real session)

- **Q1 Clarity**: Header = theme; «Цели: собака, кошка, цветок, есть, пить» (my
  words) with a 0/5 counter; Sensei opens in Japanese **with furigana** + a Russian
  translation. Beautiful and clear. ✅✅
- **Q2 Next step**: Obvious — type Japanese; «Подсказка» available; «Отправить». ✅
- **Q3 Missing function**: For a beginner, maybe a "I don't know what to say"
  starter; but «Подсказка» covers most of it.
- **Q4 Convenience**: I typed «犬が好きです。猫も好きです。» → got «✓ Грамматика
  верна!», 犬 and 猫 were **auto-detected and checked off** (0/5 → 2/5), and Sensei
  **steered to the next target**: «お家には花がありますか？» (花=my next word). This
  is the strongest learning-logic moment in the whole app — deck → targets →
  conversation → collection → steering form one loop. ✅✅✅
- **Outcome**: advances. Screenshots: [p2-04-chat.png](screenshots/p2-04-chat.png),
  [p2-05-chat-exchange.png](screenshots/p2-05-chat-exchange.png).

### 3.5 Media / YouTube («Рекомендации медиа»)

- **Q1 Clarity**: A YouTube search box + URL import, and «Рекомендованный
  медиаконтent» — 5 cards each with «Степень понимания: X% знакомых слов» and «✨
  Повторение: N слов», computed against my deck. Clear and deck-aware. ✅
- **Q2 Next step**: «Смотреть и учить» per card; «Найти» for search. Clear. ✅
- **Q3 Missing function**: When I clicked «Смотреть и учить», the video plays with
  captions, but the **word-breakdown panel is unavailable** (MeCab tokenizer down) —
  shown as a degraded message, not a crash. So the headline "interactive subtitle"
  value is **blocked — MeCab** in this environment. (Honest degradation ✅, but the
  core feature is unavailable.)
- **Q4 Convenience**: Recommendations are convenient and relevant; the search "Найти"
  also depends on scraping+MeCab and would block. ⚠️
- **Outcome**: partial — recs `advances`; interactive playback `blocked — MeCab`
  (`/api/media/tokenize`). `/api/media/parse`→200. Screenshots:
  [p2-06-media.png](screenshots/p2-06-media.png),
  [p2-07-media-player.png](screenshots/p2-07-media-player.png).

### 3.6 `/practice/quiz?mode=review`

- **Q1 Clarity**: «Интервальный квиз 1/15», «Переведите слово на японский: цветок»,
  input accepts romaji, dual hints («Первый символ», «Словарное определение»),
  «Проверить». Clean. ✅
- **Q2 Next step**: Obvious — type and check. ✅
- **Q3 Missing function**: Nothing major for a single card; a visible session
  progress/score summary expectation at the end (not reached this run).
- **Q4 Convenience**: Romaji support + hints are beginner-friendly. ✅
- **Outcome**: advances (15-card review queue from my due words). Screenshot:
  [p2-08-quiz.png](screenshots/p2-08-quiz.png).

## 4. Problems found (P2)

| # | Category | Screen | Problem (observation only) |
|---|----------|--------|----------------------------|
| P2-A | learning-logic | `/` home | Progress header («0 слов использовано / 0 сессий / 0 XP / Уровень 0») contradicts «15 слов к повторению» on the same screen — deck-state and gamification-state disagree. |
| P2-B | navigation-ux | `/practice` | Multiple equally-weighted CTAs (review / themes / warm-up) with no single "recommended next" — mild choice paralysis for a returning beginner. |
| P2-C | navigation-ux | theme generation | ~20s Gemini wait with no visible "generating…" progress state — looks like it might have hung. |
| P2-D | bug / availability | media player | Interactive word-breakdown is unavailable because MeCab `:8000` is down — the headline "tap-to-learn subtitles" value is blocked in this env (degrades gracefully, but unavailable). |
| P2-E | learning-logic / copy | `/practice` | «Изучено сегодня: 4 из 10» counts seeded history as "today"; the "сегодня" framing can misrepresent what was actually done today. |
| P2-F | bug (dev-only) | Debug HUD (all) | The Debug HUD persistently shows «Слова на повторении (0)» / «Слова не найдены в БД» even though the main UI correctly shows 15 due — the HUD doesn't reflect the active profile's data. |
| P2-G | console | all | Repeated benign CSS-preload warning (same as 002 F-05 / P1-G). |

## 5. Learning-journey verdict (in character)

"This is where the app **shines**. Coming back, the home page greeted me, told me I
had 15 to review, and one click continued my journey. The **core loop is genuinely
coherent**: my words generated chat *themes about those words*, the chat *tracked
and checked off* the exact words I'm learning and *nudged me toward the next one*,
and the media recommendations were scored by how many of *my* words appear. I felt
the features were **one system**, not separate toys. Two things dented it: the home
**progress numbers contradicted themselves** (15 to review, but ‘0 used / 0
sessions / 0 XP’), which made me unsure how much I'd really done; and the
**video-learning feature couldn't actually break down words** here (the tokenizer
was down), so the one feature I poked from yesterday was the one that didn't fully
work. Practice also throws a lot of equally-loud buttons at me — I'd like the app to
just tell me ‘do this next’."

## 6. Limitations / snapshot note

- Hybrid state: deck/review state was **seeded**; XP/session/quest counters were
  **not**, so the gamification header reads 0 — interpret P2-A with that caveat
  (though the same-screen contradiction is still a real UX smell a real returning
  user could hit before earning XP). Glosses are real (hand-set N5 words).
- Media interactive playback was **blocked — MeCab `:8000` down**; recommendations
  (static feed) still worked. Gemini chat/session generation ran for real.
- Point-in-time snapshot; the chat reply and theme wording will vary on re-runs.

# RNA-Blueprint — Фаза 2 #4: японизация служебного UI + метки грамматики (P0/F15)

## 1. Base DNA
Windows / PowerShell · Next.js 16 · TS strict · React 19 · Vitest.

## 2. Task RNA
P0 «японизация служебного интерфейса слишком рано» (часть): навигация (`設定/プロフィール/ヘルプ`) в режиме `smart` авто-японизируется через FSRS для нулевого новичка. + F15: 3 «категорийные» грамма-ноды держат в `construction` японское/смешанное название-категорию.

Скоуп (90%-фикс без участия пользователя):
- **JpUI `kind`**: новый проп `kind: 'chrome' | 'content'` (default `content`). Для `chrome` в режиме `smart` — ранний возврат `ru` + НЕ регистрировать/апгрейдить (служебный UI никогда не «изучается»).
- **Навигация** (`page.tsx`, 3 элемента) → `kind="chrome"`.
- **F15** (`grammar_rules.json`): `construction` нод `g_n5_s2` (動詞の分類), `名詞修飾 / 〜の relative clauses`, `い / な-прилагательные` → русско-ориентированные метки, грамма-формы (〜の/い/な) в скобках.

ВНЕ scope (Фаза 3 #7): порог японизации `content`, сброс/тултип в `LanguageSwitcher`.

## 3. Contextual Constraints
- [CC-1] `construction` — двойного назначения: метка трека И описание в промпте Gemini. Валидация `validateUsedConstructions` ключится на **`id`** (`promptScope.ts:106`), НЕ на строку → менять текст безопасно для AI-скоупа.
- [CC-2] `ja`-режим (полный японский) для chrome НЕ трогаем — это явный выбор пользователя; правило только для `smart`.
- [CC-3] Метка `construction` не должна совпадать с `topic`/`translation` (иначе дубль текста в `GrammarTrack`/`GrammarTrainer`).

## 4. Proposed Changes
- `src/components/JpUI.tsx` [MODIFY] — проп `kind`, guard эффекта апгрейда, ранний возврат `ru` для chrome.
- `src/app/page.tsx` [MODIFY] — 3 нав-элемента `kind="chrome"`.
- `src/resources/grammar_rules.json` [MODIFY] — 3 `construction`.
- `src/components/__tests__/JpUI.test.tsx` [MODIFY] — репродьюсер chrome.
- `src/components/__tests__/GrammarTrainer.test.tsx` [MODIFY] — ассерт `動詞の分類` → новая метка.

## 5. Execution Steps
1. [TEST] JpUI репродьюсер: chrome в smart + прогресс в БД → остаётся `ru`, `ja` нет. Падает. [CC-2]
2. JpUI.tsx: `kind`, guard, ранний возврат. [CC-2]
3. page.tsx нав → `kind="chrome"`.
4. grammar_rules.json 3 метки [CC-1][CC-3]; обновить GrammarTrainer ассерт.
5. [TEST] `npm run test` (JpUI, GrammarTrack, GrammarTrainer, chat, promptScope) + `tsc`.
6. [CMD-2/CMD-4] CONTEXT_PROMPT строка фичи + CHANGELOG; счётчик тестов.

## 6. Verification & TDD reproducer
- `src/components/__tests__/JpUI.test.tsx`, кейс: «kind="chrome": в smart не японизируется даже при прогрессе в БД».
- Полный `npm run test` зелёный; `tsc --noEmit` чисто.

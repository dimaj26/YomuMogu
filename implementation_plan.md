# RNA-Blueprint — Фаза 2 #6: единый паттерн «недоступно» (errors.ts + ServiceUnavailable)

## 1. Base DNA
Windows / PowerShell · Next.js 16 · TS strict · React 19 · CSS Modules · Vitest.

## 2. Task RNA
Слой представления показывает сырой `error.message` («fetch failed», «Internal error»). Роуты grammar-verify/classify/etymology/chat утекают `error.message` пользователю. Нужен серверный классификатор + переиспользуемый UI «недоступно» + retry сетевых ошибок.

- **`lib/gemini/errors.ts`**: `classifyGeminiError(err) → { reason: 'config'|'transient'|'unavailable', message(рус), retryable }`; `isNetworkError(err)`; `geminiErrorResponse(err)` → структурный `NextResponse {error,reason,retryable}` (status 500). Сырой `error.message` — только в `logger`.
- **Роуты Gemini** (sessions, grammar-verify, etymology, classify, chat): catch → `geminiErrorResponse`. Проверка нет-ключа → reason `config`, retryable false.
- **`retry.ts`**: сетевые ошибки (`fetch failed`/ECONNREFUSED/...) теперь retryable.
- **`components/ServiceUnavailable.tsx`** (+css): человеческий заголовок + сообщение + опц. «что пока работает» + опц. «Повторить» (только retryable && onRetry).
- **Подключение**: practice (генерация тем) и GrammarTrainer (grammar-verify) — отдельный `serviceError` + `<ServiceUnavailable onRetry=...>`.

## 3. Contextual Constraints
- [CC-1] 3 reason: `config` (нет ключа/401/403 — НЕ retryable, без кнопки) / `transient` (429/500/503/сеть — retryable) / `unavailable` (прочее — retryable) [план P1].
- [CC-2] Сообщение transient содержит «временно недоступен» (совместимость с sessions-тестом eac0cfd).
- [CC-3] Сырой `error.message` НЕ уходит пользователю — только `logger` [CP-3.5].
- [CC-4] MeCab-down уже эталон (tokenizationSkipped, eac0cfd) — не трогаем.
- [CC-5] Валидационные ошибки (колода пуста и т.п.) — это user-actionable, НЕ ServiceUnavailable; оставить как есть.

## 4. Proposed Changes
- `src/lib/gemini/errors.ts` [NEW] + `__tests__/errors.test.ts` [NEW].
- `src/lib/gemini/retry.ts` [MODIFY] — сетевые retryable.
- `src/lib/gemini/__tests__/retry.test.ts` [NEW или MODIFY] — сетевой ретрай.
- `src/app/api/gemini/{sessions,grammar-verify,etymology,classify}/route.ts`, `src/app/api/chat/route.ts` [MODIFY] — geminiErrorResponse.
- route-тесты [MODIFY] — контракт reason/retryable, нет утечки.
- `src/components/ServiceUnavailable.tsx` + `.module.css` [NEW] + `__tests__/ServiceUnavailable.test.tsx` [NEW].
- `src/app/practice/page.tsx`, `src/components/GrammarTrainer.tsx` [MODIFY] — подключить.

## 5. Execution Steps
1. [TEST] errors.test.ts (config/transient/unavailable/network) → реализовать errors.ts.
2. retry.ts сетевые retryable + тест.
3. Роуты → geminiErrorResponse; обновить route-тесты (контракт).
4. [TEST] ServiceUnavailable.test.tsx → компонент + css.
5. Подключить practice (serviceError + onRetry=generateThemes) и GrammarTrainer.
6. [TEST] весь `npm run test` + `tsc`; превью чата/грамматики при сбое.
7. [CMD-1/2/4] доки.

## 6. Verification & TDD reproducer
- `errors.test.ts`: каждая ветка reason + retryable; `'fetch failed'`→transient+«временно недоступен».
- `ServiceUnavailable.test.tsx`: рендер сообщения; «Повторить» только при retryable&&onRetry.
- Полный `npm run test` зелёный; `tsc` чисто.

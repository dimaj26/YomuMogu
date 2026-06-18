# RNA-Blueprint — Фаза 3 #8: приём ромадзи в разминке/квизе (F10)

## 1. Base DNA
Windows / PowerShell · Next.js 16 · TS strict · React 19 · Vitest. **Без новых зависимостей** [CP-3.1].

## 2. Task RNA
Разминка и квиз ждут ввод каны (нужна японская раскладка/IME) — блокер для нулевого пользователя. Решение (принято 2026-06-17): принимать ромадзи, автоконвертить в кану; «Показать ответ» остаётся запасным.

Ключ: оба ввода (квиз `quiz/page.tsx:218`, разминка `practice/page.tsx:573`) идут через `isAnswerAcceptable(input, reading)`. → один фикс в `compare.ts` чинит обоих.

- **`lib/quiz/romaji.ts`**: pure `romajiToHiragana(input)` — конверсия ромадзи→хирагана (диграфы きゃ/しゃ/ちゃ, сокку っ, ん, проброс уже-каны/кандзи без изменений).
- **`compare.ts`**: `isAnswerAcceptable` принимает, если совпало напрямую ИЛИ `romajiToHiragana(input) === expected`.
- **UX-подсказка**: под полем ввода (квиз + разминка) ненавязчивый предпросмотр «→ {кана}», когда введены латинские буквы (не мутирует значение поля — избегаем проблемы «n+a»).

## 3. Contextual Constraints
- [CC-1] Без новых зависимостей — конвертер пишем сами [CP-3.1].
- [CC-2] Уже-кана/кандзи проходят через конвертер без изменений (пользователь с IME не страдает).
- [CC-3] Конвертер чистый/детерминированный → юнит-тесты [PL-9].
- [CC-4] Предпросмотр не мутирует state поля (полная переконверсия raw-строки на лету решает «na», но хранить конвертированное нельзя).

## 4. Proposed Changes
- `src/lib/quiz/romaji.ts` [NEW] + `__tests__/romaji.test.ts` [NEW].
- `src/lib/quiz/compare.ts` [MODIFY] — приём ромадзи; `compare.test.ts` [MODIFY] — кейсы ромадзи.
- `src/app/practice/quiz/page.tsx` [MODIFY] — кана-предпросмотр под полем.
- `src/app/practice/page.tsx` [MODIFY] — кана-предпросмотр под полем разминки.

## 5. Execution Steps
1. [TEST] romaji.test.ts (neko/nihon/gakkou/kitte/shashin/sensei + проброс каны) → romaji.ts.
2. compare.ts приём ромадзи + compare.test.ts кейсы.
3. Предпросмотр каны в квизе и разминке.
4. [TEST] весь `npm run test` + `tsc`; превью.
5. [CMD-1/2/4] доки.

## 6. Verification & TDD reproducer
- `romaji.test.ts`: базовые слоги, диграфы, っ, ん(конец/перед согласной), проброс каны.
- `compare.test.ts`: `isAnswerAcceptable('neko','ねこ')===true`, `'nihon'→'にほん'`, неверный ромадзи отклоняется.
- Полный `npm run test` зелёный; `tsc` чисто.

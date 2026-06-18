# RNA-Blueprint — Фаза 1 #3 (P2-копи/цвет/навигация)

## 1. Base DNA
Windows / PowerShell · Next.js 16 App Router · TS strict · React 19 · CSS Modules · Vitest.

## 2. Task RNA
Закрыть оставшиеся [ОЧЕВ]-находки Фазы 1 #3 из `_nogit_ux_fix_plan.md`. Фаза 1 #1 (`e5ec8d1`) и #2 (`eac0cfd`) уже сделаны. `[音楽]` (срез скобочных тегов) ВЫНЕСЕН в отдельную задачу — задевает токенизатор/караоке-пайплайн и Prime Directive [PL-8.8], не «очевидный» фикс.

Объём (5 находок):
- **0%-красный (медиа):** карточки медиа красят низкий CR в `--color-red` → нейтрально.
- **F8:** оранжевый баннер «доступно только N слов… могут повторяться» → смягчить.
- **F9:** «Осталось изучить по лимиту: N» рядом с «N из M» → согласовать подписи.
- **F7 жаргон:** `IndexedDB`, `Gemini`, `(mature)`, «по системе FSRS» → человеческий язык.
- **F5:** «Сохранить и начать» (диагностика) остаётся в настройках → вести в `/practice`.

## 3. Contextual Constraints
- [CC-1] User-facing strings — русский [CP-3.2]; технология (`Gemini`/`FSRS`/`IndexedDB`/`mature`) не утекает в casual UI [план F7].
- [CC-2] Science-виджеты (Transparency Showcase, дашборд-карточки) — намеренное объяснение технологии, НЕ трогать.
- [CC-3] Прайм-директива субтитров [PL-8.8] — поэтому `[音楽]` вне scope.
- [CC-4] TDD-репродьюсер для поведенческого F5 [Route A]; копи/цвет — [ОЧЕВ], без отдельных тестов.

## 4. Proposed Changes
- `src/app/practice/page.tsx` [MODIFY] — 0%-цвет (2 блока), F8 баннер, F9 подпись, F7 (FSRS/Gemini в casual-строках).
- `src/app/settings/page.tsx` [MODIFY] — F7 (IndexedDB/Gemini/mature), F5 (`router.push('/practice')` после сохранения).
- `src/app/settings/__tests__/page.test.tsx` [MODIFY] — capturable push-мок + F5-репродьюсер.

## 5. Execution Steps
1. [TEST] F5-репродьюсер в settings test (hoisted pushMock) — падает (push не вызывается). [CC-4]
2. settings/page.tsx: F5 `router.push('/practice')`; F7 строки 855/1184/1263. [CP-3.2]
3. practice/page.tsx: 0%-цвет (нейтраль), F8, F9, F7 (1248/1578). [CC-1][CC-2]
4. [TEST] `npm run test` (settings + practice + media) — зелёный.

## 6. Verification & TDD reproducer
- Файл: `src/app/settings/__tests__/page.test.tsx`, тест: «F5: после сохранения диагностики ведёт в /practice».
- `npm run test` целиком зелёный; ручная проверка не требуется (копи/нав).

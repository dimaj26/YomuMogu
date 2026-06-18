# RNA-Blueprint — `[音楽]` срез скобочных аннотаций (хвост Фазы 1)

## 1. Base DNA
Windows / PowerShell · Next.js 16 · TS strict · React 19 · Vitest.

## 2. Task RNA
Сырые скобочные звуковые аннотации (`[音楽]`, `[拍手]`) из авто-сабов YouTube видны пользователю на 3 поверхностях плеера. Закрыть display-time, без мутации хранимых `segments`.

Аудит Route B (proposal-auditor, PA-1) → **Вариант A (гибрид), score 6**: pure-хелпер display-only на всех 3 поверхностях + синхронный стрип локальной копии `words[]` перед `computeFillFraction` (иначе latent-рассинхрон караоке на смешанных eligible-сегментах). Факт от аудитора: `computeFillFraction` строит анкоры по `words[].text.length`, НЕ по символам `segment.text` → риск у́же; чисто-музыкальные сегменты отсекает `assessKaraokeQuality` (≥3 слов) до расчёта фронта.

## 3. Contextual Constraints
- [CC-3] Prime Directive [PL-8.8]: хранимые `segments` не мутировать — только display-копии.
- [CC-5] `♪` — осмысленный медиа-контент (level-aware ranking, 1.62.0), НЕ стрипать. Скобки `（）/()` — обычный контент/чтения, НЕ стрипать. Стрип только `[…]` и `【…】`.
- [CC-6] Кэш токенизации и health-poll-инвалидация должны использовать один и тот же (стрипнутый) ключ.

## 4. Proposed Changes
- `src/lib/media/captionDisplay.ts` [NEW] — pure `stripCaptionAnnotations(text)` + `stripAnnotationWords(words)`.
- `src/lib/media/__tests__/captionDisplay.test.ts` [NEW] — репродьюсеры.
- `src/components/MediaInteractivePlayer.tsx` [MODIFY] — вход токенизатора (342 + poll 401), сырой путь (782), список (811), `words` перед `computeFillFraction` (733).
- `PROJECT_LOGIC.md` [MODIFY] — реестр нового модуля + счётчик тестов.

## 5. Execution Steps
1. [TEST] captionDisplay.test.ts: стрип `[…]/【…】`, сохранение `♪` и `（）`, смешанный `[音楽] こんにちは`, синхронный `stripAnnotationWords` → падает (нет модуля). [CC-4]
2. captionDisplay.ts — реализовать обе чистые функции. [CC-5]
3. Wire в MediaInteractivePlayer (5 точек), хранимые segments не трогать. [CC-3][CC-6]
4. [TEST] `npm run test` (captionDisplay + MediaInteractivePlayer) зелёный; `tsc --noEmit`.
5. [CMD-1] PROJECT_LOGIC реестр + счётчик; [CMD-4] CHANGELOG.

## 6. Verification & TDD reproducer
- Файл `src/lib/media/__tests__/captionDisplay.test.ts`, кейсы: `strips [..]/【..】 sound tags`, `keeps ♪ and （）`, `mixed segment → speech only + words synced`, `pure-annotation words filtered out`.
- Полный `npm run test` зелёный.

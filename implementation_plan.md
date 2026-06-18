# RNA-Blueprint — Фаза 3 #7: порог японизации контента + описания режимов

## 1. Base DNA
Windows / PowerShell · Next.js 16 · TS strict · React 19 · Vitest.

## 2. Task RNA
P0 «японизация слишком рано» (хвост): даже контент (не chrome) в `smart` авто-японизируется с уровня 0 — нулевой новичок видит японский контент, к которому не готов. + UX `LanguageSwitcher`: режимы без пояснений; пользователь не понимает Smart и где сбросить прогресс.

Скоуп:
- **`CONTENT_JP_MIN_LEVEL = 2`**: `upgradeWord` (`JpUIProvider`) не апгрейдит контент, пока `jState.level < 2` → нулевому новичку контент по-русски. (chrome уже не апгрейдится — #4.)
- **`LanguageSwitcher`**: краткое описание под каждым режимом; для Smart — что интерфейс постепенно японизируется и что сброс доступен в Настройках.

ВНЕ scope (осознанно): подключение `resetUiProgress` прямо в свитчер — требует `useJpUI` (бросает без `JpUIProvider`) → провайдер пришлось бы оборачивать в тестах дашборда/practice/a11y. Сброс УЖЕ есть в Настройках («Сбросить FSRS интерфейса»); свитчер на него указывает тултипом.

## 3. Contextual Constraints
- [CC-1] Порог — уровневый гейт японизации, НЕ scheduling-интервал → не в `intervals.ts` (Route B не требуется) [CP-3.7].
- [CC-2] Порог гейтит только НОВЫЕ апгрейды; уже-выученные слова уровень не понижает (XP только растёт) — отдельный render-гейт не нужен.
- [CC-3] chrome уже исключён из апгрейда (#4) — порог касается только content.
- [CC-4] `LanguageSwitcher` использует только `useJapanification` — не добавлять `useJpUI` (избежать coupling/черна тестов).

## 4. Proposed Changes
- `src/components/JpUIProvider.tsx` [MODIFY] — `CONTENT_JP_MIN_LEVEL` + гейт в `upgradeWord`.
- `src/components/__tests__/JpUI.test.tsx` [MODIFY] — порог: level<2 контент по-русски; level≥2 апгрейдится.
- `src/components/LanguageSwitcher.tsx` [MODIFY] — описания режимов.
- `src/components/__tests__/LanguageSwitcher.test.tsx` [MODIFY] — описание Smart присутствует.

## 5. Execution Steps
1. [TEST] JpUI: порог (level<2 ru / level≥2 ja) → реализовать гейт.
2. [TEST] LanguageSwitcher описание Smart → добавить описания.
3. [TEST] весь `npm run test` + `tsc`.
4. [CMD-1/2/4] доки.

## 6. Verification & TDD reproducer
- `JpUI.test.tsx`: «content при level<2 остаётся ru», «content при level≥2 японизируется».
- `LanguageSwitcher.test.tsx`: описание Smart-режима в выпадающем списке.
- Полный `npm run test` зелёный; `tsc` чисто.

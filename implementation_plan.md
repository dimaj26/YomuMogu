# RNA-Blueprint — Фаза 2 #5: адаптивный дашборд-хаб + извлечение AssessmentModal

## 1. Base DNA
Windows / PowerShell · Next.js 16 · TS strict · React 19 · CSS Modules · Vitest.

## 2. Task RNA
Дашборд (`page.tsx`) не читает состояние колоды: статичный CTA `Link→/practice` для всех (адаптируется лишь «Продолжить чат»). Маркетинговый H1 показывается всем. Диагностика живёт в `settings` и редиректит туда.

Цель: дашборд читает существующие сигналы `localDeckService` и показывает ОДИН адаптивный CTA + мягкую подсказку; первый запуск открывает диагностику МОДАЛОМ на `/`. Извлечь модал в переиспользуемый `components/AssessmentModal.tsx`.

5 состояний CTA:
| Состояние | Условие | CTA |
|---|---|---|
| Первый запуск | local && `!isLocalDeckInitialized` | «Пройти диагностику (5 мин)» → модал на `/` |
| Незаверш. чат | `hasActiveChat` | «Продолжить: {тема}» (есть) |
| Вернувшийся | due-повторения > 0 | «Продолжить обучение» → /practice + «N к повторению» |
| Новичок | priority>0, due=0 (только новые) | «Начать разминку» → /practice |
| Всё сделано | priority===0 | нейтрально «на сегодня всё; можно медиа» |
Anki-режим: generic «Начать практику» (сигналы local не применимы).

Маркетинговый H1/подзаголовок — только «первый запуск»; для остальных — состояние-зависимый заголовок без давления (§7.6).

## 3. Contextual Constraints
- [CC-1] SSR: все чтения localStorage/IndexedDB в `useEffect` [PL-8.3].
- [CC-2] Извлечение AssessmentModal — поведенчески-нейтрально: settings-тесты (вкл. F5-репродьюсер) остаются зелёными; «Сохранить и начать» по-прежнему ведёт в /practice через `onSaved`.
- [CC-3] XP/уровни — декорация, не входной сигнал [PL-7.1]; CTA опирается ТОЛЬКО на колоду/сессию.
- [CC-4] Не строить «мастер дня» — один CTA + подсказка [план P0].
- [CC-5] `getPriorityWordsCount` уже = due + new-в-квоте; due-повторения считаю отдельно для разделения «вернувшийся/новичок».

## 4. Proposed Changes
- `src/components/AssessmentModal.tsx` [NEW] — инкапсулирует загрузку колоды/статусов, выбор, сохранение (`importStarterDeck`); props `isOpen/profileId/onClose/onSaved/onError`.
- `src/components/AssessmentModal.module.css` [NEW] — классы модала (копия из settings).
- `src/app/settings/page.tsx` [MODIFY] — заменить инлайн-модал + хендлеры на `<AssessmentModal>`; `onSaved`→ навигация /practice (сохранить F5).
- `src/app/page.tsx` [MODIFY] — адаптивный CTA (5 состояний), заголовки, `<AssessmentModal>` для первого запуска.
- `src/components/__tests__/AssessmentModal.test.tsx` [NEW] — рендер/сохранение/onSaved.
- `src/app/__tests__/page.test.tsx` [MODIFY] — репродьюсеры состояний дашборда.

## 5. Execution Steps
1. [NEW] AssessmentModal.module.css + AssessmentModal.tsx (перенос логики 1:1). [CC-2]
2. settings: подключить `<AssessmentModal>`, удалить инлайн; прогнать settings-тесты (F5 зелёный). [CC-2]
3. [TEST] dashboard-репродьюсеры: first-run→диагностика, due→«Продолжить обучение»+N, new→«разминка», done→нейтрально, anki→generic. Падают.
4. page.tsx: сигналы в `useEffect`, derive state, адаптивный CTA + заголовки + модал. [CC-1][CC-3]
5. [TEST] `npm run test` весь + `tsc`.
6. [CMD-1/2/4] PROJECT_LOGIC (реестр+счётчик), CONTEXT_PROMPT (строка фичи), CHANGELOG.

## 6. Verification & TDD reproducer
- `src/app/__tests__/page.test.tsx`: кейсы по 5 состояниям (сид IndexedDB local-words + active_session).
- `AssessmentModal.test.tsx`: «save → importStarterDeck + onSaved».
- Полный `npm run test` зелёный; `tsc --noEmit` чисто.

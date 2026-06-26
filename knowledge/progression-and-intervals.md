---
name: progression-and-intervals
description: Decorative XP/level invariant and the single-source-of-truth registry of all timing/interval systems (core/intervals.ts).
---

# Progression (XP) & Interval Systems Registry

Formerly `PROJECT_LOGIC.md` [PL-7] and [PL-10]. Changing any interval constant requires an architectural audit first.

## [PL-7] Progression & Immersion Decoration

To encourage user engagement, YomuMogu displays decorative progression levels and XP stats in the UI.

### [PL-7.1] Decorative XP and Level
- XP is write-only decoration feeding the dashboard widget; it must never be read as an input by any functional feature.
- Levels (0–6) are calculated based on earned XP to serve as a decorative progress indicator.
- UI immersion is determined solely by the manual `uiMode` setting, completely independent of XP.

### [PL-7.2] XP Sources
- Word used correctly in chat: +1 XP per word
- Grammar correct: +1 XP bonus
- Session completed (80% words collected): +5 XP
- Quests: Daily quests serve as goal-setting and feedback and do not award any XP.

## [PL-10] Interval Systems Registry

Все временные ограничения, шаги планирования и интервалы сгруппированы в едином изолированном файле `src/core/intervals.ts`. Любые изменения значений должны производиться исключительно после проведения архитектурного аудита.

| Система | Описание / Назначение | Константы в `src/core/intervals.ts` | Владелец | Потребители |
|---|---|---|---|---|
| **[СИСТЕМА 1]** Dual-curve FSRS | Динамический расчет интервалов слов в IndexedDB | *Констант нет (НЕ дублировать ts-fsrs)* | `core/scheduler.ts` | `core/scheduler.ts`, `/api/anki/sync-db` |
| **[СИСТЕМА 2]** Leitner грамматика | Дни между повторениями ступеней грамматики | `GRAMMAR_LEITNER_INTERVALS_DAYS` | `grammar_progress` DB | `GrammarTrack.tsx`, `GrammarTrainer.tsx` |
| **[СИСТЕМА 3]** Угасающая фуригана | Дни active.interval для уровней видимости | `FURIGANA_FADE_FROM_DAYS`, `FURIGANA_HIDE_FROM_DAYS`, `FURIGANA_FADE_OPACITY` | `lib/chat/furigana.ts` | `lib/chat/furigana.ts`, `JpUI.tsx` |
| **[СИСТЕМА 4]** Режим беглости | Ограничение хода = max(FLOOR, (OFFSET + PER_LEVEL * lvl) * round_factor) | `FLUENCY_FLOOR_SECONDS`, `FLUENCY_BASE_OFFSET_SECONDS`, `FLUENCY_BASE_PER_LEVEL_SECONDS`, `FLUENCY_ROUND_FACTORS` | `lib/chat/fluency.ts` | `lib/chat/fluency.ts`, `app/chat/page.tsx` |
| **[СИСТЕМА 5]** Daily-квесты | Час сброса прогресса квестов (локальное время) | `QUEST_RESET_HOUR` | `hooks/useQuests.ts` | `hooks/useQuests.ts` |
| **[СИСТЕМА 6]** Профиль компетентности | Лимиты сессий/ходов, пороги закрытия JLPT уровней и рекомендации уровня чата | `COMPETENCY_MIN_SESSIONS`, `COMPETENCY_MIN_TURNS`, `COMPETENCY_SESSION_CAP`, `ADVICE_UP_GRAMMAR_COVERAGE`, `ADVICE_UP_CORRECTION_RATE`, `ADVICE_DOWN_CORRECTION_RATE`, `LADDER_COMPLETE_LEX_COVERAGE`, `LADDER_COMPLETE_GRAMMAR_COVERAGE` | `lib/competency/profile.ts` | `lib/competency/profile.ts`, `app/chat/page.tsx`, `LearningTrack.tsx` |
| **[СИСТЕМА 8]** Баланс структура-иммерсия | Рекомендуемая доля структуры по JLPT уровню, размер скользящего окна, минимальное число действий | `BALANCE_STRUCTURE_TARGET`, `BALANCE_ACTIVITY_WINDOW`, `BALANCE_MIN_ACTIVITIES` | `lib/balance/balance.ts` | `components/BalanceWidget.tsx`, `app/practice/page.tsx`, `app/chat/page.tsx`, `app/practice/quiz/page.tsx` |

> Note: [СИСТЕМА 7] (exposure counter) was removed when the dual-curve was collapsed — passive learning is no longer instrumented. A future [СИСТЕМА 9] Time-budget is proposed in the roadmap (P0) but not yet implemented.

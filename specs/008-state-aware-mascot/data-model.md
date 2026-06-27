# Phase 1 Data Model: State-Aware Mascot Greeting

No schema change. Existing data only.

## Dashboard state (existing `DashState`)

The home page computes `dashState: 'resume' | 'first-run' | 'returning' | 'newbie' |
'all-done' | 'anki'` (page.tsx ~line 300) and uses it for the headline + primary CTA.
This feature feeds the same value into the mascot greeting.

| State | Mascot next-step (mirrors CTA) |
|-------|--------------------------------|
| `resume` | existing resume-session bubble (unchanged, handled before the switch). |
| `first-run` | point to the diagnostic. |
| `newbie` | point to the warm-up. |
| `returning` | reviews waiting / continue. |
| `all-done` | neutral "all done for today". |
| `anki` / default | safe generic greeting. |

No new persisted fields; the greeting is a render-time function of the existing
state (and japanification level, which still selects RU vs JA for levels ≥ 1).

# Phase 1 Data Model: Onboarding Flow Clarity

This feature introduces **no new data**. It reads one existing piece of state to
switch user-facing copy. Documented here for completeness.

## Local-list initialization state (existing)

Whether the local 500-word starter deck has been seeded by the knowledge
diagnostic (AssessmentModal).

| Aspect | Detail |
|--------|--------|
| **Meaning** | `false` = fresh profile, deck not yet initialized; `true` = diagnostic completed, deck seeded. |
| **Source (home)** | `isLocalInit` — `src/app/page.tsx:54` (already used at `:300` to choose `first-run` dashboard state). |
| **Source (practice)** | `isLocalInitialized` — `src/app/practice/page.tsx:154` (already used at `:1201`). |
| **Derivation** | Computed from the existing local-deck/profile read each page already performs; no new read, write, or persistence. |
| **Drives** | F-04 home grid description; F-03 practice warm-up explanation; (F-02 uses session presence, not this flag). |

### State transition (copy follows state)

```
!initialized ──(diagnostic completes / deck seeded)──> initialized
   │                                                        │
   ▼                                                        ▼
home grid: "не инициализирована, пройдите диагностику"   home grid: existing 500-word text
practice : show "пройдите диагностику" line              practice : line hidden; warm-up enabled
```

The transition is automatic: each page already recomputes the flag on load/profile
change, so no manual refresh is required (spec edge case "Transition moment").

## Session presence (existing) — for F-02 only

| Aspect | Detail |
|--------|--------|
| **Meaning** | `chat/page.tsx` renders the empty state when `!session` (`:1453`). |
| **Change** | Only the empty-state CTA destination/label changes; the condition is untouched. |

No entities, schemas, or storage namespaces are added or modified.

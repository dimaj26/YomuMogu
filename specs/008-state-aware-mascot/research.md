# Phase 0 Research: State-Aware Mascot Greeting

No `NEEDS CLARIFICATION`. Decisions:

## Decision 1 — Drive the level-0 greeting from dashState (pass it in)

- **Decision**: Add a `state: DashState` parameter to `getMascotBubbleHtml` and call
  it with `dashState` (computed at render line 300, before the call site at 354).
  The level-0 branch switches on `state`.
- **Rationale**: `dashState` is the single source of truth the visible CTA already
  uses; mirroring it guarantees mascot/CTA agreement. Passing it in (vs closure)
  avoids any temporal-dead-zone ambiguity and is explicit/testable.
- **Alternatives considered**: Closure over `dashState` (works, but passing is
  clearer); recompute state inside the helper (rejected — duplication/divergence).

## Decision 2 — Only level-0 changes; preserve the rest

- **Decision**: Keep the `customBubbleText` early return, the resume-session bubble
  (`hasActiveChat && activeSession`), and the Japanese greetings (level 1/2/default)
  exactly as-is. Only the level-0 Russian greeting becomes state-aware.
- **Rationale**: The bug is specific to the level-0 misdirecting line; the others are
  correct. Minimal, regression-safe (FR-003/FR-004).

## Decision 3 — State→message mapping (adjustable copy)

- **Decision**: first-run → point to the diagnostic; newbie → point to the warm-up;
  returning → reviews waiting / continue; all-done → neutral "all done for today";
  anki/default → safe generic greeting. No reference to "раздел практики".
- **Rationale**: Each mirrors that state's existing CTA/headline so mascot and button
  agree. Exact wording is a reasonable default the team can tweak (FR-007).

## Decision 4 — Test in the existing Home suite (Test-First)

- **Decision**: Add a first-run case to `home-grid.test.tsx`: render Home with no
  deck → mascot bubble contains the diagnostic wording and does NOT contain
  «раздел практики».
- **Rationale**: That suite already renders Home with providers; natural home; proves
  the core misdirection is gone.

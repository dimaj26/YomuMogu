# Quickstart: Validate Competency Per-Level Coverage

## Automated tests (required gate)

```powershell
npx vitest run src/lib/competency/__tests__/profile.test.ts
npm run test
```

Expected: green, including —
- `computeAllLevelCoverages` returns lex+grammar for all five levels.
- `deriveActiveLevel`: N5+N4 complete → 'N3'; N5-only / empty → 'N5'.
- existing competency tests (`buildCompetencyProfile`, etc.) stay green.

## Optional live check

With a seeded advanced profile (all N5+N4 grammar mature + high vocab coverage),
open `/practice`: the balance widget shows the real working level (e.g. «(N3)») and
the learning track marks N5/N4 completed with N3 active — instead of «(N5)» / all
locked. A fresh/N5 learner still shows N5.

## Done when

- [ ] Active level = first non-completed by the existing rule (SC-001); N5-only → N5
      (SC-002).
- [ ] Per-level statuses reflect real coverage (SC-003).
- [ ] No FSRS/chat-scoping/threshold/grammar-content change (SC-004).
- [ ] Tests pass; ESLint clean.

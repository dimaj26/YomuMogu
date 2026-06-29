# Quickstart: Validate First-Run "How It Works"

## Automated tests (required gate)

```powershell
npx vitest run src/app/__tests__/home-grid.test.tsx
npm run test
```

Expected: green, including —
- **first-run** (no deck): the «Как это работает» 3-step overview renders.
- **initialized deck** (any non-first-run): the overview is absent.
- existing Home/grid cases stay green.

## Optional live check

Fresh profile → home: a compact «Как это работает» (диагностика → разминка/повторения
→ диалог с ИИ) appears above «Пройти диагностику». After running the diagnostic
(deck initialized), it's gone.

## Done when

- [ ] First-run shows the 3-step overview before the CTA (SC-001); absent otherwise
      (SC-002).
- [ ] No nav/CTA/FSRS/other-screen change (SC-003).
- [ ] Tests pass; ESLint clean.

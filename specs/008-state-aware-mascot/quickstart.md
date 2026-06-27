# Quickstart: Validate State-Aware Mascot Greeting

## Automated tests (required gate)

```powershell
npx vitest run src/app/__tests__/home-grid.test.tsx
npm run test
```

Expected: green, including —
- **first-run** (no deck): the mascot bubble points to the diagnostic and does NOT
  contain «раздел практики».
- existing Home/grid cases stay green.

## Optional live check

Fresh profile → home: mascot says "пройди диагностику" (matching the «Пройти
диагностику» CTA), not "перейди в раздел практики". After diagnostics (newbie): it
points to the warm-up. With reviews due (returning): it mentions reviews.

## Done when

- [ ] First-run bubble matches the diagnostic CTA; no «раздел практики» (SC-001/SC-002).
- [ ] Resume + japanified greetings unchanged (SC-003); no nav/CTA/FSRS change (SC-004).
- [ ] Tests pass; ESLint clean.

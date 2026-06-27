# Quickstart: Validate Memory Map Scaling

## Automated tests (required gate)

```powershell
npx vitest run src/app/__tests__/home-grid.test.tsx
npm run test
```

Expected: green, including the cases —
- **>500 words**: all words are represented across the 50 cells (none dropped) and
  the caption shows the real total N.
- **exactly 500**: caption shows 500; binning identical to before (regression).
- **<500 words**: caption shows the real (smaller) N.
- **uninitialized**: caption is the feature-003 "not initialized → diagnostic" text.

## Optional live check

With a seeded large profile (e.g. the 004 `p3_master` ~4000 words), open the home
dashboard and confirm:
- the Kumiko caption reads the real count (e.g. «…состояние 4000 слов…»), not 500;
- the grid's cells reflect the whole deck's stability/status spread, not just the
  first 500 by insertion order.

## Done when

- [ ] Tests pass; full suite green; ESLint clean.
- [ ] For N>500 the caption shows N and no words are dropped from the map (SC-001).
- [ ] N=500 unchanged (SC-002); uninitialized unchanged (SC-003).

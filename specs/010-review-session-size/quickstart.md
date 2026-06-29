# Quickstart: Validate Review Session-Size Selector

## Automated tests (required gate)

```powershell
npx vitest run src/app/practice/quiz/__tests__/page.test.tsx
npm run test
```

Expected: green, including —
- seed > N due cards; review with `limit=N` → exactly N cards, highest-need first
  (cap applied after the 006 ordering).
- no `limit` (or «Все») → the full due set loads (unchanged).
- existing quiz cases (empty state, grading, new-mode, 006 ordering) stay green.

## Optional live check

With a large seeded profile, open `/practice`: pick «20» → the review session has
20 of the most-overdue/weakest cards; «Все» → the full backlog as before. The
practice «Начать повторение [N]» count still shows the true full due count.

## Done when

- [ ] Capped session = chosen size of highest-need cards (SC-001); «Все» = full set
      (SC-002); below-size = all due, no error (SC-003).
- [ ] Other modes / FSRS / `[N]` count unchanged (SC-004).
- [ ] Tests pass; ESLint clean.

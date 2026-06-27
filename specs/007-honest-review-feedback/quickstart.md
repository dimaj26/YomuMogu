# Quickstart: Validate Honest Review Feedback

## Automated tests (required gate)

```powershell
npx vitest run src/app/practice/__tests__/page.test.tsx
npm run test
```

Expected: green, including —
- **all-new deck** (no review/learning words): active-review card shows the neutral
  "haven't started reviewing yet" message; congratulations is absent.
- **≥1 review/learning, none due**: congratulations «Все активные слова повторены!
  Отличная работа.» appears (unchanged).
- **≥1 due**: the "N ready for review" count message appears (unchanged).
- Existing practice tests stay green.

## Optional live check

Fresh profile → run diagnostics (deck all-new) → open `/practice`: the active-review
card should NOT congratulate; it should point to the warm-up. After warming up some
words into learning/review, the message changes appropriately.

## Done when

- [ ] Tests pass; full suite green (note any load-flaky suites that pass in isolation); ESLint clean.
- [ ] No false praise on a fresh all-new deck (SC-001); genuine praise preserved (SC-002); count unchanged (SC-003).

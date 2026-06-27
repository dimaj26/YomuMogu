# Quickstart: Validate Prioritized Review Ordering

## Automated tests (required gate)

```powershell
npx vitest run src/app/practice/quiz/__tests__/page.test.tsx
npm run test
```

Expected: green, including the new case —
- Seed ≥3 due cards with differing lapses / stability / due in review (default)
  mode → the highest-need card (most lapses, else weakest, else most overdue) is
  presented first; a lower-need card is not shown yet.
- Existing quiz tests (empty state, correct-answer grading, new-mode, shortcuts)
  stay green (no regression).

## Optional live check

With a seeded large profile (e.g. 004 `p3_master`), open `/practice/quiz?mode=review`
and confirm the first cards are the most-overdue / most-lapsed, not random.

## Done when

- [ ] New ordering test passes; full quiz suite green; ESLint clean.
- [ ] Review order is deterministic highest-need-first (SC-001/SC-002).
- [ ] New-word / unused-target modes and FSRS grading unchanged (SC-003).
- [ ] Full due set still presented — no cap (SC-004).

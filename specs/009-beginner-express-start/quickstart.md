# Quickstart: Validate Beginner Express-Start

## Automated tests (required gate)

```powershell
npx vitest run src/components/__tests__/AssessmentModal.test.tsx
npm run test
```

Expected: green, including —
- click «Я начинаю с нуля» → starter deck seeded in IndexedDB, all words status
  'new', and `onSaved` called.
- existing AssessmentModal tests (isOpen=false; «Сохранить и начать» import) stay
  green.

## Optional live check

Fresh profile → open the diagnostic → click «Я начинаю с нуля»: the deck initializes
(home/practice now show the seeded all-new deck) without having to mark anything.

## Done when

- [ ] Express button seeds an all-new deck + calls onSaved (SC-001/SC-002).
- [ ] Existing save/cancel/close unchanged (SC-003); no FSRS/schema change (SC-004).
- [ ] Tests pass; ESLint clean.

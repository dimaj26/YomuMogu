# Quickstart: Validate Onboarding Flow Clarity

Two layers of validation: automated tests (gate) and an optional live re-walk
(confirms the 002 findings are resolved). PowerShell.

## Automated tests (required gate)

Run the co-located suites for the touched pages:

```powershell
npx vitest run src/app/chat/__tests__/page.test.tsx src/app/practice/__tests__/page.test.tsx src/app/__tests__/home-grid.test.tsx
```

Expected: all green, including the new cases asserting the
[ui-states contract](contracts/ui-states.md):

- **F-02**: empty `/chat` renders an action that navigates to `/practice`.
- **F-03**: practice shows the "run diagnostic" line when `!isLocalInitialized`,
  and hides it when initialized.
- **F-04**: home grid description switches on `isLocalInit`.

Full suite stays green:

```powershell
npm run test
```

## Documentation check (F-01)

Open `knowledge/architecture.md` [CP-2.1] and confirm the primary numbered flow is
local-first and Anki is a labelled opt-in branch, with no internal contradiction.

## Optional live re-walk (confirms findings closed)

With the dev app running (`npm run dev`), re-run the
[002 cognitive walkthrough](../../knowledge/cognitive-walkthrough.md) on a fresh
profile and confirm:

- `/chat` empty state → action goes to `/practice` (F-02).
- `/practice` shows the diagnostic explanation near the disabled warm-up (F-03).
- `/` grid description no longer claims 500 words before diagnostics (F-04).
- The gate still holds: quiz/chat unreachable without running the diagnostic
  (SC-005 / contract invariants).

## Done when

- [ ] New tests pass and the full suite stays green (ESLint clean).
- [ ] The three fresh-profile surfaces give one consistent "run the diagnostic"
      message (SC-002); after diagnostics, none still show it (SC-003).
- [ ] The architecture core-flow reads local-first (SC-004).
- [ ] The onboarding funnel is unchanged (SC-005 / invariants).

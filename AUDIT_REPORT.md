# Frontend Audit Report — 2026-05-24

## Executive Summary

The YomuMogu project follows modern Next.js 15 app router standards and is generally well-structured. During the compilation of previous audit logs, it was found that several critical security issues (such as HTML sanitization and client-side AnkiConnect client restriction) have already been resolved. However, several critical performance bottlenecks (re-render storms in the React Context provider), duplicate Next.js configuration issues, lack of unified error handling boundaries, and accessibility gaps still remain.

This report summarizes both the implemented fixes and compiles the remaining actions needed to secure and optimize the codebase.

---

## Critical Issues (Must Fix)

### P0 — High Risk / System Integrity
- **P0.1 — Next.js Configuration Conflict**: The repository contains both `next.config.ts` and `next.config.mjs`. This causes configuration conflicts during Next.js builds. The Content Security Policy (CSP) headers in `next.config.mjs` must be consolidated into `next.config.ts`, and the duplicate file removed.
- **P0.2 — Performance Re-Render Storm in Context Provider**: The `JapanificationProvider` context value is recreated on every render. Because the context value object is not memoized, any state change triggers a cascade of re-renders across all consumer components, impacting chat response time and keyboard responsiveness.

### P1 — Security & Architecture
- **P1.1 — No CSRF Protection on Mutating API Routes**: State-changing POST routes (like `/api/anki/sync-db`, `/api/anki/add`, etc.) accept requests without CSRF verification.
- **P1.2 — Local-First State Bypass**: The `useJapanification()` hook falls back to creating an isolated local state instance if used outside the context provider, instead of enforcing context encapsulation.

---

## Important Issues

### P2 — Stability, UX & accessibility
- **P2.1 — Lack of Unified Error Boundaries and Loading States**: Component fetch requests lack uniform loading wrappers, try-catch handlers, or UI fallbacks, leading to silent failures or screen crashes if API routes timeout.
- **P2.2 — Accessibility (a11y) & Keyboard Traps**: Modals do not implement keyboard focus traps or `Escape` key close events, and the custom dropdown trigger in `LanguageSwitcher.tsx` lack full keyboard navigation controls.
- **P2.3 — Missing UI Integration Tests**: The project has unit tests for routes and simple components, but lacks integration tests validating page-level UI state transitions (e.g. syncing decks or starting chat sessions).

---

## Recommendations & Improvements

- **Merge configurations**: Consolidate Next.js settings into `next.config.ts` using TypeScript types.
- **Memoize Provider State**: Wrap the context value of `JapanificationProvider` in `useMemo` to prevent unnecessary component renders.
- **Error Handling Architecture**: Implement a global `ErrorBoundary` and a reusable API fetch hook (`useApiCall`) to centralize error reporting and state management.
- **Keyboard Navigation**: Add Arrow key navigation and focus trapping to UI popups.

---

## Detailed Action Plan

### 1. Consolidate next.config.ts and next.config.mjs
- **File(s)**: [next.config.ts](file:///C:/YomuMogu/next.config.ts), [next.config.mjs](file:///C:/YomuMogu/next.config.mjs)
- **Why**: Having both files violates Next.js build contracts and can cause the CSP header configuration to be ignored depending on build ordering.
- **Fix**: Move the headers array logic into `next.config.ts` and remove `next.config.mjs`.

### 2. Fix useJapanification Re-render Storm
- **File(s)**: [useJapanification.tsx](file:///C:/YomuMogu/src/hooks/useJapanification.tsx)
- **Why**: Currently, `useJapanificationInternal()` returns a brand new object reference on every render, triggering full DOM updates for all components importing `useJapanification`.
- **Fix**: Memoize the returned object using `useMemo` and ensure `useJapanification` throws an error if called outside `JapanificationProvider` to prevent state fragmentation.

### 3. Implement Unified Error Handling & API Loading Hooks
- **File(s)**: `src/components/ErrorBoundary.tsx` [NEW], `src/components/ErrorFallback.tsx` [NEW], `src/hooks/useApiCall.ts` [NEW], `src/app/error.tsx` [NEW]
- **Why**: Currently, if Anki Desktop is closed or Gemini API rate-limits, requests fail silently or throw unhandled exceptions in the client console.
- **Fix**: Create an ErrorBoundary and a hook to wrap all client-side `fetch` calls, providing toast alerts and loading state management automatically.

### 4. Accessibility Enhancements in LanguageSwitcher
- **File(s)**: [LanguageSwitcher.tsx](file:///C:/YomuMogu/src/components/LanguageSwitcher.tsx)
- **Why**: Users navigating via keyboard are locked out of selecting translation modes because dropdown keyboard focus traversal is not configured.
- **Fix**: Add Arrow keys and Enter/Space handler listener bindings to listbox options.

### 5. CSRF Protection for API Routes
- **File(s)**: `src/lib/csrf.ts` [NEW], API routes in `src/app/api/anki/*/route.ts`
- **Why**: Mutating POST routes are vulnerable to Cross-Site Request Forgery.
- **Fix**: Implement an `Origin` header check against the local host.

### 6. Dependency Audit
- **File(s)**: `package.json`
- **Why**: Potential outdated dependencies with security vulnerabilities.
- **Fix**: Run `npm audit` and apply necessary patches.

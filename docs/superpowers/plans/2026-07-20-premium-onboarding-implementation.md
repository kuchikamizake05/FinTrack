# FinTrack Premium Onboarding Implementation Plan

Design source: `docs/superpowers/specs/2026-07-20-premium-onboarding-design.md`

## Delivery constraints

- No database migration.
- No real Supabase writes during automated browser tests.
- Reuse existing account, transaction, auth, error, and UI contracts.
- Preserve the approved mint, white, navy, and emerald visual system.
- Keep all legacy-user and protected-route behavior green.

## Task 1 — Domain state machine and storage contract

Files:

- Create `lib/onboarding.ts`.
- Create `lib/onboarding.test.ts`.

Steps:

1. Write failing tests for eligibility, legacy bypass, active-journey continuation, step resolution, storage-key scoping, progress parsing/versioning, seven-day deferral, redirect decisions, and completion summary.
2. Implement pure types and functions without browser, router, React, or Supabase dependencies.
3. Compose account and transaction validation through existing domain helpers rather than duplicating financial rules.
4. Run the focused tests, then the full unit suite.

## Task 2 — Shared authenticated onboarding gate

Files:

- Create `components/OnboardingBoundary.tsx`.
- Update `components/AppBoundary.tsx`.
- Update `lib/auth.ts` and `lib/auth.test.ts`.
- Update `app/layout.tsx` if composition needs an explicit boundary layer.

Steps:

1. Add `/onboarding` to the protected-route model.
2. Resolve the authenticated user before reading per-user progress.
3. Query minimal account and transaction existence only for unresolved users.
4. Implement `loading`, `legacy-active`, `onboarding-required`, `onboarding-active`, `deferred`, and `completed` behavior.
5. Redirect empty users to onboarding without exposing protected content; preserve sanitized `next` only for active users.
6. Fail safely with a retry state when eligibility cannot be determined.

## Task 3 — Focused onboarding route

Files:

- Create `app/onboarding/page.tsx`.
- Create focused presentational components under `components/onboarding/` when they have one clear responsibility.
- Reuse `components/ui/Button.tsx`, `Field.tsx`, and existing style contracts.

Steps:

1. Build the responsive onboarding shell and accessible progress indicator.
2. Implement Welcome/intent, First account, First transaction, and First value states.
3. Persist only versioned non-financial progress metadata per user.
4. Save account and transaction sequentially through Supabase with existing RLS/user IDs.
5. Preserve form input on validation and save failures; prevent duplicate submission.
6. Restore a saved account step after reload and recover safely if the stored account no longer exists.
7. Complete with a restrained real-data summary and `router.replace('/dashboard')`.

## Task 4 — Deferral and dashboard resume

Files:

- Update `app/dashboard/page.tsx`.
- Extend `lib/onboarding.ts` and tests if new pure presentation decisions are required.

Steps:

1. Implement `Lanjutkan nanti` with a seven-day per-user deferral.
2. Show one compact resume card only for a deferred, still-empty user.
3. Make resume return to the correct onboarding step.
4. Remove the card after activation or when core data makes the user active.

## Task 5 — Browser fixtures and onboarding E2E

Files:

- Extend `e2e/fixtures.ts` with stateful, in-memory Supabase mocks scoped per test.
- Create `e2e/onboarding.spec.ts`.
- Update existing auth and smoke specs only where the new eligibility gate changes the expected route.

Steps:

1. Model empty, account-only, transaction-only, active-journey, save-failure, and completed users without a real database.
2. Verify new-user entry, validation, account creation, transaction creation, summary, and Dashboard completion.
3. Verify refresh resume, failed-save retry, deferral/resume, and legacy bypass.
4. Run all onboarding scenarios in desktop Chromium and Pixel 7 emulation.
5. Keep console-error, page-error, hydration, and mobile-overflow blockers enabled.

## Task 6 — Release verification

Commands and evidence:

1. `npm test`
2. `npm run test:coverage` with at least 80% overall coverage.
3. `npm run lint`
4. `npx tsc --noEmit`
5. `npm run build` with the real local environment.
6. `npm audit --omit=dev`
7. Full Playwright desktop/mobile suite in the user-approved Chromium browser.
8. Repeat critical onboarding/auth flows to detect flakiness.
9. Inspect the production route visually at desktop and mobile sizes and confirm no regression to the approved design language.

Phase B is complete only when every design success criterion is represented by source behavior and direct automated or runtime evidence.

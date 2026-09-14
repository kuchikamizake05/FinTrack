# Daily Financial Journey Streak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a translated, server-backed daily Financial Journey review streak to the dashboard and Journey page.

**Architecture:** A Supabase migration stores one WIB activity date per user and extends the Journey RPC response with a streak object. The existing browser hook parses it, exposes an idempotent check-in action, and existing components render summary and detail views.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase PostgreSQL RPC/RLS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-daily-journey-streak-design.md`

## Global Constraints

- The day boundary and displayed dates use `Asia/Jakarta` (WIB).
- A check-in is a self-confirmed review, never a login or visit; it may occur once each day.
- Check-ins award no XP and leave weekly missions unchanged.
- All new copy has Indonesian and English variants selected through `LanguageProvider`.
- Server-side RPCs derive dates and are the only mutation path.

---

### Task 1: Server-backed daily activity and streak data

**Files:**
- Create: `supabase/migrations/20260914000000_add_financial_journey_streak.sql`
- Modify: `supabase/tests/financial-journey.sql`

**Interfaces:**
- Produces `complete_financial_journey_daily_review() returns jsonb`.
- Extends the Journey payload with `streak: { current, longest, completedToday, days }`.

- [ ] **Step 1: Add failing SQL assertions**

```sql
state := public.complete_financial_journey_daily_review();
assert (state->'streak'->>'current')::int = 1;
assert (state->'streak'->>'completedToday')::boolean;
assert (state->>'totalXp')::int = 100, 'Daily review changed XP';
```

- [ ] **Step 2: Run the disposable SQL suite**

Run: `psql -v ON_ERROR_STOP=1 -f supabase/tests/financial-journey.sql`

Expected: fails because the daily-review RPC does not exist.

- [ ] **Step 3: Create the migration**

```sql
create table public.financial_journey_daily_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);
```

Enable RLS, grant authenticated read access only to the owner, revoke direct writes, and create a security-definer RPC that derives `(now() at time zone 'Asia/Jakarta')::date`, inserts with `on conflict do nothing`, and returns `get_financial_journey()`.

- [ ] **Step 4: Extend `get_financial_journey`**

Use a date-minus-row-number grouping query for consecutive activity runs. Emit seven day objects, current run only if today is completed, longest run across all history, and `completedToday`.

- [ ] **Step 5: Run SQL tests and commit**

Run: `psql -v ON_ERROR_STOP=1 -f supabase/tests/financial-journey.sql`

Expected: pass for idempotency, no XP change, RLS, anonymous denial, and historic longest streak.

Commit: `git add supabase/migrations/20260914000000_add_financial_journey_streak.sql supabase/tests/financial-journey.sql && git commit -m "feat: add daily journey streak RPC"`

### Task 2: Parse and expose streak state

**Files:**
- Modify: `src/lib/journey.ts`
- Modify: `src/lib/journey.test.ts`
- Modify: `src/components/FinancialJourney.tsx`

**Interfaces:**
- Produces `JourneyState.streak` with `{ current, longest, completedToday, days }`.
- Produces `dailySaving` and `completeDailyReview()` from `useFinancialJourney`.

- [ ] **Step 1: Write a failing parser test**

```ts
expect(parseJourney({ ...valid, streak: {
  current: 3, longest: 7, completedToday: true,
  days: [{ date: "2026-09-14", completed: true }],
} }).streak.current).toBe(3);
```

- [ ] **Step 2: Run unit test**

Run: `npm run test -- src/lib/journey.test.ts`

Expected: fails because the schema has no streak field.

- [ ] **Step 3: Add the strict schema and RPC action**

```ts
const streakSchema = z.object({
  current: z.number().int().nonnegative(),
  longest: z.number().int().nonnegative(),
  completedToday: z.boolean(),
  days: z.array(z.object({ date: z.iso.date(), completed: z.boolean() })).length(7),
});
```

Call `complete_financial_journey_daily_review`, parse the returned response, and retain the existing error/retry and no-optimistic-update behavior.

- [ ] **Step 4: Run unit test and commit**

Run: `npm run test -- src/lib/journey.test.ts`

Expected: pass.

Commit: `git add src/lib/journey.ts src/lib/journey.test.ts src/components/FinancialJourney.tsx && git commit -m "feat: expose daily journey streak state"`

### Task 3: Render translated dashboard and Journey views

**Files:**
- Modify: `src/components/JourneySummary.tsx`
- Modify: `src/components/FinancialJourney.tsx`
- Modify: `e2e/journey.spec.ts`
- Modify: `e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes `JourneyState.streak`, `dailySaving`, and `completeDailyReview()`.
- Produces a compact dashboard streak line and an accessible, mobile-safe detail card.

- [ ] **Step 1: Add failing E2E assertions and valid mock streak data**

```ts
await expect(page.getByText("3 hari berturut-turut")).toBeVisible();
await page.getByRole("button", { name: "Sudah review hari ini" }).click();
await expect(page.getByText("1 hari berturut-turut")).toBeVisible();
```

- [ ] **Step 2: Run focused E2E test**

Run: `npm run test:e2e -- e2e/journey.spec.ts --workers=1`

Expected: fails because the streak view does not exist.

- [ ] **Step 3: Add Indonesian and English UI**

Render `🔥 {current} hari berturut-turut` / `🔥 {current} days in a row` in the summary. Render the detail action, current and best values, and seven date/status labels in Journey. Disable the action while saving or once today is saved. Use existing responsive Tailwind classes and `aria-label` values for each day.

- [ ] **Step 4: Handle all RPC mocks**

Return a valid streak object from Journey and onboarding mocks; the daily RPC updates only the mock streak state.

- [ ] **Step 5: Verify focused E2E and commit**

Run: `npm run test:e2e -- e2e/journey.spec.ts e2e/onboarding.spec.ts --workers=1`

Expected: passes in desktop and mobile, including language switching and error recovery.

Commit: `git add src/components/JourneySummary.tsx src/components/FinancialJourney.tsx e2e/journey.spec.ts e2e/onboarding.spec.ts && git commit -m "feat: show translated daily journey streak"`

### Task 4: Complete verification

**Files:**
- Modify only files required to resolve validation failures.

- [ ] **Step 1: Run project checks**

Run: `npm run check`

Expected: lint, type checks, units, and production build pass.

- [ ] **Step 2: Run security and full browser checks**

Run: `npm run audit:security && npm run test:e2e -- --workers=1`

Expected: zero high-severity production vulnerabilities and all non-skipped tests pass.

- [ ] **Step 3: Inspect and commit the final change**

Run: `git diff --check; git diff --stat`

Expected: no whitespace errors and only streak-related changes.

Commit any validation fixes with `git commit -m "test: verify daily journey streak"`.

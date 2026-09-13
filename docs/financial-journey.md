# Financial Journey

The dashboard shows a compact linked summary of level, XP, and weekly mission count. The entire card opens the authenticated `/journey` page, which holds the complete missions, confirmations, badges, and cosmetic rewards. The detail page links back to the dashboard and includes mobile bottom-navigation clearance.

Journey offers three self-confirmed weekly reviews: transactions (30 XP), planning (30 XP), and balance reconciliation (40 XP). Opening a destination does not award points. Users confirm completion after doing the review. No reward is based on money amounts, trading profits, or transaction volume.

Every 300 lifetime XP advances a level. Earned XP never resets. All three missions make a complete week; four complete weeks need not be consecutive. Badges recognize the first review, first complete week, four complete weeks, and an achieved goal detected when a planning review is confirmed. The goal badge is preserved even if the goal later changes. Levels 2 and 3 automatically unlock teal and indigo card accents. No core feature is gated.

## Deployment

Apply `supabase/migrations/20260913000000_add_financial_journey.sql` through the project's approved Supabase migration process before using the feature. This migration depends on the existing financial goals migration. It creates one completion table and two RPC functions. No existing financial records are modified. Without this migration, the card shows a recoverable connection error and does not claim to save progress.

Only authenticated RPC calls can create completions. The server assigns a Monday-based week in Asia/Jakarta and derives XP from an allowlist. The primary key `(user_id, week_start, mission)` makes retries idempotent. Clients cannot assign points, dates, or another user's identity. RLS permits reading only the current user's rows, with no direct client write grants.

The card always shows the current week, independently of the dashboard reporting month. It refreshes on focus and every five minutes. Successful saves replace the view with authoritative server progress; failed or ambiguous saves require a refresh before retrying. The first version deliberately trusts user confirmation; it does not verify whether a human actually reviewed their records.

## Verification

- `npm run check` covers lint, TypeScript, unit tests, and production build.
- `npm run test:e2e -- e2e/journey.spec.ts e2e/authenticated-smoke.spec.ts` covers desktop/mobile confirmation, cancellation, reload persistence, new-week presentation, service recovery, and application smoke routes with mocked Supabase.
- `psql -v ON_ERROR_STOP=1 -f supabase/tests/financial-journey.sql` runs in an **empty disposable PostgreSQL database** as postgres. The script creates minimal auth fixtures, applies the real migration, verifies duplicates, ownership, restricted writes, goal badges, historical XP, and anonymous rejection, then rolls back. Do not run this fixture against a real Supabase database.

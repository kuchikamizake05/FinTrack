# Production readiness

Do not open public registration until every release gate passes.

## Required server configuration

Set these in Vercel. Never prefix any with `NEXT_PUBLIC_`.

- `N8N_TRADE_REVIEW_WEBHOOK_URL`
- `N8N_TRADE_REVIEW_SHARED_SECRET`
- `GROQ_API_KEY`
- `GROQ_INSIGHTS_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_RECEIPT_MODEL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-visible. Verify neither points to development project during production release. Never print secrets, environment output, bearer tokens, receipt payloads, or Supabase service-role keys.

## Supabase safety gate

1. Confirm RLS enabled for every user-owned table.
2. Test two different users: cross-user select, insert, update, and delete must fail.
3. Back up existing `financial_accounts` policy text.
4. Enable and test Supabase MFA on non-production account.
5. Read and run `supabase/manual/20260822_sensitive-account-delete-step-up.sql` only in Supabase Dashboard SQL Editor.
6. Test AAL1, stale MFA, non-owner, linked-history, and non-zero-balance deletion rejection.
7. Test fresh AAL2 deletion success. Confirm direct `financial_accounts` delete fails.
8. Only then switch account deletion UI from direct delete to `delete_financial_account_with_step_up` RPC.

Do not run `supabase db push`, `supabase db reset`, migration repair, or schema dump for this gate.

## Rate-limit gate

1. Create Upstash Redis database with TLS REST endpoint.
2. Add both Upstash variables to Vercel production environment.
3. Deploy preview, then make requests through separate serverless invocations for same account and route.
4. Confirm receipt parse, insight generation, and trade review return `429` with `Retry-After` after limit.
5. Confirm keys contain only SHA-256 route/user digest. No user ID, email, receipt content, or token.

Without Upstash, limits fall back to process-local mode. Private beta only.

## Backup and recovery gate

1. Confirm Supabase backup/PITR plan and restoration owner.
2. Restore non-production snapshot into isolated project.
3. Verify user-owned financial data, RLS, balance triggers, and account lifecycle policies after restore.
4. Record restore duration, data cutoff, owner, and failures in incident log.
5. Keep rollback release ID and prior Vercel deployment URL before each release.

Vercel rollback: Dashboard Deployments, choose last known-good deployment, use **Promote to Production**. Verify auth, account ledger, transaction review, and API error rate after rollback.

## CI and release commands

```bash
npm run check
npm run test:e2e -- --workers=1
git diff --check
```

Serial E2E remains required until parallel harness passes repeatedly. Review Vercel function logs after deploy. No external telemetry SDK configured; add one only after provider and data-retention policy are chosen.

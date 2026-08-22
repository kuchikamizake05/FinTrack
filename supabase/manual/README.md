# Manual Supabase changes

Files here are intentionally excluded from migration history. Run no file through `supabase db push`, `supabase db reset`, migration repair, or schema dump.

## Sensitive account deletion step-up

`20260822_sensitive-account-delete-step-up.sql` replaces direct `financial_accounts` DELETE with authenticated RPC enforcement.

Before execution:

1. Enable and test Supabase MFA for a non-production account.
2. Review policy replacement and 15-minute AAL2/AMR window.
3. Back up policy text from Supabase Dashboard.
4. Run SQL in Supabase Dashboard SQL Editor, once, in a controlled window.
5. Test rejection for AAL1, stale MFA, ownership mismatch, linked history, and non-zero balance.
6. Test success only after recent AAL2. Confirm direct client `DELETE` is rejected.

Do not treat device-local Passkey lock as server authorization. This SQL accepts only a recent Supabase JWT AAL2 factor event. Wire account deletion to guarded server route only after above verification passes.

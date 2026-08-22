-- MANUAL REVIEW REQUIRED. Run only in Supabase Dashboard SQL Editor after review.
-- Do NOT run via supabase db push/reset/repair. This file is intentionally outside migrations.
--
-- Contract:
-- 1. Direct DELETE on financial_accounts is removed for authenticated users.
-- 2. Account deletion requires auth.uid() ownership, aal2, and an MFA AMR event within 15 minutes.
-- 3. Existing zero-balance and linked-record restrictions remain server-side.
-- 4. A server route may call delete_financial_account_with_step_up(); direct RPC callers get same DB guard.
--
-- Prerequisite: Supabase MFA must be enabled and tested. Current device-local Passkey lock
-- is not server proof. Do not claim Passkey step-up until Supabase emits aal2 plus an AMR event.

begin;

-- Replace broad CRUD policy with explicit policies. No authenticated direct DELETE policy.
drop policy if exists "Users can manage their financial accounts" on public.financial_accounts;
drop policy if exists "Users can view their financial accounts" on public.financial_accounts;
drop policy if exists "Users can insert their financial accounts" on public.financial_accounts;
drop policy if exists "Users can update their financial accounts" on public.financial_accounts;
drop policy if exists "Users can delete their financial accounts" on public.financial_accounts;

create policy "Users can view their financial accounts"
  on public.financial_accounts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their financial accounts"
  on public.financial_accounts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their financial accounts"
  on public.financial_accounts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.delete_financial_account_with_step_up(target_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '3s'
as $$
declare
  caller_id uuid := auth.uid();
  token_amr jsonb := coalesce(auth.jwt() -> 'amr', '[]'::jsonb);
  account_balance numeric;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Recent MFA step-up required';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(token_amr) as factor(entry)
    where lower(coalesce(factor.entry ->> 'method', '')) in ('totp', 'webauthn', 'phone', 'otp')
      and coalesce(factor.entry ->> 'timestamp', '') ~ '^[0-9]+$'
      and (factor.entry ->> 'timestamp')::bigint
        >= extract(epoch from now() - interval '15 minutes')::bigint
  ) then
    raise exception 'Recent MFA step-up required';
  end if;

  select current_balance into account_balance
  from financial_accounts
  where id = target_account_id
    and user_id = caller_id
  for update;

  if not found then
    raise exception 'Account not found';
  end if;

  if account_balance <> 0 then
    raise exception 'Account balance must be zero before deletion';
  end if;

  if exists (select 1 from transactions where account_id = target_account_id)
    or exists (select 1 from account_transfers where source_account_id = target_account_id or destination_account_id = target_account_id)
    or exists (select 1 from recurring_transactions where account_id = target_account_id)
    or exists (select 1 from account_reconciliations where account_id = target_account_id)
    or exists (select 1 from stock_executions where account_id = target_account_id)
    or exists (select 1 from forex_trades where account_id = target_account_id)
    or exists (select 1 from account_equity_snapshots where account_id = target_account_id) then
    raise exception 'Account has linked history and cannot be deleted';
  end if;

  delete from financial_accounts
  where id = target_account_id
    and user_id = caller_id;
end;
$$;

revoke all on function public.delete_financial_account_with_step_up(uuid) from public;
grant execute on function public.delete_financial_account_with_step_up(uuid) to authenticated;

commit;

-- Verification, run after commit as authenticated test user:
-- select public.delete_financial_account_with_step_up('<zero-balance-unlinked-account-uuid>');
-- Expect failure at aal1, stale AMR, non-owner account, non-zero balance, or linked account.
-- Expect success only after a fresh MFA aal2 session. Then verify direct DELETE still fails.

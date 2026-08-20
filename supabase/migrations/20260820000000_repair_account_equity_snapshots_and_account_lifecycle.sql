-- Repair missing snapshot schema and keep account lifecycle safe without rewriting history.
-- Historical 20260714 migration is malformed; run disposable reset/history preflight before release.

create table if not exists account_equity_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references financial_accounts(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  equity numeric not null check (equity >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table account_equity_snapshots
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists account_id uuid references financial_accounts(id) on delete restrict,
  add column if not exists recorded_at timestamptz not null default now(),
  add column if not exists equity numeric check (equity >= 0),
  add column if not exists currency text check (currency ~ '^[A-Z]{3}$'),
  add column if not exists note text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists account_equity_snapshots_account_recorded_idx
  on account_equity_snapshots (account_id, recorded_at desc);
create index if not exists account_equity_snapshots_user_recorded_idx
  on account_equity_snapshots (user_id, recorded_at desc);

alter table account_equity_snapshots enable row level security;
drop policy if exists "Users can manage their account equity snapshots" on account_equity_snapshots;
create policy "Users can manage their account equity snapshots"
  on account_equity_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


create or replace function validate_financial_account_links()
returns trigger as $$
declare
  source_currency text;
  target_currency text;
  account_active boolean;
begin
  if tg_table_name = 'account_transfers' then
    if tg_op = 'UPDATE'
      and old.source_account_id = new.source_account_id
      and old.destination_account_id = new.destination_account_id
      and old.currency = new.currency
      and old.destination_currency = new.destination_currency then
      return new;
    end if;
    select currency, is_active into source_currency, account_active from financial_accounts where id = new.source_account_id and user_id = new.user_id;
    if source_currency is null or not account_active then raise exception 'Source account must belong to the transfer owner and be active'; end if;
    select currency, is_active into target_currency, account_active from financial_accounts where id = new.destination_account_id and user_id = new.user_id;
    if target_currency is null or not account_active then raise exception 'Destination account must belong to the transfer owner and be active'; end if;
    if new.currency <> source_currency or new.destination_currency <> target_currency then raise exception 'Transfer currency must match its linked account currency'; end if;
    if source_currency = target_currency and new.amount <> new.destination_amount then raise exception 'Same-currency transfers must use the same sent and received amount'; end if;
  elsif new.account_id is not null then
    select is_active into account_active from financial_accounts where id = new.account_id and user_id = new.user_id;
    if account_active is distinct from true then
      if tg_op = 'UPDATE' and old.account_id = new.account_id then return new; end if;
      raise exception 'Account must belong to the record owner and be active';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function validate_snapshot_account()
returns trigger as $$
begin
  if exists (
    select 1 from financial_accounts
    where id = new.account_id
      and user_id = new.user_id
      and is_active
      and kind in ('investment', 'trading')
      and currency = new.currency
  ) then return new; end if;
  if tg_op = 'UPDATE' and old.account_id = new.account_id and old.currency = new.currency then return new; end if;
  raise exception 'Snapshot account must belong to the user, be active, and use its account currency';
end;
$$ language plpgsql;

create or replace function validate_journal_account_kind()
returns trigger as $$
declare
  expected_kind text;
begin
  expected_kind := case tg_table_name when 'stock_executions' then 'investment' when 'forex_trades' then 'trading' end;
  if exists (
    select 1 from financial_accounts
    where id = new.account_id
      and user_id = new.user_id
      and is_active
      and kind = expected_kind
      and currency = new.currency
  ) then return new; end if;
  if tg_op = 'UPDATE' and old.account_id = new.account_id and old.currency = new.currency then return new; end if;
  raise exception 'Journal account must belong to the user, be active, match its kind, and use its account currency';
end;
$$ language plpgsql;

create or replace function guard_financial_account_lifecycle()
returns trigger as $$
begin
  if new.currency <> old.currency and (
    exists (select 1 from transactions where account_id = old.id)
    or exists (select 1 from account_transfers where source_account_id = old.id or destination_account_id = old.id)
    or exists (select 1 from recurring_transactions where account_id = old.id)
    or exists (select 1 from account_reconciliations where account_id = old.id)
    or exists (select 1 from stock_executions where account_id = old.id)
    or exists (select 1 from forex_trades where account_id = old.id)
    or exists (select 1 from account_equity_snapshots where account_id = old.id)
  ) then
    raise exception 'Account currency cannot change after it has references';
  end if;

  if new.kind <> old.kind and (
    (old.kind = 'investment' and exists (select 1 from stock_executions where account_id = old.id))
    or (old.kind = 'trading' and exists (select 1 from forex_trades where account_id = old.id))
  ) then
    raise exception 'Account kind cannot change after journal entries exist';
  end if;

  if old.is_active and not new.is_active then
    if new.current_balance <> 0 then raise exception 'Account balance must be zero before archiving'; end if;
    if exists (select 1 from recurring_transactions where account_id = old.id and is_active) then raise exception 'Pause recurring rules before archiving this account'; end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_account_equity_snapshot on account_equity_snapshots;
create trigger validate_account_equity_snapshot
  before insert or update on account_equity_snapshots
  for each row execute function validate_snapshot_account();
drop trigger if exists update_account_equity_snapshots_updated_at on account_equity_snapshots;
create trigger update_account_equity_snapshots_updated_at
  before update on account_equity_snapshots
  for each row execute function update_updated_at_column();
drop trigger if exists guard_financial_account_lifecycle on financial_accounts;
create trigger guard_financial_account_lifecycle
  before update on financial_accounts
  for each row execute function guard_financial_account_lifecycle();

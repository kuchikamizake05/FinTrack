-- Manual valuation checkpoints power accurate equity curves without market-data APIs.

create table if not exists account_equity_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references financial_accounts(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  equity numeric not null check (equity >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_equity_snapshots_account_recorded_idx
  on account_equity_snapshots (account_id, recorded_at desc);

create index if not exists account_equity_snapshots_user_recorded_idx
  on account_equity_snapshots (user_id, recorded_at desc);

alter table account_equity_snapshots enable row level security;

create policy "Users can manage their account equity snapshots"
  on account_equity_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function validate_snapshot_account()
returns trigger as $$
begin
  if not exists (
    select 1 from financial_accounts
    where id = new.account_id
      and user_id = new.user_id
      and kind in ('investment', 'trading')
      and currency = new.currency
  ) then
    raise exception 'Snapshot account must belong to the user and use its account currency';
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

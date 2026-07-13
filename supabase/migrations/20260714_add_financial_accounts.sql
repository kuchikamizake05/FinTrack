-- Financial operating-system foundation: accounts, transfers, and balances.

create table if not exists financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  institution text,
  kind text not null check (kind in ('bank', 'ewallet', 'investment', 'trading', 'liability')),
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  current_balance numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_accounts_user_active_idx
  on financial_accounts (user_id, is_active, created_at desc);

alter table financial_accounts enable row level security;

create policy "Users can manage their financial accounts"
  on financial_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table transactions
  add column if not exists account_id uuid references financial_accounts(id) on delete set null;

create index if not exists transactions_account_date_idx
  on transactions (account_id, date desc);

create table if not exists account_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_account_id uuid not null references financial_accounts(id) on delete restrict,
  destination_account_id uuid not null references financial_accounts(id) on delete restrict,
  amount numeric not null check (amount > 0),
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  date date not null default current_date,
  kind text not null default 'transfer' check (kind in ('transfer', 'broker_deposit', 'broker_withdrawal')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_account_id <> destination_account_id)
);

create index if not exists account_transfers_user_date_idx
  on account_transfers (user_id, date desc);

alter table account_transfers enable row level security;

create policy "Users can manage their account transfers"
  on account_transfers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function assert_account_owner(account_uuid uuid, expected_user_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from financial_accounts
    where id = account_uuid and user_id = expected_user_id
  ) then
    raise exception 'Account must belong to the transaction owner';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function validate_financial_account_links()
returns trigger as $$
begin
  if tg_table_name = 'account_transfers' then
    perform assert_account_owner(new.source_account_id, new.user_id);
    perform assert_account_owner(new.destination_account_id, new.user_id);
  elsif new.account_id is not null then
    perform assert_account_owner(new.account_id, new.user_id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_account_transfer_links on account_transfers;
create trigger validate_account_transfer_links
  before insert or update on account_transfers
  for each row execute function validate_financial_account_links();

drop trigger if exists validate_transaction_account_link on transactions;
create trigger validate_transaction_account_link
  before insert or update on transactions
  for each row execute function validate_financial_account_links();

create or replace function apply_account_delta(account_uuid uuid, delta numeric)
returns void as $$
begin
  update financial_accounts
  set current_balance = current_balance + delta,
      updated_at = now()
  where id = account_uuid;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function apply_confirmed_transaction_balance()
returns trigger as $$
declare
  old_delta numeric;
  new_delta numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.account_id is not null and old.status = 'confirmed' then
    old_delta := case when old.type = 'income' then old.amount else -old.amount end;
    perform apply_account_delta(old.account_id, -old_delta);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.account_id is not null and new.status = 'confirmed' then
    new_delta := case when new.type = 'income' then new.amount else -new.amount end;
    perform apply_account_delta(new.account_id, new_delta);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists apply_transaction_account_balance on transactions;
create trigger apply_transaction_account_balance
  after insert or update or delete on transactions
  for each row execute function apply_confirmed_transaction_balance();

create or replace function apply_transfer_balance()
returns trigger as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform apply_account_delta(old.source_account_id, old.amount);
    perform apply_account_delta(old.destination_account_id, -old.amount);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform apply_account_delta(new.source_account_id, -new.amount);
    perform apply_account_delta(new.destination_account_id, new.amount);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists apply_transfer_account_balance on account_transfers;
create trigger apply_transfer_account_balance
  after insert or update or delete on account_transfers
  for each row execute function apply_transfer_balance();

drop trigger if exists update_financial_accounts_updated_at on financial_accounts;
create trigger update_financial_accounts_updated_at
  before update on financial_accounts
  for each row execute function update_updated_at_column();

drop trigger if exists update_account_transfers_updated_at on account_transfers;
create trigger update_account_transfers_updated_at
  before update on account_transfers
  for each row execute function update_updated_at_column();

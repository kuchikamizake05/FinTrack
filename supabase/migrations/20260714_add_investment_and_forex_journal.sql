-- Manual investment and trading journal. Account balances represent the total
-- account equity; executions are kept separately so a buy/sell does not
-- double-count a transfer between cash and a broker portfolio.

create table if not exists stock_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references financial_accounts(id) on delete restrict,
  executed_at timestamptz not null default now(),
  ticker text not null check (ticker = upper(btrim(ticker)) and char_length(btrim(ticker)) between 1 and 16),
  side text not null check (side in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price >= 0),
  fee numeric not null default 0 check (fee >= 0),
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_executions_user_ticker_executed_idx
  on stock_executions (user_id, ticker, executed_at desc);
create index if not exists stock_executions_account_executed_idx
  on stock_executions (account_id, executed_at desc);

alter table stock_executions enable row level security;

create policy "Users can manage their stock executions"
  on stock_executions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists forex_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references financial_accounts(id) on delete restrict,
  symbol text not null check (symbol = upper(btrim(symbol)) and char_length(btrim(symbol)) between 3 and 16),
  direction text not null check (direction in ('long', 'short')),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  lot_size numeric not null check (lot_size > 0),
  entry_price numeric not null check (entry_price > 0),
  exit_price numeric check (exit_price > 0),
  stop_loss numeric check (stop_loss > 0),
  take_profit numeric check (take_profit > 0),
  risk_amount numeric check (risk_amount >= 0),
  gross_pnl numeric not null default 0,
  commission numeric not null default 0 check (commission >= 0),
  swap numeric not null default 0,
  net_pnl numeric generated always as (gross_pnl - commission + swap) stored,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  setup_tag text,
  thesis text,
  emotion text,
  lesson text,
  screenshot_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(screenshot_urls) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'closed' and closed_at is not null and exit_price is not null) or status <> 'closed')
);

create index if not exists forex_trades_user_opened_idx
  on forex_trades (user_id, opened_at desc);
create index if not exists forex_trades_account_opened_idx
  on forex_trades (account_id, opened_at desc);

alter table forex_trades enable row level security;

create policy "Users can manage their forex trades"
  on forex_trades for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function validate_journal_account_kind()
returns trigger as $$
declare
  expected_kind text;
begin
  expected_kind := case tg_table_name
    when 'stock_executions' then 'investment'
    when 'forex_trades' then 'trading'
  end;

  if not exists (
    select 1 from financial_accounts
    where id = new.account_id
      and user_id = new.user_id
      and kind = expected_kind
  ) then
    raise exception 'Journal account must belong to the user and have kind %', expected_kind;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists validate_stock_execution_account on stock_executions;
create trigger validate_stock_execution_account
  before insert or update on stock_executions
  for each row execute function validate_journal_account_kind();

drop trigger if exists validate_forex_trade_account on forex_trades;
create trigger validate_forex_trade_account
  before insert or update on forex_trades
  for each row execute function validate_journal_account_kind();

drop trigger if exists update_stock_executions_updated_at on stock_executions;
create trigger update_stock_executions_updated_at
  before update on stock_executions
  for each row execute function update_updated_at_column();

drop trigger if exists update_forex_trades_updated_at on forex_trades;
create trigger update_forex_trades_updated_at
  before update on forex_trades
  for each row execute function update_updated_at_column();

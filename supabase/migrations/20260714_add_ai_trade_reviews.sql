-- AI outputs are advisory records, separate from financial executions and trades.
-- A generated review can never alter a user's journal or account balances.

create table if not exists ai_trade_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forex_trade_id uuid references forex_trades(id) on delete cascade,
  scope text not null check (scope in ('trade', 'weekly')),
  period_start date,
  period_end date,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb check (jsonb_typeof(strengths) = 'array'),
  improvements jsonb not null default '[]'::jsonb check (jsonb_typeof(improvements) = 'array'),
  created_at timestamptz not null default now(),
  check ((scope = 'trade' and forex_trade_id is not null) or (scope = 'weekly' and period_start is not null and period_end is not null))
);

create index if not exists ai_trade_reviews_user_created_idx
  on ai_trade_reviews (user_id, created_at desc);
create unique index if not exists ai_trade_reviews_one_per_trade_idx
  on ai_trade_reviews (forex_trade_id) where scope = 'trade';

alter table ai_trade_reviews enable row level security;

create policy "Users can view their AI trading reviews"
  on ai_trade_reviews for select
  using (auth.uid() = user_id);

create policy "Users can delete their AI trading reviews"
  on ai_trade_reviews for delete
  using (auth.uid() = user_id);

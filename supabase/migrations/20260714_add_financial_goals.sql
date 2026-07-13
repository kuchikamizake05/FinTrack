-- Personal financial targets displayed on the Home dashboard.

create table if not exists financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric not null default 0 check (current_amount >= 0),
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  color text,
  due_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_goals_user_active_idx
  on financial_goals (user_id, is_active, created_at desc);

alter table financial_goals enable row level security;

create policy "Users can manage their financial goals"
  on financial_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists update_financial_goals_updated_at on financial_goals;
create trigger update_financial_goals_updated_at
  before update on financial_goals
  for each row execute function update_updated_at_column();

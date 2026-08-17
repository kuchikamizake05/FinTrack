-- Planning, recurrence, review, and reconciliation controls for a personal ledger.

create table if not exists financial_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (char_length(btrim(category)) > 0),
  month date not null check (date_trunc('month', month)::date = month),
  limit_amount numeric not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, month)
);
create index if not exists financial_budgets_user_month_idx on financial_budgets (user_id, month desc);
alter table financial_budgets enable row level security;
drop policy if exists "Users can manage their financial budgets" on financial_budgets;
create policy "Users can manage their financial budgets" on financial_budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists update_financial_budgets_updated_at on financial_budgets;
create trigger update_financial_budgets_updated_at before update on financial_budgets for each row execute function update_updated_at_column();

create table if not exists recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references financial_accounts(id) on delete restrict,
  merchant text not null check (char_length(btrim(merchant)) > 0),
  category text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null check (amount > 0),
  note text,
  interval text not null check (interval in ('weekly', 'monthly', 'yearly')),
  next_run_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_transactions_user_due_idx on recurring_transactions (user_id, is_active, next_run_date);
alter table recurring_transactions enable row level security;
drop policy if exists "Users can manage their recurring transactions" on recurring_transactions;
create policy "Users can manage their recurring transactions" on recurring_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists validate_recurring_transaction_account on recurring_transactions;
create trigger validate_recurring_transaction_account before insert or update on recurring_transactions for each row execute function validate_financial_account_links();
drop trigger if exists update_recurring_transactions_updated_at on recurring_transactions;
create trigger update_recurring_transactions_updated_at before update on recurring_transactions for each row execute function update_updated_at_column();

alter table transactions drop constraint if exists transactions_source_check;
alter table transactions add constraint transactions_source_check check (source in ('telegram_text', 'telegram_receipt', 'manual', 'recurring'));

create or replace function run_recurring_transaction(rule_id uuid)
returns uuid as $$
declare
  rule recurring_transactions;
  created_transaction_id uuid;
begin
  select * into rule from recurring_transactions
  where id = rule_id and user_id = auth.uid() and is_active = true and next_run_date <= current_date
  for update;
  if not found then raise exception 'Recurring rule is not due or is unavailable'; end if;

  insert into transactions (user_id, account_id, date, type, merchant, category, amount, note, source, status)
  values (rule.user_id, rule.account_id, rule.next_run_date, rule.type, rule.merchant, rule.category, rule.amount, rule.note, 'recurring', 'confirmed')
  returning id into created_transaction_id;

  update recurring_transactions set next_run_date = (case rule.interval
    when 'weekly' then rule.next_run_date + interval '1 week'
    when 'monthly' then rule.next_run_date + interval '1 month'
    else rule.next_run_date + interval '1 year'
  end)::date where id = rule.id;
  return created_transaction_id;
end;
$$ language plpgsql;

create table if not exists account_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references financial_accounts(id) on delete restrict,
  statement_balance numeric not null,
  ledger_balance numeric not null,
  reconciled_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists account_reconciliations_user_account_idx on account_reconciliations (user_id, account_id, reconciled_at desc);
alter table account_reconciliations enable row level security;
drop policy if exists "Users can manage their reconciliations" on account_reconciliations;
create policy "Users can manage their reconciliations" on account_reconciliations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists validate_reconciliation_account on account_reconciliations;
create trigger validate_reconciliation_account before insert or update on account_reconciliations for each row execute function validate_financial_account_links();

create table if not exists financial_alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, alert_key)
);
alter table financial_alert_dismissals enable row level security;
drop policy if exists "Users can manage their alert dismissals" on financial_alert_dismissals;
create policy "Users can manage their alert dismissals" on financial_alert_dismissals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
drop policy if exists "Users can view their own receipts" on storage.objects;
create policy "Users can view their own receipts" on storage.objects for select using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can upload their own receipts" on storage.objects;
create policy "Users can upload their own receipts" on storage.objects for insert with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can update their own receipts" on storage.objects;
create policy "Users can update their own receipts" on storage.objects for update using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can remove their own receipts" on storage.objects;
create policy "Users can remove their own receipts" on storage.objects for delete using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

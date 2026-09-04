-- Opt-in monthly report schedules and immutable report archives.

create table if not exists monthly_report_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default false,
  enabled_from_period date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_report_schedules_enabled_from_period_check check (
    enabled_from_period is null
    or date_trunc('month', enabled_from_period)::date = enabled_from_period
  )
);
alter table monthly_report_schedules enable row level security;
drop policy if exists "Users can manage their monthly report schedule" on monthly_report_schedules;
create policy "Users can manage their monthly report schedule" on monthly_report_schedules
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop trigger if exists update_monthly_report_schedules_updated_at on monthly_report_schedules;
create trigger update_monthly_report_schedules_updated_at
  before update on monthly_report_schedules
  for each row execute function update_updated_at_column();

create table if not exists monthly_financial_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  currency_groups jsonb not null,
  category_totals jsonb not null,
  csv_path text not null,
  constraint monthly_financial_reports_period_start_check check (
    date_trunc('month', period_start)::date = period_start
  ),
  constraint monthly_financial_reports_period_end_check check (
    period_end = (period_start + interval '1 month - 1 day')::date
  ),
  constraint monthly_financial_reports_user_period_key unique (user_id, period_start)
);
create index if not exists monthly_financial_reports_user_period_idx
  on monthly_financial_reports (user_id, period_start desc);
alter table monthly_financial_reports enable row level security;
drop policy if exists "Users can view their monthly financial reports" on monthly_financial_reports;
create policy "Users can view their monthly financial reports" on monthly_financial_reports
  for select using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('financial-reports', 'financial-reports', false)
on conflict (id) do nothing;
drop policy if exists "Users can view their own financial reports" on storage.objects;
create policy "Users can view their own financial reports" on storage.objects
  for select using (
    bucket_id = 'financial-reports'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

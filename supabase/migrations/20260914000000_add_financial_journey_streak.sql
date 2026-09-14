-- One self-confirmed financial review per WIB calendar day. Progress is written
-- only by the RPC below so the browser cannot choose an arbitrary date.
create table public.financial_journey_daily_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

alter table public.financial_journey_daily_reviews enable row level security;
revoke all on public.financial_journey_daily_reviews from anon, authenticated;
grant select on public.financial_journey_daily_reviews to authenticated;
create policy "Read own daily journey reviews" on public.financial_journey_daily_reviews
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.get_financial_journey() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_week date := date_trunc('week', now() at time zone 'Asia/Jakarta')::date;
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
  result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'week', current_week,
    'totalXp', coalesce(sum(case when mission = 'accounts' then 40 else 30 end), 0),
    'completed', coalesce(jsonb_agg(mission order by mission) filter (where week_start = current_week), '[]'::jsonb),
    'completeWeeks', (select count(*) from (
      select week_start from public.financial_journey_completions
      where user_id = owner_id group by week_start having count(*) = 3
    ) complete_weeks),
    'goalAchieved', coalesce(bool_or(goal_achieved), false),
    'streak', jsonb_build_object(
      'current', coalesce((
        with ordered as (
          select activity_date, activity_date - row_number() over (order by activity_date)::integer as run_group
          from public.financial_journey_daily_reviews where user_id = owner_id
        ), runs as (
          select max(activity_date) as last_day, count(*)::integer as length
          from ordered group by run_group
        ) select length from runs where last_day = today_wib limit 1
      ), 0),
      'longest', coalesce((
        with ordered as (
          select activity_date, activity_date - row_number() over (order by activity_date)::integer as run_group
          from public.financial_journey_daily_reviews where user_id = owner_id
        ), runs as (
          select count(*)::integer as length from ordered group by run_group
        ) select max(length) from runs
      ), 0),
      'completedToday', exists(
        select 1 from public.financial_journey_daily_reviews
        where user_id = owner_id and activity_date = today_wib
      ),
      'days', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', day_value::date,
          'completed', exists(
            select 1 from public.financial_journey_daily_reviews
            where user_id = owner_id and activity_date = day_value::date
          )
        ) order by day_value)
        from generate_series(today_wib - 6, today_wib, interval '1 day') as days(day_value)
      ), '[]'::jsonb)
    )
  ) into result
  from public.financial_journey_completions where user_id = owner_id;
  return result;
end;
$$;

create function public.complete_financial_journey_daily_review() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  today_wib date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.financial_journey_daily_reviews(user_id, activity_date)
    values (owner_id, today_wib) on conflict (user_id, activity_date) do nothing;
  return public.get_financial_journey();
end;
$$;

revoke all on function public.complete_financial_journey_daily_review() from public, anon;
grant execute on function public.complete_financial_journey_daily_review() to authenticated;

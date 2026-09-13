-- Self-confirmed weekly reviews. Only RPCs can award permanent progress.
create table public.financial_journey_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  mission text not null check (mission in ('transactions', 'planning', 'accounts')),
  goal_achieved boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (user_id, week_start, mission)
);

alter table public.financial_journey_completions enable row level security;
revoke all on public.financial_journey_completions from anon, authenticated;
grant select on public.financial_journey_completions to authenticated;
create policy "Read own journey" on public.financial_journey_completions
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.get_financial_journey() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_week date := date_trunc('week', now() at time zone 'Asia/Jakarta')::date;
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
    'goalAchieved', coalesce(bool_or(goal_achieved), false)
  ) into result from public.financial_journey_completions where user_id = owner_id;
  return result;
end;
$$;

create function public.complete_financial_journey(mission_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_week date := date_trunc('week', now() at time zone 'Asia/Jakarta')::date;
  reached_goal boolean := false;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if mission_id is null or mission_id not in ('transactions', 'planning', 'accounts') then
    raise exception 'Unknown mission' using errcode = '22023';
  end if;
  if mission_id = 'planning' then
    select exists(select 1 from public.financial_goals
      where user_id = owner_id and current_amount >= target_amount)
      into reached_goal;
  end if;
  insert into public.financial_journey_completions(user_id, week_start, mission, goal_achieved)
    values(owner_id, current_week, mission_id, reached_goal)
    on conflict (user_id, week_start, mission) do nothing;
  return public.get_financial_journey();
end;
$$;

revoke all on function public.get_financial_journey() from public, anon;
revoke all on function public.complete_financial_journey(text) from public, anon;
grant execute on function public.get_financial_journey() to authenticated;
grant execute on function public.complete_financial_journey(text) to authenticated;

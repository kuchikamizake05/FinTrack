-- Run only in an empty disposable PostgreSQL database as postgres.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/financial-journey.sql
begin;
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
grant usage on schema auth to anon, authenticated;
create table public.financial_goals(user_id uuid, current_amount numeric, target_amount numeric);
\ir ../migrations/20260913000000_add_financial_journey.sql

insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.financial_goals values ('00000000-0000-0000-0000-000000000002', 100, 100);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$
declare state jsonb;
begin
  state := public.get_financial_journey();
  assert (state->>'totalXp')::int = 0, 'New user must start at zero';
  assert (state->>'week')::date = date_trunc('week', now() at time zone 'Asia/Jakarta')::date;
  perform public.complete_financial_journey('transactions');
  state := public.complete_financial_journey('transactions');
  assert (state->>'totalXp')::int = 30, 'Duplicate completion awarded XP';
  assert jsonb_array_length(state->'completed') = 1;
  perform public.complete_financial_journey('planning');
  state := public.complete_financial_journey('accounts');
  assert (state->>'totalXp')::int = 100;
  assert (state->>'completeWeeks')::int = 1;
  assert not (state->>'goalAchieved')::boolean, 'Another user goal leaked';
  begin
    perform public.complete_financial_journey('trades');
    raise exception 'Invalid mission was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.financial_journey_completions values (auth.uid(), current_date, 'accounts', false, now());
    raise exception 'Direct reward writes were accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$
declare state jsonb;
begin
  assert (select count(*) from public.financial_journey_completions) = 0, 'RLS exposed another user';
  state := public.get_financial_journey();
  assert (state->>'totalXp')::int = 0;
  state := public.complete_financial_journey('planning');
  assert (state->>'goalAchieved')::boolean, 'Own completed goal was not recognized';
end $$;

reset role;
-- Historical completion survives a new week and changes to source goals.
update public.financial_journey_completions
set week_start = week_start - 7 where user_id = '00000000-0000-0000-0000-000000000002';
delete from public.financial_goals;
set local role authenticated;
do $$
declare state jsonb := public.get_financial_journey();
begin
  assert jsonb_array_length(state->'completed') = 0;
  assert (state->>'totalXp')::int = 30, 'Historical XP was lost';
  assert (state->>'goalAchieved')::boolean, 'Earned goal badge was lost';
end $$;

select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.complete_financial_journey('planning');
    raise exception 'Missing identity accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.get_financial_journey();
    raise exception 'Anonymous access accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

begin;

-- Real requested feature: students who haven't joined the Telegram channel
-- should be automatically locked out after a deadline, with an admin able to
-- manually exempt any specific student. telegram_joined is self-reported
-- (see 202611141100) -- this doesn't verify membership, it enforces "you
-- told us you'd join by this date."
--
-- One global deadline (not per-student "N days after signup"): the
-- requirement is being added to an ALREADY-ACTIVE student base, so tying it
-- to signup date would lock out long-time students with zero warning.
-- Single-row settings table so the deadline can be adjusted later without a
-- new migration. A student who signs up AFTER the global deadline still
-- gets their own 7-day grace period from their real account creation date
-- (profiles.created_at, never reset by anything) so a brand-new signup is
-- never locked before they've had any chance to see the banner --
-- deliberately NOT access_granted_at, which an admin package renewal resets
-- and would otherwise silently bypass this requirement as a side effect.
create table if not exists public.telegram_requirement (
  id boolean primary key default true,
  lock_deadline timestamptz not null,
  constraint telegram_requirement_single_row check (id)
);
insert into public.telegram_requirement (id, lock_deadline)
values (true, now() + interval '7 days')
on conflict (id) do nothing;

alter table public.profiles add column if not exists telegram_lock_exempt boolean not null default false;

-- Full redefinition: derive_student_access_status gains three new
-- parameters, so the old signature is dropped first (same precedent as
-- every other grown-signature function in this app). Also corrected from
-- `immutable` to `stable`: the function already called now() even before
-- this change (a pre-existing mislabeling that happened to work because
-- Postgres doesn't aggressively constant-fold it away within one query) --
-- `stable` is what a now()-dependent function actually is, and this one now
-- also reads a table, which `immutable` genuinely forbids.
drop function if exists public.derive_student_access_status(integer,bigint,timestamptz,integer,boolean);

create or replace function public.derive_student_access_status(
  p_test_limit integer, p_tests_used_in_window bigint, p_validity_expires_at timestamptz, p_grace_days integer, p_access_locked boolean,
  p_telegram_joined boolean, p_telegram_exempt boolean, p_created_at timestamptz
)
returns text language sql stable set search_path=pg_catalog,public as $$
 select case
  when p_access_locked then 'locked'
  when p_validity_expires_at is not null and now()>p_validity_expires_at+make_interval(days=>p_grace_days) then 'locked'
  when p_test_limit is not null and p_tests_used_in_window>=p_test_limit then 'locked'
  when not p_telegram_exempt and not p_telegram_joined
    and now() > greatest((select lock_deadline from public.telegram_requirement limit 1), p_created_at + interval '7 days')
    then 'locked'
  when p_validity_expires_at is not null and now()>p_validity_expires_at then 'grace'
  else 'active'
 end
$$;

drop function if exists public.student_access_status(uuid);

create function public.student_access_status(p_student_id uuid default auth.uid())
returns table(student_id uuid, status text, tests_today bigint, tests_total bigint, tests_used_in_window bigint, test_limit integer, tests_remaining integer, validity_expires_at timestamptz, grace_days integer, access_locked boolean, can_access_typing boolean, can_access_stenography boolean, can_access_efficiency boolean, telegram_joined boolean, telegram_lock_exempt boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare prof record; used_window bigint; today_count bigint; total_count bigint;
begin
  if p_student_id <> auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select p.test_limit, p.validity_expires_at, p.grace_days, p.access_locked, p.access_granted_at, p.can_access_typing, p.can_access_stenography, p.can_access_efficiency, p.telegram_joined, p.telegram_lock_exempt, p.created_at
    into prof from public.profiles p where p.id = p_student_id and p.role = 'student';
  if not found then raise exception 'student not found'; end if;
  select count(*) filter(where a.started_at >= prof.access_granted_at), count(*), count(*) filter(where (a.started_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
    into used_window, total_count, today_count
    from (select ta.started_at from public.test_attempts ta where ta.student_id = p_student_id union all select wa.started_at from public.word_efficiency_attempts wa where wa.student_id = p_student_id) a;
  return query select p_student_id,
    public.derive_student_access_status(prof.test_limit, used_window, prof.validity_expires_at, prof.grace_days, prof.access_locked, prof.telegram_joined, prof.telegram_lock_exempt, prof.created_at),
    today_count, total_count, used_window, prof.test_limit,
    case when prof.test_limit is null then null else greatest(0, prof.test_limit - used_window::integer) end, prof.validity_expires_at, prof.grace_days, prof.access_locked,
    prof.can_access_typing, prof.can_access_stenography, prof.can_access_efficiency, prof.telegram_joined, prof.telegram_lock_exempt;
end $$;

drop function if exists public.admin_list_student_access();

create function public.admin_list_student_access()
returns table(student_id uuid, full_name text, email text, tests_today bigint, tests_total bigint, avg_score numeric, test_limit integer, tests_used_in_window bigint, tests_remaining integer, validity_expires_at timestamptz, grace_days integer, access_locked boolean, access_granted_at timestamptz, status text, can_access_typing boolean, can_access_stenography boolean, can_access_efficiency boolean, telegram_joined boolean, telegram_lock_exempt boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query
  with attempts as (
    select ta.student_id, ta.started_at, nullif(ta.result->>'accuracy','')::numeric as score_pct from public.test_attempts ta
    union all
    select wa.student_id, wa.started_at, nullif(wa.result->>'percentage','')::numeric from public.word_efficiency_attempts wa
  ),
  agg as (
    select p.id, p.full_name, p.email, p.test_limit, p.validity_expires_at, p.grace_days, p.access_locked, p.access_granted_at, p.can_access_typing, p.can_access_stenography, p.can_access_efficiency, p.telegram_joined, p.telegram_lock_exempt, p.created_at,
      count(a.*) filter(where (a.started_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date) as tests_today,
      count(a.*) as tests_total,
      count(a.*) filter(where a.started_at >= p.access_granted_at) as tests_used_in_window,
      avg(a.score_pct) as avg_score
    from public.profiles p left join attempts a on a.student_id = p.id
    where p.role = 'student'
    group by p.id
  )
  select agg.id, agg.full_name, agg.email, agg.tests_today, agg.tests_total, round(agg.avg_score, 2), agg.test_limit, agg.tests_used_in_window,
    case when agg.test_limit is null then null else greatest(0, agg.test_limit - agg.tests_used_in_window::integer) end,
    agg.validity_expires_at, agg.grace_days, agg.access_locked, agg.access_granted_at,
    public.derive_student_access_status(agg.test_limit, agg.tests_used_in_window, agg.validity_expires_at, agg.grace_days, agg.access_locked, agg.telegram_joined, agg.telegram_lock_exempt, agg.created_at),
    agg.can_access_typing, agg.can_access_stenography, agg.can_access_efficiency, agg.telegram_joined, agg.telegram_lock_exempt
  from agg;
end $$;

-- Admin's manual override -- "if i want then i can give manually access":
-- exempts one specific student from the Telegram join requirement
-- regardless of the deadline, independent of the access-package lock/limit.
create or replace function public.admin_set_student_telegram_exempt(p_student_id uuid, p_exempt boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  update public.profiles set telegram_lock_exempt = coalesce(p_exempt, false), updated_at = now() where id = p_student_id and role = 'student';
  if not found then raise exception 'student not found'; end if;
end $$;

revoke all on function public.student_access_status(uuid), public.admin_list_student_access(), public.admin_set_student_telegram_exempt(uuid, boolean) from public, anon;
grant execute on function public.student_access_status(uuid) to authenticated;
grant execute on function public.admin_list_student_access(), public.admin_set_student_telegram_exempt(uuid, boolean) to authenticated;

commit;

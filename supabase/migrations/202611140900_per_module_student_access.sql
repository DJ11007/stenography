begin;

-- Real requested feature: access control today is entirely module-blind -- a
-- student is either globally "active" or "locked" (profiles.test_limit /
-- validity_expires_at / access_locked), checked by the SAME
-- assert_student_access_allowed() gate for Typing, Stenography (mode =
-- 'stenography' on the very same tests table), Word Efficiency and Excel
-- Efficiency alike. There's no way to say "this student bought Stenography
-- but not Efficiency" -- exactly the real exam patterns requested (RHC
-- Stenographer needs all three; SSC Stenographer needs Typing + Stenography
-- only; RSSB varies per post). Three independent per-student flags, default
-- true so no existing student is retroactively locked out of anything they
-- could already do.
alter table public.profiles add column if not exists can_access_typing boolean not null default true;
alter table public.profiles add column if not exists can_access_stenography boolean not null default true;
alter table public.profiles add column if not exists can_access_efficiency boolean not null default true;

-- assert_student_access_allowed gains an optional p_module ('typing' |
-- 'stenography' | 'efficiency' | null). Every existing SQL/RPC call site
-- passes zero args today (confirmed: none pass p_student_id either), so
-- adding p_module as a second defaulted parameter is safe everywhere this
-- isn't updated to pass it -- null skips the module check entirely,
-- identical to today's behavior. Postgres won't let CREATE OR REPLACE grow
-- a function's parameter list, so the old single-arg version is dropped
-- first (same precedent as 202609222100 and 202611131800).
drop function if exists public.assert_student_access_allowed(uuid);

create function public.assert_student_access_allowed(p_student_id uuid default auth.uid(), p_module text default null)
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare current_status text; module_allowed boolean;
begin
  select status into current_status from public.student_access_status(p_student_id);
  if current_status = 'locked' then raise exception 'Your test access is currently locked. Contact your teacher to renew access.'; end if;
  if p_module is not null then
    select case p_module
      when 'typing' then can_access_typing
      when 'stenography' then can_access_stenography
      when 'efficiency' then can_access_efficiency
      else true
    end into module_allowed from public.profiles where id = p_student_id;
    if module_allowed is false then raise exception 'Your % access is not enabled for your account. Contact your teacher to add it.', p_module; end if;
  end if;
end $$;

-- student_access_status gains the three module flags in its result, so the
-- student-facing status banner and the admin dashboard can both show them
-- from the one place that's already the shared source of truth.
drop function if exists public.student_access_status(uuid);

create function public.student_access_status(p_student_id uuid default auth.uid())
returns table(student_id uuid, status text, tests_today bigint, tests_total bigint, tests_used_in_window bigint, test_limit integer, tests_remaining integer, validity_expires_at timestamptz, grace_days integer, access_locked boolean, can_access_typing boolean, can_access_stenography boolean, can_access_efficiency boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare prof record; used_window bigint; today_count bigint; total_count bigint;
begin
  if p_student_id <> auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select p.test_limit, p.validity_expires_at, p.grace_days, p.access_locked, p.access_granted_at, p.can_access_typing, p.can_access_stenography, p.can_access_efficiency
    into prof from public.profiles p where p.id = p_student_id and p.role = 'student';
  if not found then raise exception 'student not found'; end if;
  select count(*) filter(where a.started_at >= prof.access_granted_at), count(*), count(*) filter(where (a.started_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
    into used_window, total_count, today_count
    from (select ta.started_at from public.test_attempts ta where ta.student_id = p_student_id union all select wa.started_at from public.word_efficiency_attempts wa where wa.student_id = p_student_id) a;
  return query select p_student_id, public.derive_student_access_status(prof.test_limit, used_window, prof.validity_expires_at, prof.grace_days, prof.access_locked), today_count, total_count, used_window, prof.test_limit,
    case when prof.test_limit is null then null else greatest(0, prof.test_limit - used_window::integer) end, prof.validity_expires_at, prof.grace_days, prof.access_locked,
    prof.can_access_typing, prof.can_access_stenography, prof.can_access_efficiency;
end $$;

-- Same addition to the admin bulk listing (Track / Teacher Management).
drop function if exists public.admin_list_student_access();

create function public.admin_list_student_access()
returns table(student_id uuid, full_name text, email text, tests_today bigint, tests_total bigint, avg_score numeric, test_limit integer, tests_used_in_window bigint, tests_remaining integer, validity_expires_at timestamptz, grace_days integer, access_locked boolean, access_granted_at timestamptz, status text, can_access_typing boolean, can_access_stenography boolean, can_access_efficiency boolean)
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
    select p.id, p.full_name, p.email, p.test_limit, p.validity_expires_at, p.grace_days, p.access_locked, p.access_granted_at, p.can_access_typing, p.can_access_stenography, p.can_access_efficiency,
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
    public.derive_student_access_status(agg.test_limit, agg.tests_used_in_window, agg.validity_expires_at, agg.grace_days, agg.access_locked),
    agg.can_access_typing, agg.can_access_stenography, agg.can_access_efficiency
  from agg;
end $$;

-- Admin toggles the three module flags independently of the existing
-- limit/validity/lock package -- e.g. set Typing + Stenography on and
-- Efficiency off for an SSC Stenographer student, or all three on for RHC.
create or replace function public.admin_set_student_module_access(p_student_id uuid, p_typing boolean, p_stenography boolean, p_efficiency boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  update public.profiles set can_access_typing = coalesce(p_typing, true), can_access_stenography = coalesce(p_stenography, true), can_access_efficiency = coalesce(p_efficiency, true), updated_at = now()
  where id = p_student_id and role = 'student';
  if not found then raise exception 'student not found'; end if;
end $$;

revoke all on function public.assert_student_access_allowed(uuid, text), public.student_access_status(uuid), public.admin_list_student_access(), public.admin_set_student_module_access(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.student_access_status(uuid), public.assert_student_access_allowed(uuid, text) to authenticated;
grant execute on function public.admin_list_student_access(), public.admin_set_student_module_access(uuid, boolean, boolean, boolean) to authenticated;

commit;

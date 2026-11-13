begin;

-- Real requested follow-up: a student locked for the Telegram requirement
-- saw the exact same generic "Contact your teacher" message as any other
-- lock reason -- no way to tell what actually happened or how to fix it
-- themselves. A small helper encapsulates the exact same condition
-- derive_student_access_status already used inline (single source of
-- truth, no logic drift between the two), exposed as its own
-- telegram_locked column so both the save-time backstop and the dashboard
-- can give a specific, actionable message -- and tell the student that
-- joining + clicking "I've Joined" unlocks them immediately, with no admin
-- step needed, since this reason is derived live on every check.
create or replace function public.is_telegram_locked(p_telegram_joined boolean, p_telegram_exempt boolean, p_created_at timestamptz)
returns boolean language sql stable set search_path = pg_catalog, public as $$
  select not coalesce(p_telegram_exempt, false) and not coalesce(p_telegram_joined, false)
    and now() > greatest((select lock_deadline from public.telegram_requirement limit 1), p_created_at + interval '7 days')
$$;

create or replace function public.derive_student_access_status(
  p_test_limit integer, p_tests_used_in_window bigint, p_validity_expires_at timestamptz, p_grace_days integer, p_access_locked boolean,
  p_telegram_joined boolean, p_telegram_exempt boolean, p_created_at timestamptz
)
returns text language sql stable set search_path=pg_catalog,public as $$
 select case
  when p_access_locked then 'locked'
  when p_validity_expires_at is not null and now()>p_validity_expires_at+make_interval(days=>p_grace_days) then 'locked'
  when p_test_limit is not null and p_tests_used_in_window>=p_test_limit then 'locked'
  when public.is_telegram_locked(p_telegram_joined, p_telegram_exempt, p_created_at) then 'locked'
  when p_validity_expires_at is not null and now()>p_validity_expires_at then 'grace'
  else 'active'
 end
$$;

drop function if exists public.student_access_status(uuid);

create function public.student_access_status(p_student_id uuid default auth.uid())
returns table(student_id uuid, status text, tests_today bigint, tests_total bigint, tests_used_in_window bigint, test_limit integer, tests_remaining integer, validity_expires_at timestamptz, grace_days integer, access_locked boolean, can_access_typing boolean, can_access_stenography boolean, can_access_efficiency boolean, telegram_joined boolean, telegram_lock_exempt boolean, telegram_locked boolean)
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
    prof.can_access_typing, prof.can_access_stenography, prof.can_access_efficiency, prof.telegram_joined, prof.telegram_lock_exempt,
    public.is_telegram_locked(prof.telegram_joined, prof.telegram_lock_exempt, prof.created_at);
end $$;

drop function if exists public.admin_list_student_access();

create function public.admin_list_student_access()
returns table(student_id uuid, full_name text, email text, tests_today bigint, tests_total bigint, avg_score numeric, test_limit integer, tests_used_in_window bigint, tests_remaining integer, validity_expires_at timestamptz, grace_days integer, access_locked boolean, access_granted_at timestamptz, status text, can_access_typing boolean, can_access_stenography boolean, can_access_efficiency boolean, telegram_joined boolean, telegram_lock_exempt boolean, telegram_locked boolean)
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
    agg.can_access_typing, agg.can_access_stenography, agg.can_access_efficiency, agg.telegram_joined, agg.telegram_lock_exempt,
    public.is_telegram_locked(agg.telegram_joined, agg.telegram_lock_exempt, agg.created_at)
  from agg;
end $$;

-- The save-time backstop now gives a specific, actionable message for this
-- one lock reason instead of the generic "contact your teacher" text --
-- joining Telegram and clicking "I've Joined" on the dashboard clears this
-- immediately, with no admin step needed, since it's derived live.
create or replace function public.assert_student_access_allowed(p_student_id uuid default auth.uid(), p_module text default null)
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare current_status text; is_telegram_lock boolean; module_allowed boolean;
begin
  select status, telegram_locked into current_status, is_telegram_lock from public.student_access_status(p_student_id);
  if current_status = 'locked' and is_telegram_lock then
    raise exception 'Your test access is locked because you have not joined our Telegram channel yet. Join it and tap "I''ve Joined" on your dashboard to unlock instantly -- no need to wait for your teacher.';
  elsif current_status = 'locked' then
    raise exception 'Your test access is currently locked. Contact your teacher to renew access.';
  end if;
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

revoke all on function public.is_telegram_locked(boolean, boolean, timestamptz), public.student_access_status(uuid), public.admin_list_student_access(), public.assert_student_access_allowed(uuid, text) from public, anon;
grant execute on function public.is_telegram_locked(boolean, boolean, timestamptz) to anon, authenticated;
grant execute on function public.student_access_status(uuid), public.assert_student_access_allowed(uuid, text) to authenticated;
grant execute on function public.admin_list_student_access() to authenticated;

commit;

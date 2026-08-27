begin;

-- Admin-managed per-student access control: an optional test limit within the
-- current "window" (since access_granted_at), an optional expiry date, an
-- optional grace period after expiry, and an explicit lock switch. All new
-- and existing students default to fully unlimited/unlocked -- nothing here
-- restricts anyone until an admin deliberately sets a limit or expiry.
alter table public.profiles add column if not exists test_limit integer;
alter table public.profiles add column if not exists validity_expires_at timestamptz;
alter table public.profiles add column if not exists grace_days integer not null default 0;
alter table public.profiles add column if not exists access_locked boolean not null default false;
alter table public.profiles add column if not exists access_granted_at timestamptz not null default now();
alter table public.profiles add constraint profiles_test_limit_nonnegative check (test_limit is null or test_limit>=0);
alter table public.profiles add constraint profiles_grace_days_nonnegative check (grace_days>=0);

-- Shared formula so the bulk admin list and the single-student enforcement
-- check can never drift apart on what "locked"/"grace"/"active" means.
create or replace function public.derive_student_access_status(p_test_limit integer,p_tests_used_in_window bigint,p_validity_expires_at timestamptz,p_grace_days integer,p_access_locked boolean)
returns text language sql immutable set search_path=pg_catalog,public as $$
 select case
  when p_access_locked then 'locked'
  when p_validity_expires_at is not null and now()>p_validity_expires_at+make_interval(days=>p_grace_days) then 'locked'
  when p_test_limit is not null and p_tests_used_in_window>=p_test_limit then 'locked'
  when p_validity_expires_at is not null and now()>p_validity_expires_at then 'grace'
  else 'active'
 end
$$;

-- Status + usage for one student. Callable by that student for themselves, or by
-- an AAL2 admin for any student -- the one place both the enforcement gate below
-- and a student-facing "N tests left, valid until ..." banner should read from.
create or replace function public.student_access_status(p_student_id uuid default auth.uid())
returns table(student_id uuid,status text,tests_today bigint,tests_total bigint,tests_used_in_window bigint,test_limit integer,tests_remaining integer,validity_expires_at timestamptz,grace_days integer,access_locked boolean)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare prof record;used_window bigint;today_count bigint;total_count bigint;
begin
 if p_student_id<>auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized';end if;
 select p.test_limit,p.validity_expires_at,p.grace_days,p.access_locked,p.access_granted_at into prof from public.profiles p where p.id=p_student_id and p.role='student';
 if not found then raise exception 'student not found';end if;
 select count(*) filter(where a.started_at>=prof.access_granted_at),count(*),count(*) filter(where(a.started_at at time zone 'Asia/Kolkata')::date=(now() at time zone 'Asia/Kolkata')::date)
  into used_window,total_count,today_count
  from(select ta.started_at from public.test_attempts ta where ta.student_id=p_student_id union all select wa.started_at from public.word_efficiency_attempts wa where wa.student_id=p_student_id)a;
 return query select p_student_id,public.derive_student_access_status(prof.test_limit,used_window,prof.validity_expires_at,prof.grace_days,prof.access_locked),today_count,total_count,used_window,prof.test_limit,case when prof.test_limit is null then null else greatest(0,prof.test_limit-used_window::integer)end,prof.validity_expires_at,prof.grace_days,prof.access_locked;
end $$;

-- The actual enforcement gate: raises if the student is locked. 'grace' and
-- 'active' are both allowed to take a test -- grace exists precisely so an
-- expired student can still finish what they're mid-way through / be nudged
-- to renew rather than being cut off mid-course the instant validity lapses.
create or replace function public.assert_student_access_allowed(p_student_id uuid default auth.uid())
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare current_status text;
begin
 select status into current_status from public.student_access_status(p_student_id);
 if current_status='locked' then raise exception 'Your test access is currently locked. Contact your teacher to renew access.';end if;
end $$;

-- Bulk, admin-only version of the same status for the Track / Teacher Management
-- dashboards -- computed inline for every student in one query rather than
-- calling student_access_status() per row.
create or replace function public.admin_list_student_access()
returns table(student_id uuid,full_name text,email text,tests_today bigint,tests_total bigint,avg_score numeric,test_limit integer,tests_used_in_window bigint,tests_remaining integer,validity_expires_at timestamptz,grace_days integer,access_locked boolean,access_granted_at timestamptz,status text)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;
 return query
 with attempts as(
  select ta.student_id,ta.started_at,nullif(ta.result->>'accuracy','')::numeric as score_pct from public.test_attempts ta
  union all
  select wa.student_id,wa.started_at,nullif(wa.result->>'percentage','')::numeric from public.word_efficiency_attempts wa
 ),
 agg as(
  select p.id,p.full_name,p.email,p.test_limit,p.validity_expires_at,p.grace_days,p.access_locked,p.access_granted_at,
   count(a.*)filter(where(a.started_at at time zone 'Asia/Kolkata')::date=(now() at time zone 'Asia/Kolkata')::date)as tests_today,
   count(a.*)as tests_total,
   count(a.*)filter(where a.started_at>=p.access_granted_at)as tests_used_in_window,
   avg(a.score_pct)as avg_score
  from public.profiles p left join attempts a on a.student_id=p.id
  where p.role='student'
  group by p.id
 )
 select agg.id,agg.full_name,agg.email,agg.tests_today,agg.tests_total,round(agg.avg_score,2),agg.test_limit,agg.tests_used_in_window,
  case when agg.test_limit is null then null else greatest(0,agg.test_limit-agg.tests_used_in_window::integer)end,
  agg.validity_expires_at,agg.grace_days,agg.access_locked,agg.access_granted_at,
  public.derive_student_access_status(agg.test_limit,agg.tests_used_in_window,agg.validity_expires_at,agg.grace_days,agg.access_locked)
 from agg;
end $$;

-- Admin sets or renews a student's access package. Renewing (passing a new
-- validity_days) resets access_granted_at so their test count starts fresh --
-- passing null leaves the corresponding field at "no limit"/"no expiry".
create or replace function public.admin_set_student_access(p_student_id uuid,p_test_limit integer,p_validity_days integer,p_grace_days integer,p_locked boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;
 if p_test_limit is not null and p_test_limit<0 then raise exception 'test limit cannot be negative';end if;
 if p_validity_days is not null and p_validity_days<0 then raise exception 'validity days cannot be negative';end if;
 if p_grace_days is not null and p_grace_days<0 then raise exception 'grace days cannot be negative';end if;
 update public.profiles set
  test_limit=p_test_limit,
  validity_expires_at=case when p_validity_days is null then null else now()+make_interval(days=>p_validity_days)end,
  grace_days=coalesce(p_grace_days,0),
  access_locked=coalesce(p_locked,false),
  access_granted_at=now(),
  updated_at=now()
 where id=p_student_id and role='student';
 if not found then raise exception 'student not found';end if;
end $$;

-- Quick lock/unlock without touching the limit or validity package.
create or replace function public.admin_set_student_locked(p_student_id uuid,p_locked boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;
 update public.profiles set access_locked=coalesce(p_locked,false),updated_at=now() where id=p_student_id and role='student';
 if not found then raise exception 'student not found';end if;
end $$;

revoke all on function public.derive_student_access_status(integer,bigint,timestamptz,integer,boolean),public.student_access_status(uuid),public.assert_student_access_allowed(uuid),public.admin_list_student_access(),public.admin_set_student_access(uuid,integer,integer,integer,boolean),public.admin_set_student_locked(uuid,boolean) from public,anon;
grant execute on function public.student_access_status(uuid),public.assert_student_access_allowed(uuid) to authenticated;
grant execute on function public.admin_list_student_access(),public.admin_set_student_access(uuid,integer,integer,integer,boolean),public.admin_set_student_locked(uuid,boolean) to authenticated;

commit;

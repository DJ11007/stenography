-- A free-practice-test cap for "Take Tests" (mode='practice' attempts
-- only) -- deliberately separate from the existing profiles.test_limit
-- (that column is the admin's manual, whole-platform override across every
-- mode combined, per student, defaulting to unlimited; changing its
-- semantics would silently reinterpret every limit an admin has already
-- set). free_practice_test_limit is the platform's own default paywall:
-- 50 for every student unless an admin overrides it, null meaning
-- unlimited (same null-means-unlimited convention as test_limit).
-- Existing rows get 50 too via this default, which is safe here -- checked
-- live usage first: the most any current student has ever taken is 15
-- practice attempts, so nobody is retroactively locked out by this.
alter table public.profiles add column if not exists free_practice_test_limit integer default 50;

-- Status + usage for one student's free practice-test allowance. Callable
-- by that student for themselves, or by an AAL2 admin for any student --
-- mirrors student_access_status()'s exact self-or-admin convention.
create or replace function public.practice_test_free_status(p_student_id uuid default auth.uid())
returns table(student_id uuid, used_count bigint, free_limit integer, remaining integer, blocked boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare lim integer; used bigint;
begin
  if p_student_id <> auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select p.free_practice_test_limit into lim from public.profiles p where p.id = p_student_id and p.role = 'student';
  if not found then raise exception 'student not found'; end if;
  select count(*) into used from public.test_attempts ta join public.tests t on t.id = ta.test_id where ta.student_id = p_student_id and t.mode = 'practice';
  return query select p_student_id, used, lim, case when lim is null then null else greatest(0, lim - used::integer) end, lim is not null and used >= lim;
end $$;

-- The actual enforcement gate, for the same server-side backstop pattern
-- assert_student_access_allowed() already uses in recordManagedAttempt --
-- the primary UX gate is the pre-render check in PracticeNavigator, this
-- is defense-in-depth against a direct call to the save action.
create or replace function public.assert_practice_test_allowed(p_student_id uuid default auth.uid())
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare is_blocked boolean;
begin
  select blocked into is_blocked from public.practice_test_free_status(p_student_id);
  if is_blocked then raise exception 'Free practice test limit reached.'; end if;
end $$;

-- Lets an admin raise, lower, or clear (null = unlimited) one student's
-- free practice-test allowance, same shape as admin_set_student_access.
create or replace function public.admin_set_practice_free_limit(p_student_id uuid, p_limit integer)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  update public.profiles set free_practice_test_limit = p_limit where id = p_student_id and role = 'student';
  if not found then raise exception 'student not found'; end if;
end $$;

revoke all on function public.practice_test_free_status(uuid), public.assert_practice_test_allowed(uuid), public.admin_set_practice_free_limit(uuid,integer) from public, anon;
grant execute on function public.practice_test_free_status(uuid), public.assert_practice_test_allowed(uuid) to authenticated;
grant execute on function public.admin_set_practice_free_limit(uuid,integer) to authenticated;

commit;

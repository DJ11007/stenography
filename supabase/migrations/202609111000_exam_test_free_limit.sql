begin;

-- A free-attempt cap for the Typing Exam Simulator (mode='exam' attempts
-- only), the same shape as 202609010052's free_practice_test_limit for
-- "Take Tests" -- deliberately a separate column and separate RPCs, so
-- raising/lowering one never touches the other. Platform default is 20
-- for every student unless an admin overrides it; null means unlimited
-- (same convention as free_practice_test_limit and test_limit). Applies
-- identically to English and Hindi exam attempts -- the count is by mode,
-- not language. A live scheduled test (is_live=true) is a separate free
-- offering and is excluded by the caller, not by this function.
alter table public.profiles add column if not exists free_exam_test_limit integer default 20;

-- Status + usage for one student's free exam-attempt allowance. Callable
-- by that student for themselves, or by an AAL2 admin for any student --
-- mirrors practice_test_free_status()'s exact self-or-admin convention.
create or replace function public.exam_test_free_status(p_student_id uuid default auth.uid())
returns table(student_id uuid, used_count bigint, free_limit integer, remaining integer, blocked boolean)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare lim integer; used bigint;
begin
  if p_student_id <> auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select p.free_exam_test_limit into lim from public.profiles p where p.id = p_student_id and p.role = 'student';
  if not found then raise exception 'student not found'; end if;
  select count(*) into used from public.test_attempts ta join public.tests t on t.id = ta.test_id where ta.student_id = p_student_id and t.mode = 'exam' and t.is_live = false;
  return query select p_student_id, used, lim, case when lim is null then null else greatest(0, lim - used::integer) end, lim is not null and used >= lim;
end $$;

-- The actual enforcement gate, for the same server-side backstop pattern
-- assert_practice_test_allowed() already uses in recordManagedAttempt --
-- the primary UX gate is the pre-render check in /tests/[slug], this is
-- defense-in-depth against a direct call to the save action.
create or replace function public.assert_exam_test_allowed(p_student_id uuid default auth.uid())
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare is_blocked boolean;
begin
  select blocked into is_blocked from public.exam_test_free_status(p_student_id);
  if is_blocked then raise exception 'Free exam test limit reached.'; end if;
end $$;

-- Lets an admin raise, lower, or clear (null = unlimited) one student's
-- free exam-attempt allowance, same shape as admin_set_practice_free_limit.
create or replace function public.admin_set_exam_free_limit(p_student_id uuid, p_limit integer)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  update public.profiles set free_exam_test_limit = p_limit where id = p_student_id and role = 'student';
  if not found then raise exception 'student not found'; end if;
end $$;

revoke all on function public.exam_test_free_status(uuid), public.assert_exam_test_allowed(uuid), public.admin_set_exam_free_limit(uuid,integer) from public, anon;
grant execute on function public.exam_test_free_status(uuid), public.assert_exam_test_allowed(uuid) to authenticated;
grant execute on function public.admin_set_exam_free_limit(uuid,integer) to authenticated;

commit;

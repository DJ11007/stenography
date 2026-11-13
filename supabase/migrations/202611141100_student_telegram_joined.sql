begin;

-- Real requested feature: students should be connected to the institute's
-- Telegram channel for broadcast announcements (live-test reminders, new
-- exercises, admit-card/result notices), with a small incentive (free bonus
-- tests) to actually get them to join -- a link in the footer gets ignored.
-- telegram_joined is self-reported (the student clicks "I've joined" after
-- actually joining) purely to hide the dashboard banner once dismissed; it
-- is NOT proof of membership and grants nothing by itself. The real "free
-- tests" reward stays a manual admin step, exactly like every other
-- purchase/grant in this app: the student's own WhatsApp message ("approve
-- my ID") is the admin's cue to bump free_practice_test_limit /
-- free_exam_test_limit (already-existing admin controls) for that student.
alter table public.profiles add column if not exists telegram_joined boolean not null default false;

create or replace function public.mark_telegram_joined()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  update public.profiles set telegram_joined = true, updated_at = now() where id = auth.uid() and role = 'student';
end $$;

revoke all on function public.mark_telegram_joined() from public, anon;
grant execute on function public.mark_telegram_joined() to authenticated;

commit;

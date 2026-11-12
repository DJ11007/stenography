-- Single-session enforcement for student logins: a student should be signed in on only one
-- device/browser at a time. app/auth/actions.ts's signIn() calls count_other_active_sessions()
-- right after a successful password check (student accounts only) to see whether this account
-- already has another live session; if so, and the student didn't tick "log me out of other
-- devices", the just-created session is signed back out and the student is asked to tick the
-- box and try again. Ticking it calls Supabase's own built-in supabase.auth.signOut({ scope:
-- "others" }) to revoke every other session for this account -- no custom "revoke" function is
-- needed for that part, only this read-only count.
--
-- SECURITY DEFINER is required because the `authenticated` role has no grants on the `auth`
-- schema at all; this function only ever reports a count for auth.uid() (the caller's own JWT),
-- never an arbitrary user, so it can't be used to probe another account's sessions.
-- Safe to run twice.
create or replace function public.count_other_active_sessions(p_current_session_id uuid)
returns int
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select count(*)::int from auth.sessions
  where user_id = auth.uid()
    and id <> p_current_session_id
    and (not_after is null or not_after > now());
$$;

revoke all on function public.count_other_active_sessions(uuid) from public;
-- Supabase's own default privileges auto-grant EXECUTE on every new public-schema function to
-- anon/authenticated/service_role at creation time, straight to those roles (not through the
-- PUBLIC pseudo-role) -- "revoke ... from public" above doesn't touch that. anon has no
-- auth.uid() to match against so this was never exploitable, but revoke it explicitly anyway.
revoke execute on function public.count_other_active_sessions(uuid) from anon;
grant execute on function public.count_other_active_sessions(uuid) to authenticated;

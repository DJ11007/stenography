begin;

-- Reset a student's password directly (no email link) -- for the rare
-- case a student is also locked out of their email.
--
-- This runs as a SECURITY DEFINER RPC on the admin's own AAL2 session, so
-- it does NOT need the SUPABASE_SERVICE_ROLE_KEY that
-- auth.admin.updateUserById() needs -- that key throws "Invalid API key"
-- once a project moves to the new sb_publishable_/sb_secret_ API-key
-- format and the legacy JWT keys are disabled. The server action still
-- falls back to the service-role API where a valid key IS configured.
--
-- GoTrue verifies passwords with bcrypt ($2a$), so a pgcrypto bcrypt hash
-- of cost 10 in auth.users.encrypted_password is exactly what it expects
-- on the next sign-in. Live sessions / refresh tokens are cleared so an
-- old token can't outlive the reset.

create or replace function public.admin_set_student_password(p_student_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, auth
as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters.';
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf', 10)),
      updated_at = now()
  where id = p_student_id;
  if not found then raise exception 'user not found'; end if;

  delete from auth.sessions where user_id = p_student_id;
  delete from auth.refresh_tokens where user_id = p_student_id::text;
end $$;

-- On hosted Supabase auth.users is owned by supabase_auth_admin. Run the
-- function as that role so its writes are permitted no matter how tightly
-- the project restricts the postgres role's access to the auth schema.
-- Guarded + exception-swallowed: local / self-hosted setups without that
-- role, or projects where postgres cannot reassign to it, simply keep the
-- default postgres owner (which can still write auth.users on most
-- projects; the server action falls back to the service-role key if not).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    begin
      grant execute on function public.is_aal2_admin() to supabase_auth_admin;
      alter function public.admin_set_student_password(uuid, text) owner to supabase_auth_admin;
    exception when others then
      raise notice 'admin_set_student_password: kept postgres owner: %', sqlerrm;
    end;
  end if;
end $$;

revoke all on function public.admin_set_student_password(uuid, text) from public, anon;
grant execute on function public.admin_set_student_password(uuid, text) to authenticated;

commit;

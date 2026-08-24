-- Run this file once in Supabase Dashboard > SQL Editor. It is safe only for a new project.
create type public.app_role as enum ('student', 'admin');
create type public.admin_level as enum ('ordinary', 'institution_owner', 'platform_owner');
create type public.test_status as enum ('draft', 'published', 'archived');
create type public.test_type as enum ('typing', 'stenography', 'word_efficiency', 'excel_efficiency');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.app_role not null default 'student',
  admin_level public.admin_level,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  test_type public.test_type not null default 'typing',
  language text,
  status public.test_status not null default 'draft',
  duration_seconds integer check (duration_seconds > 0),
  instructions text,
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active = true);
$$;

alter table public.profiles enable row level security;
alter table public.tests enable row level security;

create policy "Users can view their own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can update their own name" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()) and is_active = (select is_active from public.profiles where id = auth.uid()));
create policy "Admins can manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can view published tests" on public.tests for select using (status = 'published' or public.is_admin());
create policy "Admins can create tests" on public.tests for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "Admins can update tests" on public.tests for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete tests" on public.tests for delete to authenticated using (public.is_admin());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger tests_set_updated_at before update on public.tests for each row execute procedure public.set_updated_at();

-- Account-recovery records contain only one-way identifier hashes and short operator
-- hints. They are never readable or writable from the browser; all access is through
-- narrowly scoped SECURITY DEFINER functions or a server-only service-role client.
create type public.recovery_request_type as enum ('student', 'admin');
create type public.recovery_status as enum ('pending', 'approved', 'rejected', 'expired', 'used');

create table public.recovery_rate_limits (
  id bigint generated always as identity primary key,
  kind text not null,
  fingerprint_hash text not null,
  identifier_hash text not null,
  created_at timestamptz not null default now()
);

create index recovery_rate_limits_lookup on public.recovery_rate_limits
  (fingerprint_hash, created_at desc);

create table public.account_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  request_type public.recovery_request_type not null,
  student_id_hint text not null check (char_length(student_id_hint) <= 4),
  institution_code text not null check (char_length(institution_code) <= 32),
  identifiers_hash text not null,
  fingerprint_hash text not null,
  status public.recovery_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recovery_audit_log (
  id bigint generated always as identity primary key,
  recovery_request_id uuid references public.account_recovery_requests(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.recovery_rate_limits enable row level security;
alter table public.account_recovery_requests enable row level security;
alter table public.recovery_audit_log enable row level security;
-- Intentionally no direct client policies on recovery tables.

create or replace function public.record_recovery_attempt(
  p_kind text, p_fingerprint_hash text, p_identifier_hash text
) returns boolean language plpgsql security definer set search_path = public as $$
declare attempt_count integer;
begin
  delete from public.recovery_rate_limits where created_at < now() - interval '24 hours';
  select count(*) into attempt_count from public.recovery_rate_limits
    where fingerprint_hash = p_fingerprint_hash and created_at > now() - interval '1 hour';
  if attempt_count >= 5 then return false; end if;
  insert into public.recovery_rate_limits(kind, fingerprint_hash, identifier_hash)
    values (left(p_kind, 40), p_fingerprint_hash, p_identifier_hash);
  return true;
end;
$$;

create or replace function public.submit_account_recovery_request(
  p_request_type public.recovery_request_type,
  p_student_id_hint text,
  p_institution_code text,
  p_identifiers_hash text,
  p_fingerprint_hash text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.record_recovery_attempt('account_' || p_request_type::text, p_fingerprint_hash, p_identifiers_hash) then
    return false;
  end if;
  insert into public.account_recovery_requests
    (request_type, student_id_hint, institution_code, identifiers_hash, fingerprint_hash)
  values (p_request_type, right(p_student_id_hint, 4), left(p_institution_code, 32), p_identifiers_hash, p_fingerprint_hash);
  return true;
end;
$$;

revoke all on function public.record_recovery_attempt(text, text, text) from public, anon, authenticated;
revoke all on function public.submit_account_recovery_request(public.recovery_request_type, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_recovery_attempt(text, text, text) to service_role;
grant execute on function public.submit_account_recovery_request(public.recovery_request_type, text, text, text, text) to service_role;

create or replace function public.review_account_recovery(
  p_request_id uuid, p_decision public.recovery_status, p_target_user_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare reviewer public.profiles%rowtype; request_row public.account_recovery_requests%rowtype;
begin
  select * into reviewer from public.profiles where id = auth.uid() for update;
  select * into request_row from public.account_recovery_requests where id = p_request_id for update;
  if reviewer.role <> 'admin' or reviewer.admin_level not in ('platform_owner', 'institution_owner') then
    raise exception 'not authorized';
  end if;
  if request_row.status <> 'pending' or request_row.expires_at <= now() or p_decision not in ('approved', 'rejected') then
    raise exception 'request unavailable';
  end if;
  -- Admin recovery may only be reviewed by an owner; ordinary administrators never qualify above.
  update public.account_recovery_requests set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  insert into public.recovery_audit_log(recovery_request_id, actor_user_id, target_user_id, action)
    values (p_request_id, auth.uid(), p_target_user_id, 'recovery_' || p_decision::text);
end;
$$;

revoke all on function public.review_account_recovery(uuid, public.recovery_status, uuid) from public, anon;
grant execute on function public.review_account_recovery(uuid, public.recovery_status, uuid) to authenticated;

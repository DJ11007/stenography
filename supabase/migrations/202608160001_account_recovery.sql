-- Additive account-recovery migration. Safe to run repeatedly.
-- Recovery data remains inaccessible to browser roles unless a function below
-- explicitly authorizes the authenticated caller.

do $$ begin
  create type public.recovery_request_type as enum ('student', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.recovery_status as enum ('pending', 'approved', 'rejected', 'expired', 'used');
exception when duplicate_object then null;
end $$;

create table if not exists public.recovery_rate_limits (
  id bigint generated always as identity primary key,
  kind text not null,
  fingerprint_hash text not null,
  identifier_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists recovery_rate_limits_lookup
  on public.recovery_rate_limits (fingerprint_hash, created_at desc);

create table if not exists public.account_recovery_requests (
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

create index if not exists account_recovery_requests_review_queue
  on public.account_recovery_requests (request_type, status, created_at desc);

create table if not exists public.recovery_audit_log (
  id bigint generated always as identity primary key,
  recovery_request_id uuid references public.account_recovery_requests(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recovery_audit_log_request
  on public.recovery_audit_log (recovery_request_id, created_at desc);

create table if not exists public.recovery_review_authorizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  authority text not null check (authority in ('institution_owner', 'platform_owner')),
  created_at timestamptz not null default now()
);

alter table public.recovery_rate_limits enable row level security;
alter table public.account_recovery_requests enable row level security;
alter table public.recovery_audit_log enable row level security;
alter table public.recovery_review_authorizations enable row level security;

-- No policies are created for the three sensitive recovery-data tables: RLS
-- therefore denies all browser access. Authorized owners may only see their own
-- authorization marker; service_role manages the records and bypasses RLS.
do $$ begin
  create policy "Owners can view their recovery-review authorization"
    on public.recovery_review_authorizations for select to authenticated
    using (user_id = (select auth.uid()));
exception when duplicate_object then null;
end $$;

create or replace function public.record_recovery_attempt(
  p_kind text, p_fingerprint_hash text, p_identifier_hash text
) returns boolean language plpgsql security definer set search_path = public as $$
declare attempt_count integer;
begin
  select count(*) into attempt_count
  from public.recovery_rate_limits
  where fingerprint_hash = p_fingerprint_hash
    and created_at > now() - interval '1 hour';
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
  if not public.record_recovery_attempt(
    'account_' || p_request_type::text, p_fingerprint_hash, p_identifiers_hash
  ) then return false; end if;
  insert into public.account_recovery_requests
    (request_type, student_id_hint, institution_code, identifiers_hash, fingerprint_hash)
  values
    (p_request_type, right(p_student_id_hint, 4), left(p_institution_code, 32),
     p_identifiers_hash, p_fingerprint_hash);
  return true;
end;
$$;

create or replace function public.review_account_recovery(
  p_request_id uuid, p_decision public.recovery_status, p_target_user_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare request_row public.account_recovery_requests%rowtype;
begin
  if not exists (
    select 1 from public.recovery_review_authorizations
    where user_id = auth.uid()
      and authority in ('platform_owner', 'institution_owner')
  ) then raise exception 'not authorized'; end if;

  select * into request_row from public.account_recovery_requests
    where id = p_request_id for update;
  if request_row.id is null or request_row.status <> 'pending'
     or request_row.expires_at <= now()
     or p_decision not in ('approved', 'rejected') then
    raise exception 'request unavailable';
  end if;

  update public.account_recovery_requests
    set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;
  insert into public.recovery_audit_log
    (recovery_request_id, actor_user_id, target_user_id, action)
  values
    (p_request_id, auth.uid(), p_target_user_id, 'recovery_' || p_decision::text);
end;
$$;

revoke all on function public.record_recovery_attempt(text, text, text) from public, anon, authenticated;
revoke all on function public.submit_account_recovery_request(public.recovery_request_type, text, text, text, text) from public, anon, authenticated;
revoke all on function public.review_account_recovery(uuid, public.recovery_status, uuid) from public, anon;
grant execute on function public.record_recovery_attempt(text, text, text) to service_role;
grant execute on function public.submit_account_recovery_request(public.recovery_request_type, text, text, text, text) to service_role;
grant execute on function public.review_account_recovery(uuid, public.recovery_status, uuid) to authenticated;

comment on table public.account_recovery_requests is
  'Hashed, expiring account-recovery support requests; never stores passwords, OTPs, or full contacts.';

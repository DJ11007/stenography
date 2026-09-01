-- review_account_recovery() previously only authorized callers holding a row
-- in recovery_review_authorizations (authority in
-- 'platform_owner'/'institution_owner') -- a table nothing ever inserts
-- into. That made the function unusable by anyone, including this site's
-- own admin, on a single-institute deployment that has no multi-institute
-- ownership model. Wrap-and-neutralize: accept the same public.is_aal2_admin()
-- check every other admin-only function in this codebase already uses,
-- alongside (not instead of) the original authorization-table path, so a
-- future multi-institute rebuild can still use that table without this
-- redefinition needing to change again.
create or replace function public.review_account_recovery(
  p_request_id uuid, p_decision public.recovery_status, p_target_user_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare request_row public.account_recovery_requests%rowtype;
begin
  if not (
    public.is_aal2_admin()
    or exists (
      select 1 from public.recovery_review_authorizations
      where user_id = auth.uid() and authority in ('platform_owner', 'institution_owner')
    )
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

-- Lists recovery requests for the admin review queue. This still never
-- exposes the plaintext details a student typed -- account_recovery_requests
-- only ever stores a one-way hash of them (see submit_account_recovery_request
-- above) plus the last 4 characters of their self-declared ID as a weak hint.
-- The admin must independently confirm the student's identity (e.g. a phone
-- call or WhatsApp message where the student repeats the same details) before
-- approving; approving here only records the decision, it does not by itself
-- change anything about the student's account. p_status defaults to
-- 'pending' (the actionable queue); pass null for the full history.
create or replace function public.admin_list_recovery_requests(p_status public.recovery_status default 'pending')
returns table(
  id uuid, request_type public.recovery_request_type, student_id_hint text, institution_code text,
  status public.recovery_status, created_at timestamptz, expires_at timestamptz,
  reviewed_by uuid, reviewed_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query
    select r.id, r.request_type, r.student_id_hint, r.institution_code, r.status, r.created_at, r.expires_at, r.reviewed_by, r.reviewed_at
    from public.account_recovery_requests r
    where p_status is null or r.status = p_status
    order by r.created_at desc
    limit 200;
end;
$$;

revoke all on function public.admin_list_recovery_requests(public.recovery_status) from public, anon;
grant execute on function public.admin_list_recovery_requests(public.recovery_status) to authenticated;
grant execute on function public.review_account_recovery(uuid, public.recovery_status, uuid) to authenticated;

commit;

-- A genuine permanent-delete path for any managed test (learn/practice/
-- exam/stenography) that has real attempts -- the existing
-- delete_managed_test_if_safe() deliberately refuses to touch a test with
-- any test_attempts at all, and until now there was no other way to remove
-- one. Mirrors word_efficiency's permanently_delete_word_efficiency_test()
-- exactly: AAL2-admin only, requires the admin to type the test's exact
-- title plus an explicit destruction acknowledgement, and is idempotent via
-- a client-generated request_id (a retried/duplicate submission returns the
-- same result instead of erroring or double-deleting).
begin;

create table public.managed_test_deletion_audit(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 deleted_test_id uuid not null unique,
 deleted_test_title text not null check(length(deleted_test_title) between 1 and 500),
 deleted_test_mode public.test_mode not null,
 deleted_by uuid not null references public.profiles(id) on delete restrict,
 deleted_at timestamptz not null default now(),
 version_count integer not null check(version_count>=0),
 -- test_attempts has no in-progress/prepared state to distinguish (unlike
 -- word_efficiency's attempts table) -- submitted_at is set at insert time
 -- for every row, so every attempt counted here is already a completed one.
 attempt_count integer not null check(attempt_count>=0),
 audio_file_count integer not null check(audio_file_count>=0)
);

-- Only stenography dictation audio ever lives in storage for a managed
-- test (test_versions.configuration->>'audio_path', bucket
-- 'stenography-audio'); every other asset this app stores for tests lives
-- in the database itself. Same shape as word_efficiency_storage_cleanup,
-- narrower because there's only the one bucket involved.
create table public.test_storage_cleanup(
 id uuid primary key default gen_random_uuid(),
 audit_id uuid not null references public.managed_test_deletion_audit(id) on delete cascade,
 bucket_id text not null check(bucket_id in('stenography-audio')),
 object_path text not null check(length(object_path) between 1 and 1000 and object_path!~'(^/|\\|(^|/)\.\.(/|$))'),
 status text not null default'pending'check(status in('pending','removed','failed','retained_shared')),
 attempt_count integer not null default 0 check(attempt_count>=0),
 last_error text check(last_error is null or length(last_error)<=1000),
 last_attempted_at timestamptz,
 created_at timestamptz not null default now(),
 unique(audit_id,bucket_id,object_path)
);

alter table public.managed_test_deletion_audit enable row level security;
alter table public.test_storage_cleanup enable row level security;
create policy "AAL2 admins read managed-test deletion audits" on public.managed_test_deletion_audit for select to authenticated using(public.is_aal2_admin());
create policy "AAL2 admins read test storage cleanup" on public.test_storage_cleanup for select to authenticated using(public.is_aal2_admin());
revoke all on public.managed_test_deletion_audit, public.test_storage_cleanup from anon, authenticated;
grant select on public.managed_test_deletion_audit, public.test_storage_cleanup to authenticated;

create or replace function public.permanently_delete_managed_test(p_test_id uuid, p_typed_title text, p_acknowledged boolean, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.tests%rowtype; aid uuid; audit_test_id uuid; vc integer; ac integer; fc integer; jobs jsonb;
begin
 if not public.is_aal2_admin() then raise exception 'AAL2 administrator required'; end if;
 if p_test_id is null or p_request_id is null then raise exception 'test and request identifiers required'; end if;
 select a.id, a.deleted_test_id into aid, audit_test_id from public.managed_test_deletion_audit a where a.request_id = p_request_id or a.deleted_test_id = p_test_id order by (a.request_id = p_request_id) desc limit 1;
 if aid is not null and audit_test_id is distinct from p_test_id then raise exception 'request identifier belongs to another deletion'; end if;
 if aid is not null then
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bucket',c.bucket_id,'path',c.object_path,'status',c.status,'attempt_count',c.attempt_count) order by c.id), '[]'::jsonb) into jobs from public.test_storage_cleanup c where c.audit_id = aid;
  return jsonb_build_object('audit_id', aid, 'already_deleted', true, 'cleanup_jobs', jobs);
 end if;
 select * into t from public.tests where id = p_test_id for update; if not found then raise exception 'test unavailable'; end if;
 if p_typed_title is null or p_typed_title is distinct from t.title then raise exception 'typed title does not match'; end if;
 if p_acknowledged is distinct from true then raise exception 'destruction acknowledgement required'; end if;
 select count(*) into vc from public.test_versions where test_id = t.id;
 select count(*) into ac from public.test_attempts where test_id = t.id;
 select count(*) into fc from (select distinct v.configuration->>'audio_path' as path from public.test_versions v where v.test_id = t.id and (v.configuration->>'audio_path') is not null and (v.configuration->>'audio_path') !~ '(^/|\\|(^|/)\.\.(/|$))') f;
 insert into public.managed_test_deletion_audit(request_id, deleted_test_id, deleted_test_title, deleted_test_mode, deleted_by, version_count, attempt_count, audio_file_count)
  values (p_request_id, t.id, t.title, t.mode, auth.uid(), vc, ac, fc) returning id into aid;
 insert into public.test_storage_cleanup(audit_id, bucket_id, object_path, status)
 select aid, 'stenography-audio', f.path, case when exists(
   select 1 from public.test_versions surviving where surviving.test_id <> t.id and (surviving.configuration->>'audio_path') = f.path
  ) then 'retained_shared' else 'pending' end
 from (select distinct v.configuration->>'audio_path' as path from public.test_versions v where v.test_id = t.id and (v.configuration->>'audio_path') is not null and (v.configuration->>'audio_path') !~ '(^/|\\|(^|/)\.\.(/|$))') f;
 insert into public.admin_test_audit_log(actor_user_id, test_id, action, metadata) values (auth.uid(), t.id, 'test_permanently_deleted', jsonb_build_object('title', t.title, 'mode', t.mode, 'version_count', vc, 'attempt_count', ac));
 delete from public.test_attempts where test_id = t.id;
 update public.tests set current_version_id = null where id = t.id;
 delete from public.test_versions where test_id = t.id;
 delete from public.tests where id = t.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bucket',c.bucket_id,'path',c.object_path,'status',c.status,'attempt_count',c.attempt_count) order by c.id), '[]'::jsonb) into jobs from public.test_storage_cleanup c where c.audit_id = aid;
 return jsonb_build_object('audit_id', aid, 'already_deleted', false, 'deleted_test_id', t.id, 'title', t.title, 'mode', t.mode, 'version_count', vc, 'attempt_count', ac, 'audio_file_count', fc, 'cleanup_jobs', jobs);
end $$;

revoke all on function public.permanently_delete_managed_test(uuid,text,boolean,uuid) from public, anon;
grant execute on function public.permanently_delete_managed_test(uuid,text,boolean,uuid) to authenticated;

commit;

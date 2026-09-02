-- Extends permanently_delete_managed_test() to also queue cleanup of any
-- admin-uploaded question-paper PDF (managed-test-pdfs bucket,
-- test_versions.configuration->>'pdf_path'), added after the original
-- permanent-delete migration. Mirrors the existing audio-cleanup logic
-- exactly, just for the second bucket.

alter table public.test_storage_cleanup drop constraint if exists test_storage_cleanup_bucket_id_check;
alter table public.test_storage_cleanup add constraint test_storage_cleanup_bucket_id_check check(bucket_id in('stenography-audio','managed-test-pdfs'));

alter table public.managed_test_deletion_audit add column if not exists pdf_file_count integer not null default 0 check(pdf_file_count>=0);

create or replace function public.permanently_delete_managed_test(p_test_id uuid, p_typed_title text, p_acknowledged boolean, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.tests%rowtype; aid uuid; audit_test_id uuid; vc integer; ac integer; fc integer; pc integer; jobs jsonb;
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
 select count(*) into pc from (select distinct v.configuration->>'pdf_path' as path from public.test_versions v where v.test_id = t.id and (v.configuration->>'pdf_path') is not null and (v.configuration->>'pdf_path') !~ '(^/|\\|(^|/)\.\.(/|$))') f;
 insert into public.managed_test_deletion_audit(request_id, deleted_test_id, deleted_test_title, deleted_test_mode, deleted_by, version_count, attempt_count, audio_file_count, pdf_file_count)
  values (p_request_id, t.id, t.title, t.mode, auth.uid(), vc, ac, fc, pc) returning id into aid;
 insert into public.test_storage_cleanup(audit_id, bucket_id, object_path, status)
 select aid, 'stenography-audio', f.path, case when exists(
   select 1 from public.test_versions surviving where surviving.test_id <> t.id and (surviving.configuration->>'audio_path') = f.path
  ) then 'retained_shared' else 'pending' end
 from (select distinct v.configuration->>'audio_path' as path from public.test_versions v where v.test_id = t.id and (v.configuration->>'audio_path') is not null and (v.configuration->>'audio_path') !~ '(^/|\\|(^|/)\.\.(/|$))') f;
 insert into public.test_storage_cleanup(audit_id, bucket_id, object_path, status)
 select aid, 'managed-test-pdfs', f.path, case when exists(
   select 1 from public.test_versions surviving where surviving.test_id <> t.id and (surviving.configuration->>'pdf_path') = f.path
  ) then 'retained_shared' else 'pending' end
 from (select distinct v.configuration->>'pdf_path' as path from public.test_versions v where v.test_id = t.id and (v.configuration->>'pdf_path') is not null and (v.configuration->>'pdf_path') !~ '(^/|\\|(^|/)\.\.(/|$))') f;
 insert into public.admin_test_audit_log(actor_user_id, test_id, action, metadata) values (auth.uid(), t.id, 'test_permanently_deleted', jsonb_build_object('title', t.title, 'mode', t.mode, 'version_count', vc, 'attempt_count', ac));
 delete from public.test_attempts where test_id = t.id;
 update public.tests set current_version_id = null where id = t.id;
 delete from public.test_versions where test_id = t.id;
 delete from public.tests where id = t.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bucket',c.bucket_id,'path',c.object_path,'status',c.status,'attempt_count',c.attempt_count) order by c.id), '[]'::jsonb) into jobs from public.test_storage_cleanup c where c.audit_id = aid;
 return jsonb_build_object('audit_id', aid, 'already_deleted', false, 'deleted_test_id', t.id, 'title', t.title, 'mode', t.mode, 'version_count', vc, 'attempt_count', ac, 'audio_file_count', fc, 'pdf_file_count', pc, 'cleanup_jobs', jobs);
end $$;

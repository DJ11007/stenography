begin;

create table public.word_efficiency_deletion_audit(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 deleted_test_id uuid not null unique,
 deleted_test_title text not null check(length(deleted_test_title)between 1 and 500),
 deleted_by uuid not null references public.profiles(id)on delete restrict,
 deleted_at timestamptz not null default now(),
 version_count integer not null check(version_count>=0),
 attempt_count integer not null check(attempt_count>=0),
 active_attempt_count integer not null check(active_attempt_count>=0),
 result_count integer not null check(result_count>=0),
 file_count integer not null check(file_count>=0)
);

create table public.word_efficiency_storage_cleanup(
 id uuid primary key default gen_random_uuid(),
 audit_id uuid not null references public.word_efficiency_deletion_audit(id)on delete cascade,
 bucket_id text not null check(bucket_id in('word-efficiency-pdfs','word-efficiency-working-matter')),
 object_path text not null check(length(object_path)between 1 and 1000 and object_path!~'(^/|\\|(^|/)\.\.(/|$))'),
 status text not null default'pending'check(status in('pending','removed','failed','retained_shared')),
 attempt_count integer not null default 0 check(attempt_count>=0),
 last_error text check(last_error is null or length(last_error)<=1000),
 last_attempted_at timestamptz,
 created_at timestamptz not null default now(),
 unique(audit_id,bucket_id,object_path)
);

alter table public.word_efficiency_deletion_audit enable row level security;
alter table public.word_efficiency_storage_cleanup enable row level security;
create policy "AAL2 admins read Word deletion audits"on public.word_efficiency_deletion_audit for select to authenticated using(public.is_aal2_admin());
create policy "AAL2 admins read Word storage cleanup"on public.word_efficiency_storage_cleanup for select to authenticated using(public.is_aal2_admin());
revoke all on public.word_efficiency_deletion_audit,public.word_efficiency_storage_cleanup from anon,authenticated;
grant select on public.word_efficiency_deletion_audit,public.word_efficiency_storage_cleanup to authenticated;

create or replace function public.permanently_delete_word_efficiency_test(p_test_id uuid,p_typed_title text,p_acknowledged boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.word_efficiency_tests%rowtype;aid uuid;audit_test_id uuid;vc integer;ac integer;active_count integer;rc integer;fc integer;jobs jsonb;
begin
 if not public.is_aal2_admin()then raise exception 'AAL2 administrator required';end if;
 if p_test_id is null or p_request_id is null then raise exception 'test and request identifiers required';end if;
 select a.id,a.deleted_test_id into aid,audit_test_id from public.word_efficiency_deletion_audit a where a.request_id=p_request_id or a.deleted_test_id=p_test_id order by(a.request_id=p_request_id)desc limit 1;
 if aid is not null and audit_test_id is distinct from p_test_id then raise exception 'request identifier belongs to another deletion';end if;
 if aid is not null then select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bucket',c.bucket_id,'path',c.object_path,'status',c.status,'attempt_count',c.attempt_count)order by c.id),'[]'::jsonb)into jobs from public.word_efficiency_storage_cleanup c where c.audit_id=aid;return jsonb_build_object('audit_id',aid,'already_deleted',true,'cleanup_jobs',jobs);end if;
 select * into t from public.word_efficiency_tests where id=p_test_id for update;if not found then raise exception 'test unavailable';end if;
 if p_typed_title is null or p_typed_title is distinct from t.title then raise exception 'typed title does not match';end if;if p_acknowledged is distinct from true then raise exception 'destruction acknowledgement required';end if;
 select count(*)into vc from public.word_efficiency_versions where test_id=t.id;select count(*),count(*)filter(where status in('prepared','active','paused')),count(*)filter(where status in('submitted','completed'))into ac,active_count,rc from public.word_efficiency_attempts where test_id=t.id;
 select count(*)into fc from(
  select 'word-efficiency-pdfs'::text bucket_id,v.pdf_path object_path from public.word_efficiency_versions v where v.test_id=t.id and v.pdf_path is not null
  union
  select 'word-efficiency-working-matter',v.working_matter_snapshot#>>'{source,storagePath}' from public.word_efficiency_versions v where v.test_id=t.id and v.working_matter_snapshot#>>'{source,bucket}'='word-efficiency-working-matter'and v.working_matter_snapshot#>>'{source,storagePath}'is not null
 )f where f.object_path!~'(^/|\\|(^|/)\.\.(/|$))';
 insert into public.word_efficiency_deletion_audit(request_id,deleted_test_id,deleted_test_title,deleted_by,version_count,attempt_count,active_attempt_count,result_count,file_count)values(p_request_id,t.id,t.title,auth.uid(),vc,ac,active_count,rc,fc)returning id into aid;
 insert into public.word_efficiency_storage_cleanup(audit_id,bucket_id,object_path,status)
 select aid,f.bucket_id,f.object_path,case when exists(
  select 1 from public.word_efficiency_versions surviving where surviving.test_id<>t.id and(
   (f.bucket_id='word-efficiency-pdfs'and surviving.pdf_path=f.object_path)or
   (f.bucket_id='word-efficiency-working-matter'and surviving.working_matter_snapshot#>>'{source,bucket}'=f.bucket_id and surviving.working_matter_snapshot#>>'{source,storagePath}'=f.object_path)
  )
 )then'retained_shared'else'pending'end from(
  select 'word-efficiency-pdfs'::text bucket_id,v.pdf_path object_path from public.word_efficiency_versions v where v.test_id=t.id and v.pdf_path is not null
  union
  select 'word-efficiency-working-matter',v.working_matter_snapshot#>>'{source,storagePath}' from public.word_efficiency_versions v where v.test_id=t.id and v.working_matter_snapshot#>>'{source,bucket}'='word-efficiency-working-matter'and v.working_matter_snapshot#>>'{source,storagePath}'is not null
 )f where f.object_path!~'(^/|\\|(^|/)\.\.(/|$))';
 delete from public.word_efficiency_question_scores s using public.word_efficiency_attempts a where s.attempt_id=a.id and a.test_id=t.id;
 delete from public.word_efficiency_attempts where test_id=t.id;
 delete from public.word_efficiency_questions q using public.word_efficiency_versions v where q.version_id=v.id and v.test_id=t.id;
 update public.word_efficiency_tests set current_version_id=null where id=t.id;
 delete from public.word_efficiency_versions where test_id=t.id;
 delete from public.word_efficiency_tests where id=t.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bucket',c.bucket_id,'path',c.object_path,'status',c.status,'attempt_count',c.attempt_count)order by c.id),'[]'::jsonb)into jobs from public.word_efficiency_storage_cleanup c where c.audit_id=aid;
 return jsonb_build_object('audit_id',aid,'already_deleted',false,'deleted_test_id',t.id,'title',t.title,'version_count',vc,'attempt_count',ac,'active_attempt_count',active_count,'result_count',rc,'file_count',fc,'cleanup_jobs',jobs);
end $$;

revoke all on function public.permanently_delete_word_efficiency_test(uuid,text,boolean,uuid)from public,anon;
grant execute on function public.permanently_delete_word_efficiency_test(uuid,text,boolean,uuid)to authenticated;

-- The legacy no-attempt deletion RPC must no longer be callable.
revoke all on function public.delete_word_efficiency_test(uuid)from public,anon,authenticated;

commit;

begin;

-- Phase 2 of the real-file workflow: a third delivery method,
-- "realfile" -- a student downloads the real Working Matter .docx (from the
-- bucket Phase 1 started keeping originals in), edits it in their own
-- installed MS Word, and uploads the finished file back before the same
-- deadline the on-screen mode already enforces. The uploaded file is parsed
-- with the exact same DOCX parser/security hardening used for admin
-- uploads (path traversal, zip-bomb, macro, external-relationship
-- rejection -- now exercised against untrusted student input, which is why
-- reusing that already-hardened parser matters), converted to the same
-- schema-v2 document shape the on-screen editor produces, and submitted
-- through the *existing* submit_word_efficiency_document RPC -- so
-- auto-grading, manual grading, results, and the admin grading UI all keep
-- working completely unchanged; nothing downstream of submission needed to
-- know a document came from a real file instead of live typing.

alter table public.word_efficiency_versions add column if not exists delivery_realfile boolean not null default false;

-- Both old CHECK constraints are found and dropped by inspecting their
-- actual definition text rather than guessing Postgres's auto-generated
-- name -- an unnamed multi-column table CHECK is named "{table}_check"/
-- "_check1"/etc, not from its column names, so guessing wrong here would
-- silently leave the OLD, more restrictive constraint enforcing alongside
-- a new one, still rejecting 'realfile' outright.
do $$
declare old_delivery_flags_check text;old_delivery_method_check text;
begin
 select conname into old_delivery_flags_check from pg_constraint
  where conrelid='public.word_efficiency_versions'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%delivery_onscreen%' and pg_get_constraintdef(oid) ilike '%delivery_pdf%'
    and pg_get_constraintdef(oid) not ilike '%delivery_realfile%';
 if old_delivery_flags_check is not null then
  execute format('alter table public.word_efficiency_versions drop constraint %I',old_delivery_flags_check);
 end if;
 alter table public.word_efficiency_versions add constraint word_efficiency_versions_delivery_flags_check check(delivery_onscreen or delivery_pdf or delivery_realfile);

 select conname into old_delivery_method_check from pg_constraint
  where conrelid='public.word_efficiency_attempts'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%delivery_method%'
    and pg_get_constraintdef(oid) not ilike '%realfile%';
 if old_delivery_method_check is not null then
  execute format('alter table public.word_efficiency_attempts drop constraint %I',old_delivery_method_check);
 end if;
 alter table public.word_efficiency_attempts add constraint word_efficiency_attempts_delivery_method_check check(delivery_method in('onscreen','pdf','realfile'));
end $$;

-- The actual uploaded file is kept for admin review (the parser's
-- interpretation is what's graded, but a teacher may want to open the real
-- file a student submitted -- the same rationale as keeping the original
-- Working Matter). Private; a student may only write/read their own
-- submission, scoped by attempt ownership.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('word-efficiency-submissions','word-efficiency-submissions',false,10485760,array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "AAL2 admins read Word submission files" on storage.objects for select to authenticated
using(bucket_id='word-efficiency-submissions' and public.is_aal2_admin());

create policy "Students manage their own Word submission file" on storage.objects for all to authenticated
using(
  bucket_id='word-efficiency-submissions' and exists(
    select 1 from public.word_efficiency_attempts a where a.student_id=auth.uid() and a.id::text=split_part(storage.objects.name,'/',1)
  )
)
with check(
  bucket_id='word-efficiency-submissions' and exists(
    select 1 from public.word_efficiency_attempts a where a.student_id=auth.uid() and a.id::text=split_part(storage.objects.name,'/',1) and a.status='active'
  )
);

-- Full redefinition (mirrors 202608240002's body exactly, extended for the
-- new delivery flag and its own validation).
create or replace function public.save_word_efficiency_test(p_test_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare tid uuid;vid uuid;vn integer;pub boolean;ons boolean;pdf boolean;realfile boolean;q jsonb;dur integer;total numeric;qc integer;matter jsonb;caps jsonb;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized';end if;matter:=p_payload->'working_matter_snapshot';caps:=p_payload->'editor_capabilities';perform public.assert_word_efficiency_working_matter(matter);perform public.assert_word_efficiency_editor_capabilities(caps);if matter->>'language'<>p_payload->>'language'then raise exception 'Working Matter language must match test language';end if;
 pub:=coalesce((p_payload->>'publish')::boolean,false);ons:=coalesce((p_payload->>'delivery_onscreen')::boolean,false);pdf:=coalesce((p_payload->>'delivery_pdf')::boolean,false);realfile:=coalesce((p_payload->>'delivery_realfile')::boolean,false);if nullif(btrim(p_payload->>'instructions_markdown'),'')is null then raise exception 'instructions required';end if;if not ons and not pdf and not realfile then raise exception 'delivery method required';end if;
 if realfile and coalesce(matter#>>'{source,bucket}','')<>'word-efficiency-working-matter' then raise exception 'Real-file delivery requires a Working Matter uploaded as a real .docx (re-upload it before enabling this delivery method)';end if;
 if jsonb_array_length(coalesce(p_payload->'duration_options','[]'))<1 then raise exception 'duration required';end if;for dur in select value::integer from jsonb_array_elements_text(p_payload->'duration_options')loop if dur<60 or dur>14400 then raise exception 'invalid duration';end if;end loop;
 qc:=jsonb_array_length(coalesce(p_payload->'questions','[]'));if qc<1 or qc>500 or qc<>(p_payload->>'question_count')::integer then raise exception 'question count mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'questions')i where nullif(i->>'number','')is null or(i->>'number')::integer<1 or nullif(i->>'display_order','')is null or(i->>'display_order')::integer<1 or nullif(i->>'marks','')is null or(i->>'marks')::numeric<=0 or(i->>'marks')::numeric>1000)then raise exception 'invalid question number, order, or marks';end if;
 if(select count(distinct(i->>'number')::integer)from jsonb_array_elements(p_payload->'questions')i)<>qc or(select count(distinct(i->>'display_order')::integer)from jsonb_array_elements(p_payload->'questions')i)<>qc then raise exception 'duplicate question number or order';end if;
 if(ons or realfile) and exists(select 1 from jsonb_array_elements(p_payload->'questions')i where coalesce((i->>'is_visible')::boolean,true)and nullif(btrim(i->>'instruction'),'')is null)then raise exception 'visible question text required';end if;if pdf and(nullif(p_payload->>'pdf_path','')is null or nullif(p_payload->>'pdf_file_name','')is null or coalesce((p_payload->>'pdf_size_bytes')::bigint,0)<=0)then raise exception 'valid PDF required';end if;
 select round(coalesce(sum((i->>'marks')::numeric),0),2)into total from jsonb_array_elements(p_payload->'questions')i;if total<>(p_payload->>'maximum_marks')::numeric then raise exception 'question marks total mismatch';end if;
 if p_test_id is null then insert into public.word_efficiency_tests(slug,title,language,status,created_by)values(p_payload->>'slug',p_payload->>'title',p_payload->>'language',case when pub then'published'else'draft'end,auth.uid())returning id into tid;else select id into tid from public.word_efficiency_tests where id=p_test_id for update;if tid is null then raise exception 'test unavailable';end if;update public.word_efficiency_tests set slug=p_payload->>'slug',title=p_payload->>'title',language=p_payload->>'language',status=case when pub then'published'else'draft'end,updated_at=now()where id=tid;end if;
 select coalesce(max(version_number),0)+1 into vn from public.word_efficiency_versions where test_id=tid;
 insert into public.word_efficiency_versions(test_id,version_number,title,language,description,instructions_markdown,delivery_onscreen,delivery_pdf,delivery_realfile,question_count,maximum_marks,duration_options,passing_marks,pdf_path,pdf_file_name,pdf_size_bytes,pdf_page_count,pdf_uploaded_at,working_matter_snapshot,editor_capabilities,created_by)values(tid,vn,p_payload->>'title',p_payload->>'language',coalesce(p_payload->>'description',''),p_payload->>'instructions_markdown',ons,pdf,realfile,qc,total,array(select value::integer from jsonb_array_elements_text(p_payload->'duration_options')),nullif(p_payload->>'passing_marks','')::numeric,nullif(p_payload->>'pdf_path',''),nullif(p_payload->>'pdf_file_name',''),nullif(p_payload->>'pdf_size_bytes','')::bigint,nullif(p_payload->>'pdf_page_count','')::integer,case when pdf then coalesce((p_payload->>'pdf_uploaded_at')::timestamptz,now())end,matter,caps,auth.uid())returning id into vid;
 for q in select value from jsonb_array_elements(p_payload->'questions')loop insert into public.word_efficiency_questions(version_id,question_number,instruction,marks,sample_text,section,display_order,is_visible,grading_note)values(vid,(q->>'number')::integer,coalesce(q->>'instruction',''),(q->>'marks')::numeric,nullif(q->>'sample_text',''),nullif(q->>'section',''),(q->>'display_order')::integer,coalesce((q->>'is_visible')::boolean,true),nullif(q->>'grading_note',''));end loop;
 update public.word_efficiency_tests set current_version_id=vid,current_version_number=vn,published_at=case when pub then coalesce(published_at,now())else published_at end where id=tid;return tid;
end $$;

-- Full redefinition (mirrors 202608260029's body exactly, extended for
-- 'realfile' as a third valid p_delivery value).
create or replace function public.prepare_word_efficiency_attempt(p_test_id uuid,p_duration_seconds integer,p_delivery text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare test_record public.word_efficiency_tests%rowtype;version_record public.word_efficiency_versions%rowtype;new_attempt_id uuid;question_snapshot jsonb;question_total numeric;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 perform public.assert_student_access_allowed();
 select test_rows.* into test_record from public.word_efficiency_tests as test_rows where test_rows.id=p_test_id and test_rows.status='published';
 if not found then raise exception 'test unavailable';end if;
 select version_rows.* into version_record from public.word_efficiency_versions as version_rows where version_rows.id=test_record.current_version_id;
 if not found then raise exception 'published version unavailable';end if;
 if not p_duration_seconds=any(version_record.duration_options)then raise exception 'duration unavailable';end if;
 if p_delivery not in('onscreen','pdf','realfile')or(p_delivery='onscreen'and not version_record.delivery_onscreen)or(p_delivery='pdf'and not version_record.delivery_pdf)or(p_delivery='realfile'and not version_record.delivery_realfile)then raise exception 'delivery unavailable';end if;
 perform public.assert_word_efficiency_working_matter(version_record.working_matter_snapshot);
 perform public.assert_word_efficiency_editor_capabilities(version_record.editor_capabilities);
 select coalesce(jsonb_agg(jsonb_build_object('id',question_rows.id,'question_version_id',question_rows.id,'number',question_rows.question_number,'display_order',question_rows.display_order,'instruction',case when p_delivery in('onscreen','realfile')and question_rows.is_visible then question_rows.instruction end,'marks',question_rows.marks,'section',question_rows.section,'is_visible',question_rows.is_visible)order by question_rows.display_order),'[]'::jsonb),round(coalesce(sum(question_rows.marks),0),2)
 into question_snapshot,question_total from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 if jsonb_array_length(question_snapshot)<>version_record.question_count or question_total<>version_record.maximum_marks then raise exception 'published question allocation is inconsistent';end if;
 insert into public.word_efficiency_attempts(test_id,version_id,student_id,delivery_method,selected_duration_seconds,snapshot)
 values(test_record.id,version_record.id,auth.uid(),p_delivery,p_duration_seconds,jsonb_build_object('test_id',test_record.id,'test_version_id',version_record.id,'instructions_version_id',version_record.id,'question_version_id',version_record.id,'title',version_record.title,'language',version_record.language,'instructions_markdown',version_record.instructions_markdown,'delivery_method',p_delivery,'duration_seconds',p_duration_seconds,'question_count',version_record.question_count,'maximum_marks',question_total,'questions',question_snapshot,'editor_capabilities',version_record.editor_capabilities,'pdf_path',case when p_delivery='pdf'then version_record.pdf_path end,'pdf_file_name',case when p_delivery='pdf'then version_record.pdf_file_name end,'pdf_size_bytes',case when p_delivery='pdf'then version_record.pdf_size_bytes end,'pdf_page_count',case when p_delivery='pdf'then version_record.pdf_page_count end,'pdf_uploaded_at',case when p_delivery='pdf'then version_record.pdf_uploaded_at end))returning word_efficiency_attempts.id into new_attempt_id;
 insert into public.word_efficiency_question_scores(attempt_id,question_id,question_number,maximum_marks)select new_attempt_id,question_rows.id,question_rows.question_number,question_rows.marks from public.word_efficiency_questions as question_rows where question_rows.version_id=version_record.id;
 return new_attempt_id;
end $$;

-- A student needs to know where to download the real Working Matter file
-- from without being able to read the whole (admin-only) versions table
-- directly. Returns just the storage location, and only for a delivery the
-- caller's own active/prepared realfile attempt actually uses.
create or replace function public.get_word_efficiency_realfile_source(p_attempt_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;version_record public.word_efficiency_versions%rowtype;
begin
 if not public.is_active_word_efficiency_student()then raise exception 'active student account required';end if;
 select * into attempt_record from public.word_efficiency_attempts where id=p_attempt_id and student_id=auth.uid() and delivery_method='realfile';
 if not found then raise exception 'attempt unavailable';end if;
 select * into version_record from public.word_efficiency_versions where id=attempt_record.version_id;
 if version_record.working_matter_snapshot#>>'{source,bucket}' is null then raise exception 'original file unavailable for this test';end if;
 return jsonb_build_object('bucket',version_record.working_matter_snapshot#>>'{source,bucket}','storagePath',version_record.working_matter_snapshot#>>'{source,storagePath}','fileName',version_record.working_matter_snapshot#>>'{source,fileName}');
end $$;

revoke all on function public.get_word_efficiency_realfile_source(uuid) from public,anon;
grant execute on function public.get_word_efficiency_realfile_source(uuid) to authenticated;

commit;

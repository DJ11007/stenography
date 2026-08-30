begin;

-- Foundational piece for the upcoming "download a real .docx/.xlsx, edit it
-- in real Word/Excel, upload it back for grading" delivery mode: until now,
-- admin's Working Matter upload parsed the file into our internal snapshot
-- and discarded the original bytes -- only the interpreted JSON survived.
-- These buckets let us keep the real file too, so it can be handed back to
-- a student unchanged. (The word-efficiency-working-matter bucket name was
-- already anticipated by the permanent-deletion cleanup logic in migration
-- 202608240003, which references working_matter_snapshot.source.bucket/
-- storagePath -- this migration finally creates the bucket that logic was
-- always written to expect, and the equivalent for Excel.)

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('word-efficiency-working-matter','word-efficiency-working-matter',false,10485760,array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('excel-efficiency-working-matter','excel-efficiency-working-matter',false,10485760,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "AAL2 admins manage Word working matter files" on storage.objects for all to authenticated
using(bucket_id='word-efficiency-working-matter' and public.is_aal2_admin())
with check(bucket_id='word-efficiency-working-matter' and public.is_aal2_admin());

create policy "Students read their assigned Word working matter file" on storage.objects for select to authenticated
using(
  bucket_id='word-efficiency-working-matter' and exists(
    select 1 from public.word_efficiency_attempts a
    join public.word_efficiency_versions v on v.id=a.version_id
    where a.student_id=auth.uid()
      and v.working_matter_snapshot#>>'{source,bucket}'='word-efficiency-working-matter'
      and v.working_matter_snapshot#>>'{source,storagePath}'=storage.objects.name
  )
);

create policy "AAL2 admins manage Excel working matter files" on storage.objects for all to authenticated
using(bucket_id='excel-efficiency-working-matter' and public.is_aal2_admin())
with check(bucket_id='excel-efficiency-working-matter' and public.is_aal2_admin());

create policy "Students read their assigned Excel working matter file" on storage.objects for select to authenticated
using(
  bucket_id='excel-efficiency-working-matter' and exists(
    select 1 from public.excel_efficiency_attempts a
    join public.excel_efficiency_versions v on v.id=a.version_id
    where a.student_id=auth.uid()
      and v.working_matter_snapshot#>>'{source,bucket}'='excel-efficiency-working-matter'
      and v.working_matter_snapshot#>>'{source,storagePath}'=storage.objects.name
  )
);

commit;

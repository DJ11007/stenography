-- Admin-uploaded question-paper PDFs for the general managed tests table
-- (Practice/Learn/Exam/Stenography), so students get a real "Download PDF"
-- of the exact paper the admin prepared -- distinct from the existing
-- auto-generated Print/PDF button, which prints the typed passage text
-- itself, not a ready-made file. Same pattern as stenography dictation
-- audio: the storage path lives inside the existing
-- test_versions.configuration jsonb payload (as "pdf_path"/"pdf_file_name")
-- -- no new column needed, save_managed_test already persists the full
-- admin payload verbatim. This migration only adds the storage bucket and
-- its access policies. Not mode-restricted (unlike stenography audio): a
-- question-paper PDF is useful for any managed test mode.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('managed-test-pdfs','managed-test-pdfs',false,20971520,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=array['application/pdf'];

drop policy if exists "AAL2 admins manage managed test pdfs" on storage.objects;
create policy "AAL2 admins manage managed test pdfs" on storage.objects for all to authenticated
  using(bucket_id='managed-test-pdfs' and public.is_aal2_admin())
  with check(bucket_id='managed-test-pdfs' and public.is_aal2_admin());

drop policy if exists "Students read published managed test pdfs" on storage.objects;
create policy "Students read published managed test pdfs" on storage.objects for select to authenticated
  using(
    bucket_id='managed-test-pdfs' and exists(
      select 1 from public.test_versions v
      join public.tests t on t.id=v.test_id and t.current_version_id=v.id
      where v.configuration->>'pdf_path'=storage.objects.name
        and t.status='published' and t.visibility='public' and t.is_live=false
    )
  );

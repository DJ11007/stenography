-- Excel Efficiency tests get a question paper PDF, as Word Efficiency tests have: the admin uploads it
-- with the test, students download it from the instructions page (on-screen questions stay).
begin;

alter table public.excel_efficiency_versions
  add column if not exists delivery_pdf boolean not null default false,
  add column if not exists pdf_path text,
  add column if not exists pdf_file_name text,
  add column if not exists pdf_size_bytes bigint,
  add column if not exists pdf_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('excel-efficiency-pdfs', 'excel-efficiency-pdfs', false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "AAL2 admins manage Excel PDFs" on storage.objects;
create policy "AAL2 admins manage Excel PDFs" on storage.objects for all to authenticated
  using (bucket_id = 'excel-efficiency-pdfs' and public.is_aal2_admin())
  with check (bucket_id = 'excel-efficiency-pdfs' and public.is_aal2_admin());

drop policy if exists "Students read current published Excel PDF" on storage.objects;
create policy "Students read current published Excel PDF" on storage.objects for select to authenticated
  using (bucket_id = 'excel-efficiency-pdfs' and exists (
    select 1 from public.profiles p
    join public.excel_efficiency_versions v on v.pdf_path = objects.name and v.delivery_pdf
    join public.excel_efficiency_tests t on t.current_version_id = v.id and t.id = v.test_id and t.status = 'published'
    where p.id = auth.uid() and p.role = 'student'::app_role and p.is_active));

-- Saving a test makes a new version; the admin page then attaches the question paper to it.
create or replace function public.set_excel_efficiency_question_paper(p_test_id uuid, p_delivery_pdf boolean, p_pdf_path text, p_pdf_file_name text, p_pdf_size_bytes bigint, p_pdf_uploaded_at timestamptz)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare v_version uuid;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select current_version_id into v_version from public.excel_efficiency_tests where id = p_test_id;
  if v_version is null then raise exception 'test unavailable'; end if;
  if p_delivery_pdf and coalesce(p_pdf_path, '') = '' then raise exception 'Upload the question paper PDF, or untick "Students can download the question paper PDF".'; end if;
  update public.excel_efficiency_versions set
    delivery_pdf = coalesce(p_delivery_pdf, false) and coalesce(p_pdf_path, '') <> '',
    pdf_path = nullif(p_pdf_path, ''), pdf_file_name = p_pdf_file_name, pdf_size_bytes = p_pdf_size_bytes, pdf_uploaded_at = p_pdf_uploaded_at
  where id = v_version;
end $function$;
revoke execute on function public.set_excel_efficiency_question_paper(uuid, boolean, text, text, bigint, timestamptz) from public, anon;
grant execute on function public.set_excel_efficiency_question_paper(uuid, boolean, text, text, bigint, timestamptz) to authenticated, service_role;

commit;

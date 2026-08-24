begin;

create policy "Students read current published Word PDF"
on storage.objects for select to authenticated
using(
 bucket_id='word-efficiency-pdfs'
 and exists(
  select 1 from public.profiles p
  join public.word_efficiency_versions v on v.pdf_path=storage.objects.name and v.delivery_pdf
  join public.word_efficiency_tests t on t.current_version_id=v.id and t.id=v.test_id and t.status='published'
  where p.id=auth.uid() and p.role='student' and p.is_active
 )
);

commit;

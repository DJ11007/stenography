begin;

drop policy if exists "Published versions are readable" on public.test_versions;

create policy "Published versions are readable"
on public.test_versions
for select
using (
  exists (
    select 1
    from public.tests as related_test
    where related_test.id = public.test_versions.test_id
      and related_test.current_version_id = public.test_versions.id
      and related_test.status = 'published'
      and related_test.visibility = 'public'
  )
  or public.is_aal2_admin()
);

commit;

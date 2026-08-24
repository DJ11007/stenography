-- Read-only preflight for the published-version RLS policy.
select
  policyname,
  cmd,
  qual,
  qual like '%test_versions.test_id%' as qualifies_outer_test_id,
  qual like '%test_versions.id%' as qualifies_outer_version_id,
  qual like '%is_aal2_admin%' as preserves_aal2_admin_access
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'test_versions'
  and policyname = 'Published versions are readable';

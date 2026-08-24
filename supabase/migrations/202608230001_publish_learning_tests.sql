begin;

update public.tests
set
  mode = 'learn'::public.test_mode,
  visibility = 'public'::public.test_visibility,
  status = 'published'::public.test_status,
  published_at = coalesce(published_at, now()),
  archived_at = null,
  updated_at = now()
where upper(btrim(title)) = 'HOME ROW'
  and current_version_id is not null;

update public.test_versions as version
set
  mode = 'learn'::public.test_mode,
  visibility = 'public'::public.test_visibility,
  configuration = jsonb_set(
    jsonb_set(coalesce(version.configuration, '{}'::jsonb), '{mode}', '"learn"'::jsonb, true),
    '{visibility}',
    '"public"'::jsonb,
    true
  )
from public.tests as test
where version.id = test.current_version_id
  and upper(btrim(test.title)) = 'HOME ROW';

commit;

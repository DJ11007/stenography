select 'section_save_rpc', to_regprocedure('public.save_section_managed_test(uuid,jsonb,boolean,public.test_mode)') is not null as passed;
select 'test_1_deleted', count(*) = 0 as passed from public.tests where title = 'TEST 1';
select 'current_version_modes_match', count(*) = 0 as passed
from public.tests t join public.test_versions v on v.id = t.current_version_id
where t.mode is distinct from v.mode;
select 'published_learning_count', count(*) as value from public.tests
where mode = 'learn' and status = 'published' and visibility = 'public' and not is_live;

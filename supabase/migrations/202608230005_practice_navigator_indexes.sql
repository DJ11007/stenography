create index if not exists tests_practice_navigator
on public.tests(mode, status, visibility, is_live, language, input_system_id, published_at desc, id)
where mode='practice' and status='published' and visibility='public' and not is_live;
create index if not exists tests_practice_duration_navigator
on public.tests(mode, duration_seconds, published_at desc, id)
where mode='practice' and status='published' and visibility='public' and not is_live;

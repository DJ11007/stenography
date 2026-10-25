-- Live Word/Excel efficiency tests: each student's result unlocks a set number of minutes after THEIR
-- OWN submission (15 by default, for every efficiency test), instead of at one shared publication
-- time. results_delay_minutes null keeps the old shared results_publish_at behaviour.
-- The live window (start/end) and its constraint are unchanged.
begin;

alter table public.word_efficiency_tests add column if not exists results_delay_minutes integer default 15;
alter table public.excel_efficiency_tests add column if not exists results_delay_minutes integer default 15;
update public.word_efficiency_tests set results_delay_minutes=15 where results_delay_minutes is null;
update public.excel_efficiency_tests set results_delay_minutes=15 where results_delay_minutes is null;
alter table public.word_efficiency_tests drop constraint if exists word_efficiency_tests_results_delay_valid;
alter table public.word_efficiency_tests add constraint word_efficiency_tests_results_delay_valid check (results_delay_minutes is null or results_delay_minutes between 0 and 1440);
alter table public.excel_efficiency_tests drop constraint if exists excel_efficiency_tests_results_delay_valid;
alter table public.excel_efficiency_tests add constraint excel_efficiency_tests_results_delay_valid check (results_delay_minutes is null or results_delay_minutes between 0 and 1440);

-- The student's own result page.
do $mig$
declare fn text; old_text text :=
  'and(not attempt_record.is_live_attempt or test_record.results_publish_at is null or now()>=test_record.results_publish_at)';
new_text text :=
  'and(not attempt_record.is_live_attempt or case when test_record.results_delay_minutes is not null then now()>=attempt_record.submitted_at+make_interval(mins=>test_record.results_delay_minutes) else test_record.results_publish_at is null or now()>=test_record.results_publish_at end)';
begin
  foreach fn in array array['public.get_word_efficiency_attempt_result(uuid)','public.get_excel_efficiency_attempt_result(uuid)'] loop
    if position(new_text in pg_get_functiondef(fn::regprocedure))>0 then continue; end if;
    if position(old_text in pg_get_functiondef(fn::regprocedure))=0 then raise exception '% : expected result-visibility text not found', fn; end if;
    execute replace(pg_get_functiondef(fn::regprocedure), old_text, new_text);
  end loop;
end $mig$;

-- The result page also gets the time a live result unlocks, to tell the student while it is pending.
do $mig$
declare fn text; old_text text := '''submittedAt'',attempt_record.submitted_at,';
new_text text := '''submittedAt'',attempt_record.submitted_at,''resultsAt'',case when attempt_record.is_live_attempt then case when test_record.results_delay_minutes is not null then attempt_record.submitted_at+make_interval(mins=>test_record.results_delay_minutes) else test_record.results_publish_at end end,';
begin
  foreach fn in array array['public.get_word_efficiency_attempt_result(uuid)','public.get_excel_efficiency_attempt_result(uuid)'] loop
    if position('''resultsAt''' in pg_get_functiondef(fn::regprocedure))>0 then continue; end if;
    if position(old_text in pg_get_functiondef(fn::regprocedure))=0 then raise exception '% : expected submittedAt text not found', fn; end if;
    execute replace(pg_get_functiondef(fn::regprocedure), old_text, new_text);
  end loop;
end $mig$;

-- The public live-results leaderboard.
do $mig$
declare fn text; old_text text := 'and t.results_publish_at <= now()';
new_text text := 'and (case when t.results_delay_minutes is not null then a.submitted_at+make_interval(mins=>t.results_delay_minutes) else t.results_publish_at end) <= now()';
begin
  foreach fn in array array['public.published_word_efficiency_live_results(integer)','public.published_excel_efficiency_live_results(integer)'] loop
    if position(new_text in pg_get_functiondef(fn::regprocedure))>0 then continue; end if;
    if position(old_text in pg_get_functiondef(fn::regprocedure))=0 then raise exception '% : expected leaderboard text not found', fn; end if;
    execute replace(pg_get_functiondef(fn::regprocedure), old_text, new_text);
  end loop;
end $mig$;

-- The /live-test listing also returns the delay, so the card can say "Results 15 min after you submit".
drop function if exists public.published_live_efficiency_tests();
create function public.published_live_efficiency_tests()
returns table(id uuid, subject text, slug text, title text, language text, is_live boolean, live_starts_at timestamptz, live_ends_at timestamptz, results_publish_at timestamptz, duration_options integer[], results_delay_minutes integer)
language sql stable security definer set search_path to 'public' as $$
  select t.id, 'word'::text as subject, t.slug, t.title, t.language, t.is_live, t.live_starts_at, t.live_ends_at, t.results_publish_at, v.duration_options, t.results_delay_minutes
  from public.word_efficiency_tests t
  join public.word_efficiency_versions v on v.id = t.current_version_id
  where t.status = 'published' and t.is_live
  union all
  select t.id, 'excel'::text as subject, t.slug, t.title, t.language, t.is_live, t.live_starts_at, t.live_ends_at, t.results_publish_at, v.duration_options, t.results_delay_minutes
  from public.excel_efficiency_tests t
  join public.excel_efficiency_versions v on v.id = t.current_version_id
  where t.status = 'published' and t.is_live;
$$;
grant execute on function public.published_live_efficiency_tests() to anon, authenticated, service_role;

commit;

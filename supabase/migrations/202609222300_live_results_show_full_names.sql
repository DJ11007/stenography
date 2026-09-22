begin;

-- Real requested change from the site owner: the public live-test results
-- ticker (shown on both the homepage and /live-test) should show each
-- student's real full name instead of the "X•••" anonymized format. This
-- deliberately reverses the anonymization published_live_results has used
-- since its original creation -- an explicit request, not an oversight --
-- and makes it consistent with published_live_test_top_rankers, which
-- already shows real names for the top-3 podium.
--
-- Output column set is unchanged (student_name is still `text`), so a
-- plain create or replace is enough -- no need to drop first.
create or replace function public.published_live_results(p_limit integer default 30)
returns table(student_name text, test_title text, language text, net_wpm numeric, accuracy numeric, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce(nullif(p.full_name,''),'Student') as student_name,
    t.title as test_title,
    t.language as language,
    round(coalesce((a.result->>'netWpm')::numeric,0),2) as net_wpm,
    round(coalesce((a.result->>'accuracy')::numeric,0),2) as accuracy,
    a.submitted_at
  from public.test_attempts a
  join public.tests t on t.id=a.test_id
  left join public.profiles p on p.id=a.student_id
  where a.is_live_attempt and t.is_live and (
    (t.results_delay_minutes is null and t.results_publish_at <= now())
    or
    (t.results_delay_minutes is not null and a.submitted_at + (t.results_delay_minutes || ' minutes')::interval <= now())
  )
  order by a.submitted_at desc
  limit least(greatest(coalesce(p_limit,30),1),100);
$$;

grant execute on function public.published_live_results(integer) to anon,authenticated;

commit;

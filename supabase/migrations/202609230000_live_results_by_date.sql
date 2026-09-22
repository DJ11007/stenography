begin;

-- Real requested feature: students need a way to find PAST live-test
-- results by date -- published_live_results only ever returns the latest
-- 30 rows overall, so a result from a few days back scrolls off and
-- becomes unfindable once enough newer attempts pile up. Two new,
-- additive RPCs power a date browser on /live-test; the homepage ticker
-- and published_live_results itself are untouched.
--
-- Calendar days are bucketed in IST (Asia/Kolkata), matching every other
-- date-facing part of this app (see lib/format-datetime.ts's own comment
-- on why -- the server process's own timezone is not reliable).

-- Which calendar days actually have a published live-test result, most
-- recent first -- powers the date-picker's own option list so it never
-- offers a date with nothing to show.
create or replace function public.published_live_result_dates(p_limit integer default 90)
returns table(result_date date)
language sql stable security definer set search_path = public as $$
  select distinct (a.submitted_at at time zone 'Asia/Kolkata')::date as result_date
  from public.test_attempts a
  join public.tests t on t.id = a.test_id
  where a.is_live_attempt and t.is_live and (
    (t.results_delay_minutes is null and t.results_publish_at <= now())
    or
    (t.results_delay_minutes is not null and a.submitted_at + (t.results_delay_minutes || ' minutes')::interval <= now())
  )
  order by result_date desc
  limit least(greatest(coalesce(p_limit,90),1),365);
$$;

-- Every published result for one IST calendar day (not capped to 30 like
-- published_live_results, since a single day's results are a bounded,
-- deliberately-chosen slice rather than an ever-growing "latest" feed).
create or replace function public.published_live_results_by_date(p_date date, p_limit integer default 200)
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
  join public.tests t on t.id = a.test_id
  left join public.profiles p on p.id = a.student_id
  where a.is_live_attempt and t.is_live
    and (a.submitted_at at time zone 'Asia/Kolkata')::date = p_date
    and (
      (t.results_delay_minutes is null and t.results_publish_at <= now())
      or
      (t.results_delay_minutes is not null and a.submitted_at + (t.results_delay_minutes || ' minutes')::interval <= now())
    )
  order by a.submitted_at desc
  limit least(greatest(coalesce(p_limit,200),1),500);
$$;

grant execute on function public.published_live_result_dates(integer) to anon,authenticated;
grant execute on function public.published_live_results_by_date(date,integer) to anon,authenticated;

commit;

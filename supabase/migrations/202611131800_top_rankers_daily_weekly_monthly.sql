begin;

-- Real requested feature: the homepage Top Rankers podium only ever showed
-- one all-time "best WPM ever" ranking per student. speedosoftware.com (a
-- competitor) lets students switch between daily / weekly / monthly
-- leaderboards, so p_period narrows the eligible attempts to an IST
-- calendar window ending today -- using the exact same IST-day bucketing
-- as published_live_result_dates/_by_date (202609230000). 'all' reproduces
-- today's exact existing behavior and stays the default, so any other
-- caller that still passes just (p_language, p_limit) is unaffected.
-- Postgres won't let `create or replace function` add a parameter in the
-- middle of an existing signature while keeping it one overload, so the
-- old 2-arg function is dropped first (matching this file's own earlier
-- precedent in 202609222100 for published_live_results).
drop function if exists public.published_live_test_top_rankers(text, integer);

create function public.published_live_test_top_rankers(p_language text, p_limit integer default 3, p_period text default 'all')
returns table(student_id uuid, student_name text, net_wpm numeric)
language sql stable security definer set search_path = public as $$
  with eligible as (
    select a.student_id, coalesce((a.result->>'netWpm')::numeric,0) as net_wpm
    from public.test_attempts a
    join public.tests t on t.id=a.test_id
    where a.is_live_attempt and t.is_live and t.language = p_language and (
      (t.results_delay_minutes is null and t.results_publish_at <= now())
      or
      (t.results_delay_minutes is not null and a.submitted_at + (t.results_delay_minutes || ' minutes')::interval <= now())
    )
    and (
      p_period = 'all'
      or (p_period = 'day' and (a.submitted_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
      or (p_period = 'week' and (a.submitted_at at time zone 'Asia/Kolkata')::date > (now() at time zone 'Asia/Kolkata')::date - 7)
      or (p_period = 'month' and (a.submitted_at at time zone 'Asia/Kolkata')::date > (now() at time zone 'Asia/Kolkata')::date - 30)
    )
  ),
  best_per_student as (
    select student_id, max(net_wpm) as net_wpm from eligible group by student_id
  )
  select b.student_id, coalesce(nullif(p.full_name,''),'Student') as student_name, round(b.net_wpm,2) as net_wpm
  from best_per_student b
  join public.profiles p on p.id = b.student_id
  order by b.net_wpm desc, b.student_id
  limit least(greatest(coalesce(p_limit,3),1),20);
$$;

grant execute on function public.published_live_test_top_rankers(text,integer,text) to anon,authenticated;

commit;

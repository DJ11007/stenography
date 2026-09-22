begin;

-- Two related, requested changes to the public live-test results surface:
-- 1) published_live_results gains a `language` column so the homepage and
--    /live-test ticker can be split into "English" / "Hindi" groups
--    instead of one mixed feed. student_name stays anonymized exactly as
--    today -- nothing about the existing privacy behavior changes.
-- 2) A NEW published_live_test_top_rankers RPC powers a homepage "Top
--    Rankers" podium: per student, their SINGLE BEST net_wpm across their
--    own published live-test attempts in one language, ranked top-3. This
--    is a narrow, explicit, user-approved exception that exposes the REAL
--    name -- scoped to just the top few ranks in this one new RPC, never
--    touching published_live_results's anonymization.
--
-- Postgres won't let `create or replace function` change a table
-- function's output column set, so the existing function is dropped first.
drop function if exists public.published_live_results(integer);

create function public.published_live_results(p_limit integer default 30)
returns table(student_name text, test_title text, language text, net_wpm numeric, accuracy numeric, submitted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    left(coalesce(nullif(p.full_name,''),'Student'),1) || '•••' as student_name,
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

-- Per student, their single BEST net_wpm across their own published
-- live-test attempts in p_language, then top p_limit students by that
-- best score. Real name exposed here deliberately (approved exception,
-- top ranks only) -- published_live_results above is unaffected/still
-- anonymized.
create or replace function public.published_live_test_top_rankers(p_language text, p_limit integer default 3)
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

grant execute on function public.published_live_results(integer) to anon,authenticated;
grant execute on function public.published_live_test_top_rankers(text,integer) to anon,authenticated;

commit;

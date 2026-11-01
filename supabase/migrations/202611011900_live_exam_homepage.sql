-- Live Exam on the home page: the upcoming and running live exams (with a Join button), and the latest live exam's
-- top rankers. Both are read-only and open to visitors who are not signed in, like published_live_test_top_rankers.
-- Ranks appear only after the exam's results are open (results_at passed, or the exam over when it has none), so no
-- marks are shown early. Names are the students' profile names, as in the existing Top Rankers. Safe to run twice.
begin;

-- Published exams that have not ended yet, soonest first.
create or replace function public.public_live_exams_upcoming(p_limit integer default 5)
returns table(id uuid, title text, starts_at timestamptz, ends_at timestamptz, parts integer, part_names text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select e.id, e.title, e.starts_at, t.ends_at, t.parts, t.part_names
  from public.live_exams e
  cross join lateral (
    select max(tl.ends_at) as ends_at, count(*)::integer as parts, string_agg(s.label, ' · ' order by s.seq) as part_names
    from public.live_exam_timeline(e.id) tl join public.live_exam_sections s on s.id = tl.section_id
  ) t
  where e.status = 'published' and t.ends_at > now()
  order by e.starts_at
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$$;
revoke all on function public.public_live_exams_upcoming(integer) from public;
grant execute on function public.public_live_exams_upcoming(integer) to anon, authenticated;

-- The latest live exam whose results are open: its top students by total marks.
create or replace function public.public_live_exam_top_rankers(p_limit integer default 10)
returns table(exam_id uuid, exam_title text, exam_date timestamptz, max_total numeric, rank integer, student_name text, total numeric)
language sql stable security definer set search_path = pg_catalog, public as $$
  with finished as (
    select e.id, e.title, e.starts_at, (select max(tl.ends_at) from public.live_exam_timeline(e.id) tl) as ends_at, e.results_at
    from public.live_exams e
    where e.status = 'published'
  ),
  latest as (
    select f.id, f.title, f.starts_at
    from finished f
    where coalesce(f.results_at, f.ends_at) <= now()
      and exists (select 1 from public.live_exam_section_attempts a where a.exam_id = f.id)
    order by f.ends_at desc
    limit 1
  ),
  totals as (
    select a.student_id, sum(coalesce(a.marks, 0)) as total
    from public.live_exam_section_attempts a join latest l on l.id = a.exam_id
    group by a.student_id
  )
  select l.id, l.title, l.starts_at, (select sum(s.max_marks) from public.live_exam_sections s where s.exam_id = l.id),
    (rank() over (order by t.total desc))::integer, coalesce(nullif(btrim(p.full_name), ''), 'Student'), round(t.total, 2)
  from totals t cross join latest l join public.profiles p on p.id = t.student_id
  order by t.total desc, p.full_name
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
revoke all on function public.public_live_exam_top_rankers(integer) from public;
grant execute on function public.public_live_exam_top_rankers(integer) to anon, authenticated;

commit;

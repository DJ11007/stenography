-- Live Exam: every student's result on a public page (/live-exam-results, linked by "View all results" under the home
-- page's top rankers). Read-only, open to visitors who are not signed in, like public_live_exam_top_rankers: only exams
-- whose results are open (results_at passed, or the exam over when it has none), students' profile names, no ids.
-- Safe to run twice.
begin;

-- Exams with open results that have at least one result, newest first (for the page's exam picker).
create or replace function public.public_live_exams_with_results()
returns table(id uuid, title text, exam_date timestamptz)
language sql stable security definer set search_path = pg_catalog, public as $$
  select e.id, e.title, e.starts_at
  from public.live_exams e
  cross join lateral (select max(tl.ends_at) as ends_at from public.live_exam_timeline(e.id) tl) t
  where e.status = 'published' and coalesce(e.results_at, t.ends_at) <= now()
    and exists (select 1 from public.live_exam_section_attempts a where a.exam_id = e.id)
  order by t.ends_at desc
  limit 50;
$$;
revoke all on function public.public_live_exams_with_results() from public;
grant execute on function public.public_live_exams_with_results() to anon, authenticated;

-- One exam's full result sheet (the latest open one when no exam is given): each student's marks in every part and the
-- total, best first. A part a student has no result for comes back as null.
create or replace function public.public_live_exam_results(p_exam_id uuid default null)
returns table(exam_id uuid, exam_title text, exam_date timestamptz, sections jsonb, rank integer, student_name text, section_marks jsonb, total numeric, max_total numeric)
language sql stable security definer set search_path = pg_catalog, public as $$
  with chosen as (
    select x.id, x.title, x.exam_date from public.public_live_exams_with_results() x
    where p_exam_id is null or x.id = p_exam_id
    limit 1
  ),
  parts as (
    select jsonb_agg(jsonb_build_object('position', s.seq, 'label', s.label, 'maxMarks', s.max_marks) order by s.seq) as sections, sum(s.max_marks) as max_total
    from public.live_exam_sections s join chosen c on c.id = s.exam_id
  ),
  students as (
    select a.student_id,
      jsonb_agg(jsonb_build_object('position', s.seq, 'marks', a.marks) order by s.seq) as section_marks,
      sum(coalesce(a.marks, 0)) as total
    from public.live_exam_section_attempts a join chosen c on c.id = a.exam_id join public.live_exam_sections s on s.id = a.section_id
    group by a.student_id
  )
  select c.id, c.title, c.exam_date, p.sections, (rank() over (order by st.total desc))::integer,
    coalesce(nullif(btrim(pr.full_name), ''), 'Student'), st.section_marks, round(st.total, 2), p.max_total
  from students st cross join chosen c cross join parts p join public.profiles pr on pr.id = st.student_id
  order by st.total desc, pr.full_name;
$$;
revoke all on function public.public_live_exam_results(uuid) from public;
grant execute on function public.public_live_exam_results(uuid) to anon, authenticated;

commit;

-- Live Exam: every student's result on a public page (/live-exam-results, linked by "View all results" under the home
-- page's top rankers), combined by TEST across batches: "RSMSSB LDC Exam-1" and "RSMSSB LDC Exam-1 (5 pm batch)" are
-- one test (same name once a bracketed batch label is removed), so all their students are ranked together. The home
-- page's top rankers use the same grouping. Read-only, open to visitors who are not signed in: only exams whose results
-- are open (results_at passed, or the exam over when it has none), students' profile names, no ids. Safe to run twice.
begin;

-- The test an exam belongs to: its title without a trailing "(... batch ...)".
create or replace function public.live_exam_result_group(p_title text)
returns text language sql immutable set search_path = pg_catalog as $$
  select btrim(regexp_replace(coalesce(p_title, ''), '\s*\([^()]*batch[^()]*\)\s*$', '', 'i'));
$$;

-- Exams whose results are open and have at least one result.
create or replace function public.live_exams_open_results()
returns table(id uuid, title text, test_title text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public as $$
  select e.id, e.title, public.live_exam_result_group(e.title), e.starts_at, t.ends_at
  from public.live_exams e
  cross join lateral (select max(tl.ends_at) as ends_at from public.live_exam_timeline(e.id) tl) t
  where e.status = 'published' and coalesce(e.results_at, t.ends_at) <= now()
    and exists (select 1 from public.live_exam_section_attempts a where a.exam_id = e.id);
$$;
revoke all on function public.live_exams_open_results() from public, anon, authenticated;

-- The tests with open results, newest first (for the page's test picker), with their first date and number of batches.
drop function if exists public.public_live_exams_with_results();
create or replace function public.public_live_exams_with_results()
returns table(test_title text, exam_date timestamptz, batches integer)
language sql stable security definer set search_path = pg_catalog, public as $$
  select o.test_title, min(o.starts_at), count(*)::integer
  from public.live_exams_open_results() o
  group by o.test_title
  order by max(o.ends_at) desc
  limit 50;
$$;
revoke all on function public.public_live_exams_with_results() from public;
grant execute on function public.public_live_exams_with_results() to anon, authenticated;

-- One test's full result sheet across its batches (the latest test when none is given): each student's marks in every
-- part, the total and the batch sat, best first. Parts are matched by their order; a missing part comes back as null.
drop function if exists public.public_live_exam_results(uuid);
drop function if exists public.public_live_exam_results(text);
create or replace function public.public_live_exam_results(p_test text default null)
returns table(test_title text, exam_date timestamptz, sections jsonb, rank integer, student_name text, batch text, section_marks jsonb, total numeric, max_total numeric)
language sql stable security definer set search_path = pg_catalog, public as $$
  with chosen as (
    select x.test_title from public.public_live_exams_with_results() x
    where p_test is null or x.test_title = p_test
    limit 1
  ),
  exams as (
    select o.* from public.live_exams_open_results() o join chosen c on c.test_title = o.test_title
  ),
  first_exam as (select e.id from exams e order by e.starts_at limit 1),
  parts as (
    select jsonb_agg(jsonb_build_object('position', s.seq, 'label', s.label, 'maxMarks', s.max_marks) order by s.seq) as sections, sum(s.max_marks) as max_total
    from public.live_exam_sections s join first_exam f on f.id = s.exam_id
  ),
  per_exam as (
    select a.student_id, e.title as batch,
      jsonb_agg(jsonb_build_object('position', s.seq, 'marks', a.marks) order by s.seq) as section_marks,
      sum(coalesce(a.marks, 0)) as total
    from public.live_exam_section_attempts a join exams e on e.id = a.exam_id join public.live_exam_sections s on s.id = a.section_id
    group by a.student_id, e.id, e.title
  ),
  best as (
    -- A student who sat the same test in two batches is listed once, with the better total.
    select distinct on (p.student_id) p.* from per_exam p order by p.student_id, p.total desc
  )
  select c.test_title, (select min(e.starts_at) from exams e), pa.sections, (rank() over (order by b.total desc))::integer,
    coalesce(nullif(btrim(pr.full_name), ''), 'Student'), b.batch, b.section_marks, round(b.total, 2), pa.max_total
  from best b cross join chosen c cross join parts pa join public.profiles pr on pr.id = b.student_id
  order by b.total desc, pr.full_name;
$$;
revoke all on function public.public_live_exam_results(text) from public;
grant execute on function public.public_live_exam_results(text) to anon, authenticated;

-- The home page's top rankers: the latest test, all its batches together (same columns as before).
create or replace function public.public_live_exam_top_rankers(p_limit integer default 10)
returns table(exam_id uuid, exam_title text, exam_date timestamptz, max_total numeric, rank integer, student_name text, total numeric)
language sql stable security definer set search_path = pg_catalog, public as $$
  select null::uuid, r.test_title, r.exam_date, r.max_total, r.rank, r.student_name, r.total
  from public.public_live_exam_results(null) r
  order by r.rank, r.student_name
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
revoke all on function public.public_live_exam_top_rankers(integer) from public;
grant execute on function public.public_live_exam_top_rankers(integer) to anon, authenticated;

commit;

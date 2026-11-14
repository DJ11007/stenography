-- Two fixes to live_exam_state(), found by testing the per-student window feature
-- (202611141500_live_exam_per_student_window.sql) against the real live exam right after deploy:
--
-- 1. Real bug, confirmed via the live app: live_exam_state was declared STABLE, but now contains an
--    INSERT (seeding a student's own start anchor on first touch) -- Postgres rejects a data-modifying
--    statement inside a STABLE function at runtime ("INSERT is not allowed in a non-volatile function"),
--    which surfaced to students as the exam page 404ing. Fixed by dropping the STABLE marker (volatile
--    is Postgres's default, correct now that this function has a side effect).
-- 2. An admin merely opening an available_until-bearing exam's page to check on it was silently seeding
--    their own personal start anchor -- "using up" their own attempt the same as a real student would.
--    Admins now never get an anchor seeded for themselves.
-- Safe to run twice.

create or replace function public.live_exam_state(p_exam_id uuid)
 returns jsonb
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  exam public.live_exams%rowtype;
  anchor timestamptz;
  sections jsonb;
  cur jsonb;
  phase text := 'finished';
  t record;
  clock timestamptz := now();
  total_sections integer;
  done_sections integer;
  completed_at timestamptz;
  results_available_at timestamptz;
  first_starts_at timestamptz;
begin
  select * into exam from public.live_exams where id = p_exam_id;
  if not found then raise exception 'live exam unavailable'; end if;

  if exam.available_until is not null and auth.uid() is not null and not public.is_aal2_admin() then
    select started_at into anchor from public.live_exam_student_starts where exam_id = p_exam_id and student_id = auth.uid();
    if anchor is null and clock between exam.starts_at and exam.available_until then
      insert into public.live_exam_student_starts(exam_id, student_id, started_at) values (p_exam_id, auth.uid(), clock)
      on conflict (exam_id, student_id) do nothing;
      select started_at into anchor from public.live_exam_student_starts where exam_id = p_exam_id and student_id = auth.uid();
    end if;
  end if;

  select count(*), count(*) filter (where a.id is not null), max(a.submitted_at)
    into total_sections, done_sections, completed_at
  from public.live_exam_sections s
  left join public.live_exam_section_attempts a on a.section_id = s.id and a.student_id = auth.uid()
  where s.exam_id = p_exam_id;

  if total_sections > 0 and done_sections = total_sections then
    results_available_at := completed_at + make_interval(mins => exam.results_delay_minutes);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', tl.section_id, 'position', tl.seq, 'kind', tl.kind, 'language', tl.language, 'label', tl.label,
           'testId', tl.test_id, 'durationSeconds', tl.duration_seconds, 'gapAfterSeconds', tl.gap_after_seconds, 'maxMarks', tl.max_marks,
           'startsAt', tl.starts_at, 'endsAt', tl.ends_at, 'gapEndsAt', tl.gap_ends_at,
           'submitted', exists (select 1 from public.live_exam_section_attempts a where a.section_id = tl.section_id and a.student_id = auth.uid()))
         order by tl.seq), '[]'::jsonb)
    into sections
  from public.live_exam_timeline_for_student(p_exam_id, auth.uid()) tl;

  select min(tl.starts_at) into first_starts_at from public.live_exam_timeline_for_student(p_exam_id, auth.uid()) tl;

  if exam.available_until is not null and anchor is null then
    phase := case when clock < exam.starts_at then 'waiting' when clock > exam.available_until then 'expired' else 'waiting' end;
  elsif clock < first_starts_at then
    phase := 'waiting';
  else
    for t in select * from public.live_exam_timeline_for_student(p_exam_id, auth.uid()) loop
      if clock >= t.starts_at and clock < t.ends_at then phase := 'section'; cur := jsonb_build_object('sectionId', t.section_id, 'position', t.seq, 'endsAt', t.ends_at); exit; end if;
      if clock >= t.ends_at and clock < t.gap_ends_at then phase := 'gap'; cur := jsonb_build_object('sectionId', t.section_id, 'position', t.seq, 'endsAt', t.gap_ends_at); exit; end if;
    end loop;
  end if;

  return jsonb_build_object(
    'id', exam.id, 'title', exam.title, 'pattern', exam.pattern, 'status', exam.status, 'instructions', exam.instructions,
    'startsAt', exam.starts_at, 'resultsAt', exam.results_at, 'availableUntil', exam.available_until,
    'resultsDelayMinutes', exam.results_delay_minutes, 'serverNow', clock, 'phase', phase, 'current', cur, 'sections', sections,
    'alreadyCompleted', total_sections > 0 and done_sections = total_sections,
    'resultsAvailableAt', results_available_at,
    'resultsReady', results_available_at is not null and clock >= results_available_at
  );
end
$function$;

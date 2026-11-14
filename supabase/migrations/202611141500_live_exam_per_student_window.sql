-- Live Exam Center: per-student start anchor, admin-set availability window, per-student results delay.
--
-- Problem: the whole exam ran on ONE shared clock (live_exams.starts_at) for every student -- once the
-- pattern's ~49 minutes passed from that single timestamp, the exam was "over" for everyone, including
-- students who never got a chance to start (e.g. a later batch arriving hours later the same day).
--
-- Fix, purely additive and backward compatible:
--   - live_exams gains available_until (nullable -- null means "legacy mode", byte-for-byte unchanged
--     behavior for every existing exam) and results_delay_minutes (default 5).
--   - live_exam_student_starts: one row per (exam, student), the moment THAT student first touches an
--     available_until-bearing exam within its window. This is their own personal anchor.
--   - live_exam_timeline_for_student(exam, student): same shape as the original live_exam_timeline, but
--     anchored to that student's own started_at, falling back to exam.starts_at when they have no row
--     (which is always true for legacy exams, and for any exam before a student's first touch) -- so it
--     transparently reproduces the old single-clock behavior whenever there's nothing new to anchor to.
--     The ORIGINAL live_exam_timeline(uuid) is left completely untouched, so every existing caller
--     (live_exams_open_results, public_live_exams_upcoming, public_live_exam_results, admin reporting)
--     keeps working exactly as before with zero risk.
--   - live_exam_state and record_live_exam_section are rewritten (same signatures) to use the per-student
--     timeline for a signed-in student's own admission/section-window checks, and live_exam_state now also
--     seeds a student's anchor on first touch, computes whether they've completed every section, and when
--     their own results become visible (their own last submission + results_delay_minutes).
--   - save_live_exam accepts the two new payload fields.
-- Safe to run twice.
begin;

alter table public.live_exams
  add column if not exists available_until timestamptz,
  add column if not exists results_delay_minutes integer not null default 5 check (results_delay_minutes between 1 and 1440);

create table if not exists public.live_exam_student_starts (
  exam_id uuid not null references public.live_exams(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (exam_id, student_id)
);

alter table public.live_exam_student_starts enable row level security;
drop policy if exists "Admins read live exam student starts" on public.live_exam_student_starts;
create policy "Admins read live exam student starts" on public.live_exam_student_starts for select using (public.is_aal2_admin());
drop policy if exists "Students read own live exam start" on public.live_exam_student_starts;
create policy "Students read own live exam start" on public.live_exam_student_starts for select using (student_id = auth.uid());
drop policy if exists "Students start their own live exam" on public.live_exam_student_starts;
create policy "Students start their own live exam" on public.live_exam_student_starts for insert with check (student_id = auth.uid());
-- Deliberately no update/delete grant: once set, a student's own anchor is immutable (matches "one
-- attempt, their own clock, no do-overs"), and only the INSERT policy above lets a student write it --
-- always for themselves, via live_exam_state() below (SECURITY INVOKER, so this policy is what gates it).
grant select, insert on public.live_exam_student_starts to authenticated;

-- live_exam_timeline_for_student(exam, student): per-student-anchored version of live_exam_timeline.
-- Falls back to exam.starts_at (the original shared-clock anchor) whenever the student has no row yet --
-- which legacy exams (available_until is null) never populate, so this is always exactly the old
-- behavior for them, and for any exam before a student's personal anchor is seeded.
create or replace function public.live_exam_timeline_for_student(p_exam_id uuid, p_student_id uuid default auth.uid())
returns table(section_id uuid, seq integer, kind text, language text, label text, test_id uuid, duration_seconds integer, gap_after_seconds integer, max_marks numeric, starts_at timestamptz, ends_at timestamptz, gap_ends_at timestamptz)
language sql stable set search_path to 'pg_catalog', 'public'
as $function$
  select s.id, s.seq, s.kind, s.language, s.label, s.test_id, s.duration_seconds, s.gap_after_seconds, s.max_marks,
    anchor.started_at + make_interval(secs => coalesce(sum(s.duration_seconds + s.gap_after_seconds) over w, 0)),
    anchor.started_at + make_interval(secs => coalesce(sum(s.duration_seconds + s.gap_after_seconds) over w, 0) + s.duration_seconds),
    anchor.started_at + make_interval(secs => coalesce(sum(s.duration_seconds + s.gap_after_seconds) over w, 0) + s.duration_seconds + s.gap_after_seconds)
  from public.live_exam_sections s
  join public.live_exams e on e.id = s.exam_id
  cross join lateral (
    select coalesce(
      (select st.started_at from public.live_exam_student_starts st where st.exam_id = e.id and st.student_id = p_student_id),
      e.starts_at
    ) as started_at
  ) anchor
  where s.exam_id = p_exam_id
  window w as (order by s.seq rows between unbounded preceding and 1 preceding)
  order by s.seq;
$function$;
grant execute on function public.live_exam_timeline_for_student(uuid, uuid) to authenticated;

create or replace function public.live_exam_state(p_exam_id uuid)
 returns jsonb
 language plpgsql
 stable
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

  if exam.available_until is not null and auth.uid() is not null then
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

create or replace function public.record_live_exam_section(p_section_id uuid, p_attempt_id uuid)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare s record; exam public.live_exams%rowtype; got numeric; owner uuid; started timestamptz; last_end timestamptz; clock timestamptz := now();
begin
  if auth.uid() is null or not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
  select tl.*, ls.exam_id into s from public.live_exam_sections ls cross join lateral public.live_exam_timeline_for_student(ls.exam_id, auth.uid()) tl where ls.id = p_section_id and tl.section_id = ls.id;
  if not found then raise exception 'live exam section unavailable'; end if;
  select * into exam from public.live_exams where id = s.exam_id;
  if exam.status <> 'published' then raise exception 'live exam unavailable'; end if;
  if s.kind = 'typing' then
    select a.student_id, a.started_at, nullif(a.result->>'marksObtained', '')::numeric into owner, started, got from public.test_attempts a where a.id = p_attempt_id and a.test_id = s.test_id;
  elsif s.kind = 'word' then
    select a.student_id, a.started_at, nullif(a.result->>'marks', '')::numeric into owner, started, got from public.word_efficiency_attempts a where a.id = p_attempt_id and a.test_id = s.test_id;
  else
    select a.student_id, a.started_at, nullif(a.result->>'marks', '')::numeric into owner, started, got from public.excel_efficiency_attempts a where a.id = p_attempt_id and a.test_id = s.test_id;
  end if;
  if owner is distinct from auth.uid() then raise exception 'attempt does not belong to this section'; end if;
  select max(t.ends_at) into last_end from public.live_exam_timeline_for_student(s.exam_id, auth.uid()) t;
  if clock < s.starts_at then raise exception 'this section is not open now'; end if;
  if clock > s.ends_at + interval '2 minutes'
     and not (clock <= last_end + interval '15 minutes' and started between s.starts_at - interval '1 minute' and s.ends_at) then
    raise exception 'this section is not open now';
  end if;
  insert into public.live_exam_section_attempts(exam_id, section_id, student_id, attempt_id, marks)
  values (s.exam_id, p_section_id, auth.uid(), p_attempt_id, least(got, s.max_marks))
  on conflict (section_id, student_id) do nothing;
  if not found then raise exception 'this section was already submitted'; end if;
  return least(got, s.max_marks);
end
$function$;

create or replace function public.save_live_exam(p_exam_id uuid, p_payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare v_exam uuid := p_exam_id; item jsonb; pos integer := 0; started boolean;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if jsonb_typeof(p_payload->'sections') <> 'array' or jsonb_array_length(p_payload->'sections') not between 1 and 20 then raise exception 'an exam needs 1 to 20 sections'; end if;
  if v_exam is null then
    insert into public.live_exams(title, pattern, starts_at, results_at, available_until, results_delay_minutes, status, instructions)
    values (p_payload->>'title', coalesce(nullif(p_payload->>'pattern', ''), 'custom'), (p_payload->>'startsAt')::timestamptz, nullif(p_payload->>'resultsAt', '')::timestamptz,
            nullif(p_payload->>'availableUntil', '')::timestamptz, coalesce(nullif(p_payload->>'resultsDelayMinutes', '')::integer, 5),
            coalesce(nullif(p_payload->>'status', ''), 'draft'), nullif(p_payload->>'instructions', ''))
    returning id into v_exam;
  else
    select status = 'published' and starts_at <= now() into started from public.live_exams where id = v_exam;
    if started is null then raise exception 'live exam unavailable'; end if;
    if started then raise exception 'this exam has already started; its sections cannot change'; end if;
    update public.live_exams set title = p_payload->>'title', pattern = coalesce(nullif(p_payload->>'pattern', ''), 'custom'), starts_at = (p_payload->>'startsAt')::timestamptz,
      results_at = nullif(p_payload->>'resultsAt', '')::timestamptz, available_until = nullif(p_payload->>'availableUntil', '')::timestamptz,
      results_delay_minutes = coalesce(nullif(p_payload->>'resultsDelayMinutes', '')::integer, results_delay_minutes),
      status = coalesce(nullif(p_payload->>'status', ''), status), instructions = nullif(p_payload->>'instructions', ''), updated_at = now()
    where id = v_exam;
    delete from public.live_exam_sections s where s.exam_id = v_exam;
  end if;
  for item in select value from jsonb_array_elements(p_payload->'sections') loop
    pos := pos + 1;
    if item->>'kind' = 'typing' and not exists (select 1 from public.tests where id = (item->>'testId')::uuid) then raise exception 'section %: typing test not found', pos; end if;
    if item->>'kind' = 'word' and not exists (select 1 from public.word_efficiency_tests where id = (item->>'testId')::uuid) then raise exception 'section %: Word test not found', pos; end if;
    if item->>'kind' = 'excel' and not exists (select 1 from public.excel_efficiency_tests where id = (item->>'testId')::uuid) then raise exception 'section %: Excel test not found', pos; end if;
    insert into public.live_exam_sections(exam_id, seq, kind, language, label, test_id, duration_seconds, gap_after_seconds, max_marks)
    values (v_exam, pos, item->>'kind', item->>'language', item->>'label', (item->>'testId')::uuid, (item->>'durationSeconds')::integer,
            coalesce((item->>'gapAfterSeconds')::integer, 0), coalesce((item->>'maxMarks')::numeric, 25));
  end loop;
  return v_exam;
end
$function$;

commit;

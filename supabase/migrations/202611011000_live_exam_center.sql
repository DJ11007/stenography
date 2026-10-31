-- Live Exam Center, step 1 (docs/live-exam-center-plan.md): a live exam is a timed sequence of sections built from
-- tests that already exist (typing in `tests`, Word in `word_efficiency_tests`, Excel in `excel_efficiency_tests`),
-- run on one server clock from `starts_at` for every student, with a gap after each section. Each section a student
-- takes is the normal attempt of that test (its own marking); this only links them and reads their marks.
--
--   live_exams                  title, pattern (e.g. 'rsmssb-ldc'), starts_at, results_at, status draft/published
--   live_exam_sections          position, kind typing/word/excel (stenography later), language, test, duration,
--                               gap after, max marks
--   live_exam_section_attempts  one row per student per section: the underlying attempt and its marks
--
--   live_exam_timeline(exam)          every section's start / end and every gap, from starts_at
--   live_exam_state(exam)             the server time, the phase now (waiting / section / gap / finished) and what
--                                     this student has already submitted
--   record_live_exam_section(...)     links a submitted attempt to its section (once, inside the section's time)
--   save_live_exam(...)               admin: create / update an exam and its sections (not after it started)
--   admin_live_exam_results(exam)     admin: one row per student with each section's marks and the total
-- Safe to run twice.
begin;

create table if not exists public.live_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  pattern text not null default 'custom' check (pattern ~ '^[a-z0-9-]{1,40}$'),
  starts_at timestamptz not null,
  results_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  instructions text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.live_exams(id) on delete cascade,
  seq integer not null check (seq between 1 and 20),
  kind text not null check (kind in ('typing', 'word', 'excel')),
  language text not null check (language in ('English', 'Hindi')),
  label text not null check (length(btrim(label)) between 1 and 80),
  test_id uuid not null,
  duration_seconds integer not null check (duration_seconds between 60 and 14400),
  gap_after_seconds integer not null default 0 check (gap_after_seconds between 0 and 3600),
  max_marks numeric(6,2) not null default 25 check (max_marks > 0 and max_marks <= 1000),
  unique (exam_id, seq)
);

create table if not exists public.live_exam_section_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.live_exams(id) on delete cascade,
  section_id uuid not null references public.live_exam_sections(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  attempt_id uuid not null,
  marks numeric(8,2),
  submitted_at timestamptz not null default now(),
  unique (section_id, student_id)
);
create index if not exists live_exam_section_attempts_exam_idx on public.live_exam_section_attempts (exam_id, student_id);

alter table public.live_exams enable row level security;
alter table public.live_exam_sections enable row level security;
alter table public.live_exam_section_attempts enable row level security;

drop policy if exists "Admins manage live exams" on public.live_exams;
create policy "Admins manage live exams" on public.live_exams for all using (public.is_aal2_admin()) with check (public.is_aal2_admin());
drop policy if exists "Students read published live exams" on public.live_exams;
create policy "Students read published live exams" on public.live_exams for select using (status = 'published');
drop policy if exists "Admins manage live exam sections" on public.live_exam_sections;
create policy "Admins manage live exam sections" on public.live_exam_sections for all using (public.is_aal2_admin()) with check (public.is_aal2_admin());
drop policy if exists "Students read published live exam sections" on public.live_exam_sections;
create policy "Students read published live exam sections" on public.live_exam_sections for select
  using (exists (select 1 from public.live_exams e where e.id = exam_id and e.status = 'published'));
drop policy if exists "Admins read live exam attempts" on public.live_exam_section_attempts;
create policy "Admins read live exam attempts" on public.live_exam_section_attempts for select using (public.is_aal2_admin());
drop policy if exists "Students read own live exam attempts" on public.live_exam_section_attempts;
create policy "Students read own live exam attempts" on public.live_exam_section_attempts for select using (student_id = auth.uid());
-- Students never write these rows directly: record_live_exam_section checks the time and the attempt first.

grant select on public.live_exams, public.live_exam_sections, public.live_exam_section_attempts to authenticated;
grant insert, update, delete on public.live_exams, public.live_exam_sections to authenticated;

-- Every section's start and end (and its gap) from the exam's start time.
create or replace function public.live_exam_timeline(p_exam_id uuid)
returns table(section_id uuid, seq integer, kind text, language text, label text, test_id uuid, duration_seconds integer,
              gap_after_seconds integer, max_marks numeric, starts_at timestamptz, ends_at timestamptz, gap_ends_at timestamptz)
language sql stable security invoker set search_path = pg_catalog, public as $$
  select s.id, s.seq, s.kind, s.language, s.label, s.test_id, s.duration_seconds, s.gap_after_seconds, s.max_marks,
    e.starts_at + make_interval(secs => coalesce(sum(s.duration_seconds + s.gap_after_seconds) over w, 0)),
    e.starts_at + make_interval(secs => coalesce(sum(s.duration_seconds + s.gap_after_seconds) over w, 0) + s.duration_seconds),
    e.starts_at + make_interval(secs => coalesce(sum(s.duration_seconds + s.gap_after_seconds) over w, 0) + s.duration_seconds + s.gap_after_seconds)
  from public.live_exam_sections s join public.live_exams e on e.id = s.exam_id
  where s.exam_id = p_exam_id
  window w as (order by s.seq rows between unbounded preceding and 1 preceding)
  order by s.seq;
$$;
grant execute on function public.live_exam_timeline(uuid) to authenticated;

-- What a student's exam page shows now: the server clock decides, never the PC's clock.
create or replace function public.live_exam_state(p_exam_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare exam public.live_exams%rowtype; sections jsonb; cur jsonb; phase text := 'finished'; t record; clock timestamptz := now();
begin
  select * into exam from public.live_exams where id = p_exam_id;
  if not found then raise exception 'live exam unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', tl.section_id, 'position', tl.seq, 'kind', tl.kind, 'language', tl.language, 'label', tl.label,
           'testId', tl.test_id, 'durationSeconds', tl.duration_seconds, 'gapAfterSeconds', tl.gap_after_seconds, 'maxMarks', tl.max_marks,
           'startsAt', tl.starts_at, 'endsAt', tl.ends_at, 'gapEndsAt', tl.gap_ends_at,
           'submitted', exists (select 1 from public.live_exam_section_attempts a where a.section_id = tl.section_id and a.student_id = auth.uid()))
         order by tl.seq), '[]'::jsonb)
    into sections from public.live_exam_timeline(p_exam_id) tl;
  if clock < exam.starts_at then phase := 'waiting';
  else
    for t in select * from public.live_exam_timeline(p_exam_id) loop
      if clock >= t.starts_at and clock < t.ends_at then phase := 'section'; cur := jsonb_build_object('sectionId', t.section_id, 'position', t.seq, 'endsAt', t.ends_at); exit; end if;
      if clock >= t.ends_at and clock < t.gap_ends_at then phase := 'gap'; cur := jsonb_build_object('sectionId', t.section_id, 'position', t.seq, 'endsAt', t.gap_ends_at); exit; end if;
    end loop;
  end if;
  return jsonb_build_object('id', exam.id, 'title', exam.title, 'pattern', exam.pattern, 'status', exam.status, 'instructions', exam.instructions,
    'startsAt', exam.starts_at, 'resultsAt', exam.results_at, 'serverNow', clock, 'phase', phase, 'current', cur, 'sections', sections);
end $$;
grant execute on function public.live_exam_state(uuid) to authenticated;

-- A student's submitted attempt of a section's test, linked to the exam once, inside that section's time (plus two
-- minutes for the submit request to arrive). Its marks are read from the attempt itself.
create or replace function public.record_live_exam_section(p_section_id uuid, p_attempt_id uuid)
returns numeric language plpgsql security definer set search_path = pg_catalog, public as $$
declare s record; exam public.live_exams%rowtype; got numeric; owner uuid; clock timestamptz := now();
begin
  if auth.uid() is null or not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
  select tl.* , ls.exam_id into s from public.live_exam_sections ls cross join lateral public.live_exam_timeline(ls.exam_id) tl where ls.id = p_section_id and tl.section_id = ls.id;
  if not found then raise exception 'live exam section unavailable'; end if;
  select * into exam from public.live_exams where id = s.exam_id;
  if exam.status <> 'published' then raise exception 'live exam unavailable'; end if;
  if clock < s.starts_at or clock > s.ends_at + interval '2 minutes' then raise exception 'this section is not open now'; end if;
  if s.kind = 'typing' then
    select a.student_id, nullif(a.result->>'marksObtained', '')::numeric into owner, got from public.test_attempts a where a.id = p_attempt_id and a.test_id = s.test_id;
  elsif s.kind = 'word' then
    select a.student_id, nullif(a.result->>'marks', '')::numeric into owner, got from public.word_efficiency_attempts a where a.id = p_attempt_id and a.test_id = s.test_id;
  else
    select a.student_id, nullif(a.result->>'marks', '')::numeric into owner, got from public.excel_efficiency_attempts a where a.id = p_attempt_id and a.test_id = s.test_id;
  end if;
  if owner is distinct from auth.uid() then raise exception 'attempt does not belong to this section'; end if;
  insert into public.live_exam_section_attempts(exam_id, section_id, student_id, attempt_id, marks)
  values (s.exam_id, p_section_id, auth.uid(), p_attempt_id, least(got, s.max_marks))
  on conflict (section_id, student_id) do nothing;
  if not found then raise exception 'this section was already submitted'; end if;
  return least(got, s.max_marks);
end $$;
revoke all on function public.record_live_exam_section(uuid, uuid) from public, anon;
grant execute on function public.record_live_exam_section(uuid, uuid) to authenticated;

-- Admin: create or update an exam with its sections in one call. Sections can no longer change once it started.
create or replace function public.save_live_exam(p_exam_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_exam uuid := p_exam_id; item jsonb; pos integer := 0; started boolean;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  if jsonb_typeof(p_payload->'sections') <> 'array' or jsonb_array_length(p_payload->'sections') not between 1 and 20 then raise exception 'an exam needs 1 to 20 sections'; end if;
  if v_exam is null then
    insert into public.live_exams(title, pattern, starts_at, results_at, status, instructions)
    values (p_payload->>'title', coalesce(nullif(p_payload->>'pattern', ''), 'custom'), (p_payload->>'startsAt')::timestamptz, nullif(p_payload->>'resultsAt', '')::timestamptz,
            coalesce(nullif(p_payload->>'status', ''), 'draft'), nullif(p_payload->>'instructions', ''))
    returning id into v_exam;
  else
    select status = 'published' and starts_at <= now() into started from public.live_exams where id = v_exam;
    if started is null then raise exception 'live exam unavailable'; end if;
    if started then raise exception 'this exam has already started; its sections cannot change'; end if;
    update public.live_exams set title = p_payload->>'title', pattern = coalesce(nullif(p_payload->>'pattern', ''), 'custom'), starts_at = (p_payload->>'startsAt')::timestamptz,
      results_at = nullif(p_payload->>'resultsAt', '')::timestamptz, status = coalesce(nullif(p_payload->>'status', ''), status), instructions = nullif(p_payload->>'instructions', ''), updated_at = now()
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
end $$;
revoke all on function public.save_live_exam(uuid, jsonb) from public, anon;
grant execute on function public.save_live_exam(uuid, jsonb) to authenticated;

-- Admin: the results sheet — one row per student who took any section, each section's marks in order, the total.
create or replace function public.admin_live_exam_results(p_exam_id uuid)
returns table(student_id uuid, student_name text, section_marks jsonb, total numeric)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  return query
  select p.id, coalesce(nullif(btrim(p.full_name), ''), p.email),
    jsonb_agg(jsonb_build_object('position', s.seq, 'label', s.label, 'maxMarks', s.max_marks, 'marks', a.marks) order by s.seq),
    coalesce(sum(a.marks), 0)
  from (select distinct x.student_id from public.live_exam_section_attempts x where x.exam_id = p_exam_id) who
  join public.profiles p on p.id = who.student_id
  cross join public.live_exam_sections s
  left join public.live_exam_section_attempts a on a.section_id = s.id and a.student_id = who.student_id
  where s.exam_id = p_exam_id
  group by p.id, p.full_name, p.email
  order by coalesce(sum(a.marks), 0) desc, 2;
end $$;
revoke all on function public.admin_live_exam_results(uuid) from public, anon;
grant execute on function public.admin_live_exam_results(uuid) to authenticated;

commit;

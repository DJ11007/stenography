-- Live Exam: Final Submit. After the last part the student confirms "I have attempted this test" and presses Final
-- Submit; any part the server never received is handed in then (a typing answer kept on that computer, or a Word /
-- Excel attempt left open, from its autosave). Linking a part was allowed only until 2 minutes after that part ended;
-- now an attempt that was STARTED during its part may also be linked until 15 minutes after the exam's last part.
-- Nobody can start a part late: the attempt's own start time must fall inside the part. Safe to run twice.
begin;

create or replace function public.record_live_exam_section(p_section_id uuid, p_attempt_id uuid)
returns numeric language plpgsql security definer set search_path = pg_catalog, public as $$
declare s record; exam public.live_exams%rowtype; got numeric; owner uuid; started timestamptz; last_end timestamptz; clock timestamptz := now();
begin
  if auth.uid() is null or not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
  select tl.* , ls.exam_id into s from public.live_exam_sections ls cross join lateral public.live_exam_timeline(ls.exam_id) tl where ls.id = p_section_id and tl.section_id = ls.id;
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
  select max(t.ends_at) into last_end from public.live_exam_timeline(s.exam_id) t;
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
end $$;
revoke all on function public.record_live_exam_section(uuid, uuid) from public, anon;
grant execute on function public.record_live_exam_section(uuid, uuid) to authenticated;

commit;

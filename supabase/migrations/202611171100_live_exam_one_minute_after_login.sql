-- Live exam (per-student window): the first part starts 1 minute AFTER the student logs in, not at that same
-- instant -- the exam room shows its "The exam starts in" countdown for that minute (owner's request, 17 Nov 2026).
-- Needs the matching exam-room change (live-exam-room.tsx phaseAt waits for the first part's own start time);
-- apply this only once that is deployed, or an old exam room would open the first part a minute early.
-- Students who already started are unaffected (their start row already exists).
create or replace function public.start_live_exam_attempt(p_exam_id uuid)
 returns void
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  exam public.live_exams%rowtype;
  clock timestamptz := now();
begin
  select * into exam from public.live_exams where id = p_exam_id;
  if not found then raise exception 'live exam unavailable'; end if;
  if exam.available_until is null then return; end if;
  if auth.uid() is null or public.is_admin() then return; end if;
  if clock < exam.starts_at or clock > exam.available_until then return; end if;
  insert into public.live_exam_student_starts(exam_id, student_id, started_at) values (p_exam_id, auth.uid(), clock + interval '60 seconds')
  on conflict (exam_id, student_id) do nothing;
end
$function$;
grant execute on function public.start_live_exam_attempt(uuid) to authenticated;

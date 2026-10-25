-- Typing attempts keep their full details (passage, typed text, mistake lists) only for each student's latest
-- 5 tests, plus every live-test attempt. Older attempts keep their row and their score line (Net/Gross WPM,
-- accuracy, errors, pass): the rows are still counted by the free-test limits and live results, so they are
-- never deleted. Each new attempt trims the student's sixth-newest one.
begin;

-- The score line of a result: its numbers, true/false values and short texts, marked detailsRemoved.
create or replace function public.typing_result_without_details(p_result jsonb)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'public' as $function$
 select coalesce((select jsonb_object_agg(key, value) from jsonb_each(p_result)
   where key not in ('typedText', 'resolvedPassage', 'comparisonText')
     and (jsonb_typeof(value) in ('number', 'boolean', 'null') or (jsonb_typeof(value) = 'string' and length(value #>> '{}') <= 200))), '{}'::jsonb)
  || jsonb_build_object('detailsRemoved', true)
$function$;

create or replace function public.prune_typing_attempt_details(p_student uuid)
returns integer language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare trimmed integer := 0; n integer;
begin
 with ranked as (
   select id, 'test' kind, row_number() over (order by coalesce(submitted_at, started_at) desc, id) rn
   from (select id, submitted_at, started_at from public.test_attempts where student_id = p_student and not is_live_attempt
         union all select id, submitted_at, started_at from public.practice_attempts where student_id = p_student) a
 ), old as (select id from ranked where rn > 5)
 update public.test_attempts t set
   result = public.typing_result_without_details(t.result),
   snapshot = (t.snapshot - 'passage' - 'configuration') || jsonb_build_object('configuration', jsonb_strip_nulls(jsonb_build_object(
     'audio_path', t.snapshot->'configuration'->'audio_path', 'exam_category', t.snapshot->'configuration'->'exam_category')))
 from old where t.id = old.id and t.student_id = p_student and not t.is_live_attempt and not coalesce((t.result->>'detailsRemoved')::boolean, false);
 get diagnostics n = row_count; trimmed := trimmed + n;

 with ranked as (
   select id, row_number() over (order by coalesce(submitted_at, started_at) desc, id) rn
   from (select id, submitted_at, started_at from public.test_attempts where student_id = p_student and not is_live_attempt
         union all select id, submitted_at, started_at from public.practice_attempts where student_id = p_student) a
 ), old as (select id from ranked where rn > 5)
 update public.practice_attempts p set
   result = public.typing_result_without_details(p.result),
   snapshot = jsonb_strip_nulls(jsonb_build_object('inputSystemId', p.snapshot->'inputSystemId'))
 from old where p.id = old.id and p.student_id = p_student and not coalesce((p.result->>'detailsRemoved')::boolean, false);
 get diagnostics n = row_count; trimmed := trimmed + n;
 return trimmed;
end $function$;

revoke all on function public.prune_typing_attempt_details(uuid) from public, anon, authenticated;

create or replace function public.prune_typing_attempt_details_after_insert()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
begin
 perform public.prune_typing_attempt_details(new.student_id);
 return null;
end $function$;

drop trigger if exists prune_typing_attempt_details on public.test_attempts;
create trigger prune_typing_attempt_details after insert on public.test_attempts for each row execute function public.prune_typing_attempt_details_after_insert();
drop trigger if exists prune_typing_attempt_details on public.practice_attempts;
create trigger prune_typing_attempt_details after insert on public.practice_attempts for each row execute function public.prune_typing_attempt_details_after_insert();

-- Existing attempts: trim every student's older ones once.
select public.prune_typing_attempt_details(s.student_id)
from (select student_id from public.test_attempts union select student_id from public.practice_attempts) s;

commit;

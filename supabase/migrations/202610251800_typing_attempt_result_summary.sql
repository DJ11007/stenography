-- Typing attempts keep a small result_summary (Net/Gross WPM, accuracy, errors, pass) next to the large result
-- (~13 kB: passage, typed text, mistake lists). Lists of attempts read only the summary. Reading the whole
-- results of a student with ~900 attempts took past the 8-second limit, so admin Track and the student's
-- Test Results page showed "No typing attempts yet"; even picking fields out of result took ~3 s.
begin;

create or replace function public.typing_result_summary(p_result jsonb)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'public' as $function$
 select case when p_result is null or jsonb_typeof(p_result) <> 'object' then null else jsonb_strip_nulls(jsonb_build_object(
  'netWpm', p_result->'netWpm', 'marksNetWpm', p_result->'marksNetWpm', 'grossWpm', p_result->'grossWpm', 'accuracy', p_result->'accuracy',
  'fullErrors', p_result->'fullErrors', 'halfErrors', p_result->'halfErrors', 'marksQualified', p_result->'marksQualified', 'passed', p_result->'passed',
  'qualified', p_result->'qualified', 'marks', p_result->'marks', 'maximum', p_result->'maximum', 'bestWpm', p_result->'bestWpm')) end
$function$;

create or replace function public.set_typing_result_summary()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $function$
begin
 if tg_op = 'INSERT' or new.result is distinct from old.result then new.result_summary := public.typing_result_summary(new.result); end if;
 return new;
end $function$;

alter table public.test_attempts add column if not exists result_summary jsonb;
alter table public.practice_attempts add column if not exists result_summary jsonb;

drop trigger if exists set_typing_result_summary on public.test_attempts;
create trigger set_typing_result_summary before insert or update of result on public.test_attempts for each row execute function public.set_typing_result_summary();
drop trigger if exists set_typing_result_summary on public.practice_attempts;
create trigger set_typing_result_summary before insert or update of result on public.practice_attempts for each row execute function public.set_typing_result_summary();

update public.test_attempts set result_summary = public.typing_result_summary(result) where result_summary is null and result is not null;
update public.practice_attempts set result_summary = public.typing_result_summary(result) where result_summary is null and result is not null;

commit;

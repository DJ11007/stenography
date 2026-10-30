-- Excel Efficiency: the admin solves the paper in the sheet (a "Model Answer") and the marking rules are built
-- from what was changed, question by question -- the same as Word Efficiency. Also the Auto-grading page's
-- checks: the model answer is run through its own rules, automatic publishing is switched on only when every
-- question earns its full marks, and a corrected rule can re-mark the automatically marked attempts.
begin;

alter table public.excel_efficiency_versions add column if not exists model_answer_snapshot jsonb;

-- The admin pages read the rules with an ordinary query; the table's policy already limits it to admins.
grant select on public.excel_efficiency_grading_rules to authenticated;

-- Saving a test again makes a new version. It keeps the model answer of the test's latest version when its
-- working sheet is exactly the same (the rules point at cells of that sheet).
create or replace function public.carry_excel_efficiency_model_answer()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $function$
declare previous jsonb;
begin
 if new.model_answer_snapshot is null then
  select older.model_answer_snapshot into previous from public.excel_efficiency_versions as older
   where older.test_id = new.test_id and older.model_answer_snapshot is not null and older.working_matter_snapshot = new.working_matter_snapshot
   order by older.version_number desc limit 1;
  if previous is not null then new.model_answer_snapshot := previous; end if;
 end if;
 return new;
end $function$;
drop trigger if exists carry_excel_efficiency_model_answer on public.excel_efficiency_versions;
create trigger carry_excel_efficiency_model_answer before insert on public.excel_efficiency_versions
 for each row execute function public.carry_excel_efficiency_model_answer();

create or replace function public.save_excel_efficiency_model_answer(p_version_id uuid, p_document jsonb)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if not exists (select 1 from public.excel_efficiency_versions where id = p_version_id) then raise exception 'test version unavailable'; end if;
 perform public.assert_excel_efficiency_document_schema(p_document);
 update public.excel_efficiency_versions set model_answer_snapshot = p_document where id = p_version_id;
end $function$;

-- Starts the paper over: the model answer and every rule of the version are cleared. Marks already given to
-- students are not touched.
create or replace function public.reset_excel_efficiency_model_answer(p_version_id uuid)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if not exists (select 1 from public.excel_efficiency_versions where id = p_version_id) then raise exception 'test version unavailable'; end if;
 delete from public.excel_efficiency_grading_rules where version_id = p_version_id;
 update public.excel_efficiency_versions set model_answer_snapshot = null where id = p_version_id;
end $function$;

-- The model answer run through the rules: per question whether it has rules, how many marks they carry, and
-- what the model answer earns. A question is fine when its rules carry all its marks and the model earns them all.
create or replace function public.check_excel_efficiency_auto_grading(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $function$
declare v public.excel_efficiency_versions%rowtype; summary jsonb; all_ok boolean;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 select version_rows.* into v from public.excel_efficiency_tests as test_rows join public.excel_efficiency_versions as version_rows on version_rows.id = test_rows.current_version_id where test_rows.id = p_test_id;
 if not found then raise exception 'test version unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('number', x.question_number, 'hasRule', x.rule_total is not null, 'allocatedMarks', x.rule_total, 'modelGets', x.model_gets,
   'ok', coalesce(x.rule_total is not null and x.model_gets is not null and x.rule_total >= x.marks - 0.005 and x.model_gets >= x.rule_total - 0.005, false)) order by x.question_number), '[]'::jsonb) into summary
 from (select q.question_number, q.marks,
        (select sum(r.allocated_marks) from public.excel_efficiency_grading_rules r where r.version_id = v.id and r.question_id = q.id) as rule_total,
        case when v.model_answer_snapshot is not null and exists (select 1 from public.excel_efficiency_grading_rules r where r.version_id = v.id and r.question_id = q.id)
             then public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks) end as model_gets
       from public.excel_efficiency_questions q where q.version_id = v.id) x;
 all_ok := jsonb_array_length(summary) > 0 and not exists (select 1 from jsonb_array_elements(summary) i where not (i->>'ok')::boolean);
 return jsonb_build_object('versionId', v.id, 'hasModelAnswer', v.model_answer_snapshot is not null, 'ready', v.model_answer_snapshot is not null and all_ok, 'questions', summary);
end $function$;

create or replace function public.set_excel_efficiency_auto_publish(p_test_id uuid, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if p_enabled and not coalesce((public.check_excel_efficiency_auto_grading(p_test_id)->>'ready')::boolean, false) then
  raise exception 'automatic publishing needs every question to have grading rules that score full marks on the saved model answer';
 end if;
 update public.excel_efficiency_tests set auto_publish_results = p_enabled where id = p_test_id;
 if not found then raise exception 'test unavailable'; end if;
 return jsonb_build_object('autoPublish', p_enabled);
end $function$;

-- Marks every submitted attempt of the version again with the current rules. Only questions that were marked
-- automatically are changed (a teacher's own marks stay); a published result gets its totals refreshed.
create or replace function public.regrade_excel_efficiency_version(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare a record; s record; new_marks numeric; examined integer := 0; changed integer := 0; total numeric; maximum numeric; passing numeric; pct numeric;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if not exists (select 1 from public.excel_efficiency_versions where id = p_version_id) then raise exception 'test version unavailable'; end if;
 select version_rows.passing_marks into passing from public.excel_efficiency_versions as version_rows where version_rows.id = p_version_id;
 for a in select attempt_rows.id, attempt_rows.final_document_snapshot, attempt_rows.result from public.excel_efficiency_attempts as attempt_rows
          where attempt_rows.version_id = p_version_id and attempt_rows.status in ('submitted', 'completed') and attempt_rows.final_document_snapshot is not null loop
  examined := examined + 1;
  for s in select score_rows.id, score_rows.question_id, score_rows.awarded_marks, score_rows.maximum_marks from public.excel_efficiency_question_scores as score_rows
           where score_rows.attempt_id = a.id and score_rows.graded_by is null
             and exists (select 1 from public.excel_efficiency_grading_rules r where r.version_id = p_version_id and r.question_id = score_rows.question_id) loop
   new_marks := public.excel_efficiency_score_question(a.final_document_snapshot, p_version_id, s.question_id, s.maximum_marks);
   if s.awarded_marks is distinct from new_marks then
    update public.excel_efficiency_question_scores set awarded_marks = new_marks, grading_status = 'graded', updated_at = now(),
     teacher_comment = case when new_marks >= s.maximum_marks then 'Full marks: the required change was found in your sheet.' when new_marks > 0 then 'Part marks: some of the required changes were found in your sheet.' else 'No marks: the required change was not found in your sheet.' end
     where id = s.id;
    changed := changed + 1;
   end if;
  end loop;
  if a.result is not null then
   select coalesce(sum(score_rows.awarded_marks), 0), sum(score_rows.maximum_marks) into total, maximum from public.excel_efficiency_question_scores as score_rows where score_rows.attempt_id = a.id;
   pct := case when maximum > 0 then round(total * 100 / maximum, 2) else 0 end;
   update public.excel_efficiency_attempts set updated_at = now(),
    result = a.result || jsonb_build_object('marks', total, 'maximum_marks', maximum, 'percentage', pct, 'passed', case when passing is null then null else total >= passing end)
    where id = a.id;
  end if;
 end loop;
 return jsonb_build_object('attemptsExamined', examined, 'scoresChanged', changed);
end $function$;

revoke all on function public.save_excel_efficiency_model_answer(uuid, jsonb), public.reset_excel_efficiency_model_answer(uuid), public.check_excel_efficiency_auto_grading(uuid),
 public.set_excel_efficiency_auto_publish(uuid, boolean), public.regrade_excel_efficiency_version(uuid) from public, anon;
grant execute on function public.save_excel_efficiency_model_answer(uuid, jsonb), public.reset_excel_efficiency_model_answer(uuid), public.check_excel_efficiency_auto_grading(uuid),
 public.set_excel_efficiency_auto_publish(uuid, boolean), public.regrade_excel_efficiency_version(uuid) to authenticated;

-- Replaces the rules of ONE question (the Model Answer page saves a question at a time) and leaves every other
-- question's rules as they are. p_rules: [{allocatedMarks, partLabel, additionalCriteria}]; an empty list only
-- clears the question.
create or replace function public.save_excel_efficiency_question_rules(p_version_id uuid, p_question_number integer, p_rules jsonb)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare question_record public.excel_efficiency_questions%rowtype; item jsonb; total numeric := 0;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 26 then raise exception 'invalid grading rules'; end if;
 select * into question_record from public.excel_efficiency_questions where version_id = p_version_id and question_number = p_question_number;
 if not found then raise exception 'grading rule question does not belong to version'; end if;
 for item in select value from jsonb_array_elements(p_rules) loop
  if jsonb_typeof(item) <> 'object' or exists (select 1 from jsonb_object_keys(item) k where k <> all (array['allocatedMarks','partLabel','additionalCriteria']))
     or jsonb_typeof(item->'additionalCriteria') <> 'array' or jsonb_array_length(item->'additionalCriteria') = 0 or jsonb_array_length(item->'additionalCriteria') > 200
     or jsonb_typeof(item->'allocatedMarks') <> 'number' or (item->>'allocatedMarks')::numeric <= 0 then raise exception 'invalid grading rule'; end if;
  total := total + (item->>'allocatedMarks')::numeric;
 end loop;
 if total > question_record.marks + 0.005 then raise exception 'grading rule marks exceed question marks'; end if;
 delete from public.excel_efficiency_grading_rules where version_id = p_version_id and question_id = question_record.id;
 for item in select value from jsonb_array_elements(p_rules) loop
  insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
  values (p_version_id, question_record.id, 'sheet', 'rule-criteria', 'null'::jsonb, (item->>'allocatedMarks')::numeric, null, item->'additionalCriteria', nullif(btrim(coalesce(item->>'partLabel', '')), ''));
 end loop;
end $function$;
revoke all on function public.save_excel_efficiency_question_rules(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_excel_efficiency_question_rules(uuid, integer, jsonb) to authenticated;

-- Rules can be saved again after attempts exist (the Auto-grading page re-marks them); before, the first
-- attempt locked the rules. Same function as migration 202610251700 otherwise.
create or replace function public.save_excel_efficiency_grading_rules(p_version_id uuid, p_rules jsonb)
returns void language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
declare item jsonb; question_record public.excel_efficiency_questions%rowtype; expected jsonb;
 allowed text[] := array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks','additionalCriteria','partLabel'];
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 500 then raise exception 'invalid grading rules'; end if;
 delete from public.excel_efficiency_grading_rules where version_id = p_version_id;
 for item in select value from jsonb_array_elements(p_rules) loop
  if jsonb_typeof(item) <> 'object' or not (item ?& array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks']) or exists (select 1 from jsonb_object_keys(item) k where k <> all (allowed)) then raise exception 'invalid grading rule'; end if;
  select * into question_record from public.excel_efficiency_questions where version_id = p_version_id and question_number = (item->>'questionNumber')::integer;
  if not found then raise exception 'grading rule question does not belong to version'; end if;
  begin expected := (item->>'expectedValue')::jsonb; exception when others then expected := to_jsonb(item->>'expectedValue'); end;
  if (item->>'allocatedMarks')::numeric > question_record.marks then raise exception 'grading rule marks exceed question marks'; end if;
  insert into public.excel_efficiency_grading_rules(version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, partial_marks, additional_criteria, part_label)
  values (p_version_id, question_record.id, btrim(item->>'exactTarget'), btrim(item->>'expectedOperation'), expected, (item->>'allocatedMarks')::numeric,
   case when jsonb_typeof(item->'partialMarks') = 'null' then null else (item->>'partialMarks')::numeric end,
   case when jsonb_typeof(item->'additionalCriteria') = 'array' then item->'additionalCriteria' else '[]'::jsonb end, nullif(btrim(coalesce(item->>'partLabel','')), ''));
 end loop;
end $function$;

commit;

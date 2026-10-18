-- Marks per part (a), (b), (c) of a question. Requested 2026-10-18: a student who did
-- parts a and b but not c got 0 for the whole question, with no way to see which part
-- missed. A grading rule can now carry a part label; a question's score is the sum of its
-- part rules, and each part's mark is kept in word_efficiency_question_scores.part_scores
-- for the result page. Questions whose rules carry no part label are scored exactly as
-- before (one rule, scaled to the question's marks).
-- Idempotent; paste into the Supabase SQL editor as one script.
begin;

alter table public.word_efficiency_grading_rules add column if not exists part_label text;
alter table public.word_efficiency_question_scores add column if not exists part_scores jsonb;
-- One rule per question PART now (was one per question).
alter table public.word_efficiency_grading_rules drop constraint if exists word_efficiency_grading_rules_version_id_question_id_key;
create unique index if not exists word_efficiency_grading_rules_version_question_part_key on public.word_efficiency_grading_rules (version_id, question_id, coalesce(part_label, ''));

create or replace function public.word_efficiency_score_question(p_document jsonb, p_version_id uuid, p_question_id uuid, p_maximum numeric, p_model jsonb, out awarded numeric, out parts jsonb)
 language plpgsql stable security definer set search_path to 'pg_catalog', 'public'
as $function$
declare rule record;earned numeric;total numeric:=0;total_allocated numeric:=0;has_parts boolean;
begin
 awarded:=null;parts:=null;
 select bool_or(grading_rules.part_label is not null) into has_parts from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id and grading_rules.question_id=p_question_id;
 if has_parts is null then return;end if;
 if not has_parts then
  select grading_rules.* into rule from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id and grading_rules.question_id=p_question_id order by grading_rules.created_at,grading_rules.id limit 1;
  awarded:=round(public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,p_model)*p_maximum/rule.allocated_marks,2);
  return;
 end if;
 parts:='[]'::jsonb;
 for rule in select grading_rules.* from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id and grading_rules.question_id=p_question_id order by coalesce(grading_rules.part_label,''),grading_rules.created_at,grading_rules.id loop
  earned:=round(public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,p_model),2);
  total:=total+earned;total_allocated:=total_allocated+rule.allocated_marks;
  parts:=parts||jsonb_build_object('label',coalesce(rule.part_label,''),'awarded',earned,'maximum',rule.allocated_marks);
 end loop;
 awarded:=case when total_allocated>0 then round(total*p_maximum/total_allocated,2) else 0 end;
end $function$;
revoke all on function public.word_efficiency_score_question(jsonb,uuid,uuid,numeric,jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_word_efficiency_document(p_attempt_id uuid, p_document jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;score_row record;earned_marks numeric;earned_parts jsonb;model_document jsonb;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()for update;
 if not found or attempt_record.status<>'active'or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception'attempt unavailable or already submitted';end if;
 if attempt_record.original_document_snapshot is null then raise exception'attempt original document is invalid';end if;
 select public.normalize_word_efficiency_editor_capabilities(version_rows.editor_capabilities)into effective_capabilities from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 baseline_document:=case when p_document->>'schemaVersion'='1'and attempt_record.snapshot#>>'{initial_editor_document,schemaVersion}'='1'then attempt_record.snapshot->'initial_editor_document'else public.word_efficiency_initial_editor_document(attempt_record.original_document_snapshot)end;
 perform public.assert_word_efficiency_editor_capabilities(effective_capabilities);perform public.assert_word_efficiency_document_schema(baseline_document,effective_capabilities);
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then
  perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);perform public.assert_word_efficiency_capability_changes(p_document,baseline_document,effective_capabilities);
 else
  p_document:=coalesce(attempt_record.document_autosave,baseline_document);
  perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);perform public.assert_word_efficiency_capability_changes(p_document,baseline_document,effective_capabilities);
 end if;
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='active'and attempt_rows.final_document_snapshot is null;
 if not found then raise exception'attempt unavailable or already submitted';end if;
 select version_rows.model_answer_snapshot into model_document from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 for score_row in select question_scores.id,question_scores.question_id,question_scores.maximum_marks from public.word_efficiency_question_scores as question_scores where question_scores.attempt_id=p_attempt_id and question_scores.awarded_marks is null and question_scores.graded_by is null loop
  select scored.awarded,scored.parts into earned_marks,earned_parts from public.word_efficiency_score_question(p_document,attempt_record.version_id,score_row.question_id,score_row.maximum_marks,model_document)as scored;
  if earned_marks is not null then
   update public.word_efficiency_question_scores as question_scores set awarded_marks=earned_marks,part_scores=earned_parts,grading_status='graded',updated_at=now()where question_scores.id=score_row.id;
  end if;
 end loop;
 if exists(select 1 from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id and test_rows.auto_publish_results)then
  perform public.word_efficiency_auto_publish_attempt(p_attempt_id);
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.regrade_word_efficiency_version(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare attempt_row record;score_row record;new_marks numeric;new_parts jsonb;model_document jsonb;examined integer:=0;changed_scores integer:=0;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if not exists(select 1 from public.word_efficiency_versions as version_rows where version_rows.id=p_version_id)then raise exception'test version unavailable';end if;
 select version_rows.model_answer_snapshot into model_document from public.word_efficiency_versions as version_rows where version_rows.id=p_version_id;
 for attempt_row in select attempt_rows.id,attempt_rows.final_document_snapshot,attempt_rows.result from public.word_efficiency_attempts as attempt_rows where attempt_rows.version_id=p_version_id and attempt_rows.status in('submitted','completed')and attempt_rows.final_document_snapshot is not null and(attempt_rows.result is null or attempt_rows.evaluated_by is null)order by attempt_rows.id for update loop
  examined:=examined+1;
  for score_row in select score_rows.id,score_rows.question_id,score_rows.awarded_marks,score_rows.maximum_marks from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=attempt_row.id and score_rows.graded_by is null loop
   select scored.awarded,scored.parts into new_marks,new_parts from public.word_efficiency_score_question(attempt_row.final_document_snapshot,p_version_id,score_row.question_id,score_row.maximum_marks,model_document)as scored;
   if new_marks is null then continue;end if;
   update public.word_efficiency_question_scores as score_rows set part_scores=new_parts where score_rows.id=score_row.id and score_rows.part_scores is distinct from new_parts;
   if score_row.awarded_marks is distinct from new_marks then
    update public.word_efficiency_question_scores as score_rows set awarded_marks=new_marks,grading_status='graded',updated_at=now()where score_rows.id=score_row.id;
    insert into public.word_efficiency_grade_changes(attempt_id,question_id,old_awarded,new_awarded,source,reason,changed_by)values(attempt_row.id,score_row.question_id,score_row.awarded_marks,new_marks,'regrade','Re-graded with the corrected grading rules',auth.uid());
    changed_scores:=changed_scores+1;
   end if;
  end loop;
  if attempt_row.result is not null then perform public.word_efficiency_refresh_published_result(attempt_row.id);end if;
 end loop;
 return jsonb_build_object('attemptsExamined',examined,'scoresChanged',changed_scores);
end $function$;

-- EFFICIENCY TEST 2 (version e5830d7a…): split each question's single rule into its
-- parts. Criteria are picked from the existing rule by index. Q4 (b) (page border) has
-- no automatic check, so Q4's marks go to (a) and (c). Runs only while the version still
-- has its five unsplit rules.
do $split$
declare v_version constant uuid:='e5830d7a-9bbb-4594-9a73-bc3dddc29305';plan jsonb:='[
  {"q":1,"parts":[{"label":"a","marks":1.67,"idx":[7]},{"label":"b","marks":1.67,"idx":[6]},{"label":"c","marks":1.66,"idx":[0,1,2,3,4,5]}]},
  {"q":2,"parts":[{"label":"a","marks":1.67,"idx":[7,8,9]},{"label":"b","marks":1.67,"idx":[4]},{"label":"c","marks":1.66,"idx":[0,1,2,3,5,6]}]},
  {"q":3,"parts":[{"label":"a","marks":1.67,"idx":[0,19]},{"label":"b","marks":1.67,"idx":[26]},{"label":"c","marks":1.66,"idx":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,23,24,25,27,28,29,30,31,32]}]},
  {"q":4,"parts":[{"label":"a","marks":2.50,"idx":[10]},{"label":"c","marks":2.50,"idx":[0,1,2,3,4,5,6,7,8,9]}]},
  {"q":5,"parts":[{"label":"a","marks":1.67,"idx":[0,1,6,15,16,17,18,19,20,21]},{"label":"b","marks":1.67,"idx":[7,8,9,10,11,12,13,14]},{"label":"c","marks":1.66,"idx":[2,3,4,5]}]}
]'::jsonb;item jsonb;part jsonb;old_rule record;criteria jsonb;
begin
 if (select count(*) from public.word_efficiency_grading_rules where word_efficiency_grading_rules.version_id=v_version and part_label is null)<>5
  or exists(select 1 from public.word_efficiency_grading_rules where word_efficiency_grading_rules.version_id=v_version and part_label is not null) then return;end if;
 for item in select * from jsonb_array_elements(plan) loop
  select rules.* into old_rule from public.word_efficiency_grading_rules as rules join public.word_efficiency_questions as questions on questions.id=rules.question_id where rules.version_id=v_version and questions.question_number=(item->>'q')::int;
  if not found then raise exception 'Test 2 question % has no rule',item->>'q';end if;
  for part in select * from jsonb_array_elements(item->'parts') loop
   select jsonb_agg(old_rule.additional_criteria->(idx::int) order by idx::int) into criteria from jsonb_array_elements_text(part->'idx') as idx;
   if criteria is null or jsonb_array_length(criteria)<>jsonb_array_length(part->'idx') then raise exception 'Test 2 question % part %: criteria not found',item->>'q',part->>'label';end if;
   insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria,part_label)
   values(old_rule.version_id,old_rule.question_id,criteria->0->>'target',old_rule.expected_operation,old_rule.expected_value,(part->>'marks')::numeric,null,criteria,part->>'label');
  end loop;
  delete from public.word_efficiency_grading_rules where id=old_rule.id;
 end loop;
end $split$ language plpgsql;

commit;

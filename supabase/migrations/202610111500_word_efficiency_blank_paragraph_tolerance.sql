begin;

-- Word Efficiency auto-grading: tolerate blank paragraphs.
--
-- Real case (a student who attempted Q1 and Q2 correctly got 0 on everything):
-- grading rules address a paragraph by its absolute position (blocks.5...), but
-- the student's document had ONE extra blank paragraph at position 5 that the
-- model answer does not have, so every rule from position 5 onward read the wrong
-- paragraph (Q4's rule read an empty paragraph; Q1's bold was checked on the blank
-- line while paragraph six sat at 6). Whether a blank line exists depends on the
-- student's editing history (an Enter key, or the editor removing one), so the same
-- correct work could score differently.
--
-- When the exact position does not match, a rule is now also tried against the
-- paragraph in the student's document that holds the SAME PLACE AMONG NON-BLANK
-- PARAGRAPHS as the rule's paragraph holds in the saved model answer. The exact
-- check is still tried first, so nothing that scores today can stop scoring.

create or replace function public.word_efficiency_block_has_content(block_value jsonb)
returns boolean language sql immutable set search_path=pg_catalog,public as $$
 select block_value is not null and jsonb_typeof(block_value)='object' and (
  coalesce(block_value->>'type','paragraph') not in('paragraph','list-item')
  or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(block_value->'runs')='array' then block_value->'runs' else '[]'::jsonb end) as run_item where btrim(coalesce(run_item->>'text',''))<>'')
 )
$$;

create or replace function public.word_efficiency_remap_block_target(target text,model_document jsonb,document jsonb)
returns text language plpgsql immutable set search_path=pg_catalog,public as $$
declare parts text[];model_index integer;content_rank integer;found_index integer;
begin
 if model_document is null or document is null or target is null then return target;end if;
 parts:=string_to_array(target,'.');
 if parts[1]<>'blocks' or coalesce(array_length(parts,1),0)<3 or parts[2] !~ '^[0-9]+$' then return target;end if;
 model_index:=parts[2]::integer;
 if not public.word_efficiency_block_has_content((coalesce(model_document->'blocks','[]'::jsonb))->model_index)then return target;end if;
 select count(*)into content_rank from jsonb_array_elements(coalesce(model_document->'blocks','[]'::jsonb))with ordinality as model_block(value,ord) where model_block.ord-1<model_index and public.word_efficiency_block_has_content(model_block.value);
 select ranked.ord-1 into found_index from(select block_item.ord,row_number()over(order by block_item.ord)as place from jsonb_array_elements(coalesce(document->'blocks','[]'::jsonb))with ordinality as block_item(value,ord) where public.word_efficiency_block_has_content(block_item.value))as ranked where ranked.place=content_rank+1;
 if found_index is null then return target;end if;
 parts[2]:=found_index::text;
 return array_to_string(parts,'.');
end $$;

-- The previous single-position matcher, kept under a clearer name.
create or replace function public.word_efficiency_grading_target_matches_at(document jsonb,target text,expected jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare actual jsonb;parts text[];block_value jsonb;runs_value jsonb;prop text;run_position integer;candidate jsonb;joined text;
begin
 actual:=public.word_efficiency_grading_target_value(document,target);
 if actual is not distinct from expected then return true;end if;
 if expected is null then return false;end if;
 parts:=string_to_array(coalesce(target,''),'.');
 if coalesce(array_length(parts,1),0)<>5 or parts[1]<>'blocks' or parts[3]<>'runs' or parts[2] !~ '^[0-9]+$' or parts[4] !~ '^[0-9]+$' then return false;end if;
 block_value:=(coalesce(document->'blocks','[]'::jsonb))->(parts[2]::integer);
 runs_value:=coalesce(block_value->'runs','[]'::jsonb);
 if jsonb_typeof(runs_value)<>'array' then return false;end if;
 prop:=parts[5];run_position:=parts[4]::integer;
 if prop='text' then
  select string_agg(coalesce(run_item.value->>'text',''),'' order by run_item.ord)into joined from jsonb_array_elements(runs_value)with ordinality as run_item(value,ord);
  return joined is not null and to_jsonb(joined) is not distinct from expected;
 end if;
 select run_item.value into candidate from jsonb_array_elements(runs_value)with ordinality as run_item(value,ord) where btrim(coalesce(run_item.value->>'text',''))<>'' order by run_item.ord offset run_position limit 1;
 return candidate is not null and (candidate->prop) is not null and (candidate->prop) is not distinct from expected;
end $$;

-- Replace the 3-argument matcher with one that also takes the model answer.
drop function if exists public.word_efficiency_grading_target_matches(jsonb,text,jsonb);
create or replace function public.word_efficiency_grading_target_matches(document jsonb,target text,expected jsonb,model_document jsonb default null)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
declare remapped text;
begin
 if public.word_efficiency_grading_target_matches_at(document,target,expected)then return true;end if;
 remapped:=public.word_efficiency_remap_block_target(target,model_document,document);
 return remapped is distinct from target and public.word_efficiency_grading_target_matches_at(document,remapped,expected);
end $$;

drop function if exists public.evaluate_word_efficiency_grading_rule(jsonb,text,text,jsonb,numeric,numeric,jsonb);
create or replace function public.evaluate_word_efficiency_grading_rule(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '[]'::jsonb,model_document jsonb default null)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare operation_applied boolean;criterion jsonb;all_additional_matched boolean:=true;
begin
 if expected_value is not null and public.word_efficiency_grading_target_matches(final_document,target,expected_value,model_document)then
  for criterion in select value from jsonb_array_elements(coalesce(additional_criteria,'[]'::jsonb)) loop
   if not public.word_efficiency_grading_target_matches(final_document,criterion->>'target',criterion->'expectedValue',model_document)then all_additional_matched:=false;exit;end if;
  end loop;
  if all_additional_matched then return allocated_marks;end if;
 end if;
 operation_applied:=exists(select 1 from jsonb_array_elements_text(coalesce(final_document->'operations','[]'::jsonb))as operation_value where operation_value=expected_operation);
 if operation_applied then return coalesce(partial_marks,0);end if;
 return 0;
end $$;

-- The three functions below are identical to the previous migration's, except
-- that each rule evaluation is given the saved model answer as its reference.
create or replace function public.submit_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;rule record;model_document jsonb;
begin
 if not public.is_active_word_efficiency_student()then raise exception'active student account required';end if;
 select attempt_rows.* into attempt_record from public.word_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()for update;
 if not found or attempt_record.status<>'active'or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception'attempt unavailable or already submitted';end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds+300)then raise exception'submission grace expired';end if;
 if attempt_record.original_document_snapshot is null then raise exception'attempt original document is invalid';end if;
 select public.normalize_word_efficiency_editor_capabilities(version_rows.editor_capabilities)into effective_capabilities from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 baseline_document:=case when p_document->>'schemaVersion'='1'and attempt_record.snapshot#>>'{initial_editor_document,schemaVersion}'='1'then attempt_record.snapshot->'initial_editor_document'else public.word_efficiency_initial_editor_document(attempt_record.original_document_snapshot)end;
 perform public.assert_word_efficiency_editor_capabilities(effective_capabilities);perform public.assert_word_efficiency_document_schema(baseline_document,effective_capabilities);
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds)then
  perform public.assert_word_efficiency_document_schema(p_document,effective_capabilities);perform public.assert_word_efficiency_capability_changes(p_document,baseline_document,effective_capabilities);
 else
  if attempt_record.document_autosave is null or(p_document-'savedAt'-'operations')is distinct from(attempt_record.document_autosave-'savedAt'-'operations')then raise exception'post-deadline submission must match the last valid autosave';end if;
  perform public.assert_word_efficiency_document_schema(attempt_record.document_autosave,effective_capabilities);perform public.assert_word_efficiency_capability_changes(attempt_record.document_autosave,baseline_document,effective_capabilities);p_document:=attempt_record.document_autosave;
 end if;
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='active'and attempt_rows.final_document_snapshot is null;
 if not found then raise exception'attempt unavailable or already submitted';end if;
 select version_rows.model_answer_snapshot into model_document from public.word_efficiency_versions as version_rows where version_rows.id=attempt_record.version_id;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.word_efficiency_question_scores as question_scores set awarded_marks=round(public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,model_document)*question_scores.maximum_marks/rule.allocated_marks,2),grading_status='graded',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
 if exists(select 1 from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id and test_rows.auto_publish_results)then
  perform public.word_efficiency_auto_publish_attempt(p_attempt_id);
 end if;
end $$;

create or replace function public.regrade_word_efficiency_version(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_row record;rule record;score_row record;new_marks numeric;model_document jsonb;examined integer:=0;changed_scores integer:=0;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if not exists(select 1 from public.word_efficiency_versions as version_rows where version_rows.id=p_version_id)then raise exception'test version unavailable';end if;
 select version_rows.model_answer_snapshot into model_document from public.word_efficiency_versions as version_rows where version_rows.id=p_version_id;
 for attempt_row in select attempt_rows.id,attempt_rows.final_document_snapshot,attempt_rows.result from public.word_efficiency_attempts as attempt_rows where attempt_rows.version_id=p_version_id and attempt_rows.status in('submitted','completed')and attempt_rows.final_document_snapshot is not null and(attempt_rows.result is null or attempt_rows.evaluated_by is null)order by attempt_rows.id for update loop
  examined:=examined+1;
  for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=p_version_id loop
   select score_rows.id,score_rows.awarded_marks,score_rows.maximum_marks into score_row from public.word_efficiency_question_scores as score_rows where score_rows.attempt_id=attempt_row.id and score_rows.question_id=rule.question_id and score_rows.graded_by is null;
   if not found then continue;end if;
   new_marks:=round(public.evaluate_word_efficiency_grading_rule(attempt_row.final_document_snapshot,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,model_document)*score_row.maximum_marks/rule.allocated_marks,2);
   if score_row.awarded_marks is distinct from new_marks then
    update public.word_efficiency_question_scores as score_rows set awarded_marks=new_marks,grading_status='graded',updated_at=now()where score_rows.id=score_row.id;
    insert into public.word_efficiency_grade_changes(attempt_id,question_id,old_awarded,new_awarded,source,reason,changed_by)values(attempt_row.id,rule.question_id,score_row.awarded_marks,new_marks,'regrade','Re-graded with the corrected grading rules',auth.uid());
    changed_scores:=changed_scores+1;
   end if;
  end loop;
  if attempt_row.result is not null then perform public.word_efficiency_refresh_published_result(attempt_row.id);end if;
 end loop;
 return jsonb_build_object('attemptsExamined',examined,'scoresChanged',changed_scores);
end $$;

create or replace function public.check_word_efficiency_auto_grading(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare version_row public.word_efficiency_versions%rowtype;question_summary jsonb;all_ok boolean;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 select version_rows.* into version_row from public.word_efficiency_tests as test_rows join public.word_efficiency_versions as version_rows on version_rows.id=test_rows.current_version_id where test_rows.id=p_test_id;
 if not found then raise exception'test version unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('number',question_rows_inner.question_number,'hasRule',question_rows_inner.rule_id is not null,'allocatedMarks',question_rows_inner.allocated_marks,'modelGets',question_rows_inner.model_gets,'ok',coalesce(question_rows_inner.model_gets=question_rows_inner.allocated_marks,false))order by question_rows_inner.question_number),'[]'::jsonb)into question_summary
 from(select question_rows.question_number,grading_rules.id as rule_id,grading_rules.allocated_marks,case when grading_rules.id is not null and version_row.model_answer_snapshot is not null then public.evaluate_word_efficiency_grading_rule(version_row.model_answer_snapshot,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria,version_row.model_answer_snapshot)end as model_gets
  from public.word_efficiency_questions as question_rows left join public.word_efficiency_grading_rules as grading_rules on grading_rules.question_id=question_rows.id and grading_rules.version_id=version_row.id where question_rows.version_id=version_row.id)as question_rows_inner;
 all_ok:=jsonb_array_length(question_summary)>0 and not exists(select 1 from jsonb_array_elements(question_summary)as question_item where not(question_item->>'ok')::boolean);
 return jsonb_build_object('versionId',version_row.id,'hasModelAnswer',version_row.model_answer_snapshot is not null,'ready',version_row.model_answer_snapshot is not null and all_ok,'questions',question_summary);
end $$;

revoke all on function public.submit_word_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.submit_word_efficiency_document(uuid,jsonb) to authenticated;
revoke all on function public.regrade_word_efficiency_version(uuid),public.check_word_efficiency_auto_grading(uuid) from public,anon;
grant execute on function public.regrade_word_efficiency_version(uuid),public.check_word_efficiency_auto_grading(uuid) to authenticated;

commit;

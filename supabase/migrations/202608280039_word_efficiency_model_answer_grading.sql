begin;

-- "Model Answer" grading: instead of (or alongside) hand-typing a JSON target
-- path and expected value, an admin can now actually solve the question
-- paper in the same rich document editor, save that as the version's model
-- answer, and have the app detect every resulting change versus the
-- original Working Matter. The admin then assigns each detected change to
-- the question it answers; a question is awarded full marks only when
-- EVERY assigned change is present in the student's final document exactly
-- as the admin produced it -- any missing or different change earns zero,
-- matching "if the student does the same it is right, if they do something
-- extra or not exactly what the admin did it is wrong."
--
-- This is additive: existing single-target/single-value rules keep working
-- exactly as before (additional_criteria defaults to an empty array, so the
-- "every assigned change must match" check degrades to today's single check
-- when there's nothing else assigned).

alter table public.word_efficiency_versions add column if not exists model_answer_snapshot jsonb;

create or replace function public.assert_word_efficiency_additional_criteria(criteria jsonb)
returns void language plpgsql immutable set search_path=pg_catalog,public as $$
declare item jsonb;
begin
 if jsonb_typeof(criteria)<>'array' or jsonb_array_length(criteria)>20 then raise exception 'invalid additional grading criteria'; end if;
 for item in select value from jsonb_array_elements(criteria) loop
  if jsonb_typeof(item)<>'object' or not(item?&array['target','expectedValue']) or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['target','expectedValue'])) then raise exception 'invalid grading criterion'; end if;
  if jsonb_typeof(item->'target')<>'string' or char_length(item->>'target') not between 1 and 300 then raise exception 'invalid grading criterion target'; end if;
 end loop;
end $$;

-- A CHECK constraint cannot call a function that itself raises -- it needs a
-- boolean-returning function, defined before the constraint that uses it.
create or replace function public.valid_additional_criteria_shape(criteria jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public as $$
begin
 perform public.assert_word_efficiency_additional_criteria(criteria);
 return true;
exception when others then return false;
end $$;

alter table public.word_efficiency_grading_rules add column if not exists additional_criteria jsonb not null default '[]'::jsonb;
do $$begin
 if not exists(select 1 from pg_constraint where conname='word_efficiency_grading_rules_additional_criteria_check') then
  alter table public.word_efficiency_grading_rules add constraint word_efficiency_grading_rules_additional_criteria_check check(public.valid_additional_criteria_shape(additional_criteria));
 end if;
end $$;

create or replace function public.save_word_efficiency_model_answer(p_version_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare version_record public.word_efficiency_versions%rowtype;
begin
 if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
 select * into version_record from public.word_efficiency_versions where id=p_version_id;
 if not found then raise exception 'test version unavailable'; end if;
 perform public.assert_word_efficiency_document_schema(p_document,public.word_efficiency_default_editor_capabilities());
 update public.word_efficiency_versions set model_answer_snapshot=p_document where id=p_version_id;
end $$;

create or replace function public.evaluate_word_efficiency_grading_rule(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric,additional_criteria jsonb default '[]'::jsonb)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare actual jsonb;operation_applied boolean;criterion jsonb;all_additional_matched boolean:=true;
begin
 actual:=public.word_efficiency_grading_target_value(final_document,target);
 if actual is not null and expected_value is not null and actual=expected_value then
  for criterion in select value from jsonb_array_elements(coalesce(additional_criteria,'[]'::jsonb)) loop
   if public.word_efficiency_grading_target_value(final_document,criterion->>'target') is distinct from criterion->'expectedValue' then all_additional_matched:=false;exit;end if;
  end loop;
  if all_additional_matched then return allocated_marks;end if;
 end if;
 operation_applied:=exists(select 1 from jsonb_array_elements_text(coalesce(final_document->'operations','[]'::jsonb))as operation_value where operation_value=expected_operation);
 if operation_applied then return coalesce(partial_marks,0);end if;
 return 0;
end $$;

create or replace function public.submit_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;rule record;
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
  if attempt_record.document_autosave is null or p_document is distinct from attempt_record.document_autosave then raise exception'post-deadline submission must match the last valid autosave';end if;
  perform public.assert_word_efficiency_document_schema(attempt_record.document_autosave,effective_capabilities);perform public.assert_word_efficiency_capability_changes(attempt_record.document_autosave,baseline_document,effective_capabilities);p_document:=attempt_record.document_autosave;
 end if;
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='active'and attempt_rows.final_document_snapshot is null;
 if not found then raise exception'attempt unavailable or already submitted';end if;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.word_efficiency_question_scores as question_scores set awarded_marks=public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria),grading_status='graded',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
end $$;

create or replace function public.save_word_efficiency_grading_rules(p_version_id uuid,p_rules jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare item jsonb;question_record public.word_efficiency_questions%rowtype;expected jsonb;criteria jsonb;criterion jsonb;parsed_value jsonb;
begin
 if not public.is_aal2_admin()then raise exception'not authorized';end if;
 if jsonb_typeof(p_rules)<>'array'or jsonb_array_length(p_rules)>500 then raise exception'invalid grading rules';end if;
 if exists(select 1 from public.word_efficiency_attempts where version_id=p_version_id)then raise exception'grading rules are immutable after an attempt is prepared';end if;
 delete from public.word_efficiency_grading_rules where version_id=p_version_id;
 for item in select value from jsonb_array_elements(p_rules)loop
  if jsonb_typeof(item)<>'object'or not(item?&array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks'])or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['questionNumber','exactTarget','expectedOperation','expectedValue','allocatedMarks','partialMarks','additionalCriteria']))then raise exception'invalid grading rule';end if;
  select*into question_record from public.word_efficiency_questions where version_id=p_version_id and question_number=(item->>'questionNumber')::integer;
  if not found then raise exception'grading rule question does not belong to version';end if;
  begin expected:=(item->>'expectedValue')::jsonb;exception when others then expected:=to_jsonb(item->>'expectedValue');end;
  if(item->>'allocatedMarks')::numeric>question_record.marks then raise exception'grading rule marks exceed question marks';end if;
  criteria:='[]'::jsonb;
  if item?'additionalCriteria' and jsonb_typeof(item->'additionalCriteria')='array' then
   for criterion in select value from jsonb_array_elements(item->'additionalCriteria') loop
    begin parsed_value:=(criterion->>'expectedValue')::jsonb; exception when others then parsed_value:=to_jsonb(criterion->>'expectedValue'); end;
    criteria:=criteria||jsonb_build_array(jsonb_build_object('target',criterion->>'target','expectedValue',parsed_value));
   end loop;
  end if;
  perform public.assert_word_efficiency_additional_criteria(criteria);
  insert into public.word_efficiency_grading_rules(version_id,question_id,exact_target,expected_operation,expected_value,allocated_marks,partial_marks,additional_criteria)values(p_version_id,question_record.id,btrim(item->>'exactTarget'),btrim(item->>'expectedOperation'),expected,(item->>'allocatedMarks')::numeric,case when jsonb_typeof(item->'partialMarks')='null'then null else(item->>'partialMarks')::numeric end,criteria);
 end loop;
end$$;

revoke all on function public.assert_word_efficiency_additional_criteria(jsonb),public.valid_additional_criteria_shape(jsonb),public.evaluate_word_efficiency_grading_rule(jsonb,text,text,jsonb,numeric,numeric,jsonb),public.submit_word_efficiency_document(uuid,jsonb),public.save_word_efficiency_grading_rules(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_word_efficiency_document(uuid,jsonb),public.save_word_efficiency_grading_rules(uuid,jsonb) to authenticated;
revoke all on function public.save_word_efficiency_model_answer(uuid,jsonb) from public,anon;
grant execute on function public.save_word_efficiency_model_answer(uuid,jsonb) to authenticated;

commit;

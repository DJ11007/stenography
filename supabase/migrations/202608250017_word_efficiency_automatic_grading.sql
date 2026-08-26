begin;

-- Automatic rule-based grading. Admins already author explicit grading rules
-- per question (word_efficiency_grading_rules: exact target path, expected
-- operation/value, allocated/partial marks), but nothing ever evaluated them
-- against a student's submission -- every awarded mark was 100% manual entry
-- through save_word_efficiency_grading. This adds a pure target-path
-- resolver and rule evaluator mirroring evaluateWordGradingRule in
-- lib/word-grading-rules.ts, and calls it once, right when a document is
-- finalized in submit_word_efficiency_document, to pre-populate
-- word_efficiency_question_scores.awarded_marks for any question that has a
-- rule. graded_by/graded_at are left null -- that is the signal
-- "system-graded, not yet reviewed by a human" -- and the admin grading form
-- can always overwrite the value before publishing. Questions without a rule
-- are completely unaffected and stay manual, exactly as before.

create or replace function public.word_efficiency_grading_target_value(document jsonb,target text)
returns jsonb language plpgsql immutable set search_path=pg_catalog,public as $$
declare parts text[];value jsonb;segment text;index_value integer;
begin
 if document is null or target is null or target=''then return null;end if;
 parts:=string_to_array(target,'.');
 if parts[1]='pageLayout'then
  value:=document->'pageLayout';
  for i in 2..coalesce(array_length(parts,1),1)loop if value is null then return null;end if;value:=value->parts[i];end loop;
  return value;
 end if;
 if parts[1]<>'blocks'or coalesce(array_length(parts,1),0)<3 then return null;end if;
 select block_value into value from jsonb_array_elements(coalesce(document->'blocks','[]'::jsonb))as block_value where block_value->>'id'=parts[2]limit 1;
 for i in 3..array_length(parts,1)loop
  if value is null then return null;end if;
  segment:=parts[i];
  if jsonb_typeof(value)='array'and segment~'^[0-9]+$'then index_value:=segment::integer;value:=value->index_value;
  elsif jsonb_typeof(value)='object'then value:=value->segment;
  else return null;end if;
 end loop;
 return value;
end $$;

create or replace function public.evaluate_word_efficiency_grading_rule(final_document jsonb,target text,expected_operation text,expected_value jsonb,allocated_marks numeric,partial_marks numeric)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare actual jsonb;operation_applied boolean;
begin
 actual:=public.word_efficiency_grading_target_value(final_document,target);
 if actual is not null and expected_value is not null and actual=expected_value then return allocated_marks;end if;
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
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.word_efficiency_question_scores as question_scores set awarded_marks=public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks),grading_status='graded',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
end $$;

revoke all on function public.word_efficiency_grading_target_value(jsonb,text),public.evaluate_word_efficiency_grading_rule(jsonb,text,text,jsonb,numeric,numeric),public.submit_word_efficiency_document(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.submit_word_efficiency_document(uuid,jsonb)to authenticated;

commit;

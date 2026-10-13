begin;

-- Late submissions (timer reached zero) no longer fail.
--
-- Reported on a live exam with 100+ students: when the countdown ran out, pressing
-- Submit showed an error and no result, because the server only accepted a
-- post-deadline submission whose document was byte-identical to the last autosave
-- (and refused outright more than five minutes late). A student whose last
-- autosave was a few seconds old, or who reopened the page late, was stuck.
--
-- New rule: up to and including the deadline the submitted document is used as before.
-- After the deadline the server ignores whatever the browser sends and finalises the
-- attempt from the LAST AUTOSAVE (or the untouched original if nothing was ever saved),
-- so nothing typed after the deadline can count, and every late submit succeeds and
-- is graded. The browser also submits automatically a couple of seconds before time is up.

create or replace function public.submit_word_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.word_efficiency_attempts%rowtype;effective_capabilities jsonb;baseline_document jsonb;rule record;model_document jsonb;
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
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.word_efficiency_question_scores as question_scores set awarded_marks=round(public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria,model_document)*question_scores.maximum_marks/rule.allocated_marks,2),grading_status='graded',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
 if exists(select 1 from public.word_efficiency_tests as test_rows where test_rows.id=attempt_record.test_id and test_rows.auto_publish_results)then
  perform public.word_efficiency_auto_publish_attempt(p_attempt_id);
 end if;
end $$;

create or replace function public.submit_excel_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;rule record;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() for update;
 if not found or attempt_record.status<>'active' or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception 'attempt unavailable or already submitted'; end if;
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds) then
  perform public.assert_excel_efficiency_document_schema(p_document);
 else
  p_document:=coalesce(attempt_record.document_autosave,attempt_record.original_document_snapshot);
  perform public.assert_excel_efficiency_document_schema(p_document);
 end if;
 update public.excel_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now() where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() and attempt_rows.status='active' and attempt_rows.final_document_snapshot is null;
 if not found then raise exception 'attempt unavailable or already submitted'; end if;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks from public.excel_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.excel_efficiency_question_scores as question_scores set awarded_marks=public.evaluate_excel_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks),grading_status='graded',updated_at=now() where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
end $$;

revoke all on function public.submit_word_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.submit_word_efficiency_document(uuid,jsonb) to authenticated;
revoke all on function public.submit_excel_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.submit_excel_efficiency_document(uuid,jsonb) to authenticated;

commit;

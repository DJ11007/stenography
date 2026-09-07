begin;

-- Real reported bug, reproduced live: a student attempt that reaches the
-- post-deadline grace window (started_at + selected_duration_seconds <
-- now() <= started_at + selected_duration_seconds + 300s) could NEVER
-- submit successfully, no matter what -- Submit Final Document always
-- failed with "post-deadline submission must match the last valid
-- autosave", even when clicked again immediately afterward with zero
-- further edits.
--
-- Root cause: the client's toSnapshot() (app/typing/word-efficiency/
-- [language]/[testId]/workspace/rich-document-editor.tsx) stamps every
-- snapshot it produces with `savedAt: new Date().toISOString()` --
-- including the one built fresh at the moment Submit is clicked. The
-- post-deadline path here compared that live p_document against
-- attempt_record.document_autosave with a plain `is distinct from`,
-- which is a full structural jsonb equality check. Since the submitted
-- snapshot's savedAt can never equal the autosave row's savedAt (they
-- are, by construction, generated at two different instants), this
-- comparison failed for every real document -- even one that was, in
-- every field a grading rule or the UI actually cares about, byte-for-
-- byte identical to the last autosave. There was no way to ever satisfy
-- it: retrying the submission, undoing edits, waiting -- nothing
-- produces a matching savedAt.
--
-- Fix: compare both sides with the volatile savedAt key stripped first
-- (jsonb `-` operator removes a top-level key), so the check still does
-- its real job -- rejecting a submission whose actual content diverges
-- from what was last durably autosaved -- without being defeated by a
-- timestamp neither side can ever agree on.
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
  if attempt_record.document_autosave is null or(p_document-'savedAt')is distinct from(attempt_record.document_autosave-'savedAt')then raise exception'post-deadline submission must match the last valid autosave';end if;
  perform public.assert_word_efficiency_document_schema(attempt_record.document_autosave,effective_capabilities);perform public.assert_word_efficiency_capability_changes(attempt_record.document_autosave,baseline_document,effective_capabilities);p_document:=attempt_record.document_autosave;
 end if;
 update public.word_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now()where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid()and attempt_rows.status='active'and attempt_rows.final_document_snapshot is null;
 if not found then raise exception'attempt unavailable or already submitted';end if;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks,grading_rules.additional_criteria from public.word_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.word_efficiency_question_scores as question_scores set awarded_marks=public.evaluate_word_efficiency_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks,rule.additional_criteria),grading_status='graded',updated_at=now()where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
end $$;

revoke all on function public.submit_word_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.submit_word_efficiency_document(uuid,jsonb) to authenticated;

-- Identical bug, identical fix, in the Excel Efficiency module's copy of
-- this same check (202608260024_excel_efficiency_functions.sql) -- its
-- toSnapshot()-equivalent client code stamps the same kind of live
-- savedAt onto every document too.
create or replace function public.submit_excel_efficiency_document(p_attempt_id uuid,p_document jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare attempt_record public.excel_efficiency_attempts%rowtype;rule record;
begin
 if not public.is_active_word_efficiency_student() then raise exception 'active student account required'; end if;
 select attempt_rows.* into attempt_record from public.excel_efficiency_attempts as attempt_rows where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() for update;
 if not found or attempt_record.status<>'active' or attempt_record.started_at is null or attempt_record.final_document_snapshot is not null then raise exception 'attempt unavailable or already submitted'; end if;
 if now()>attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds+300) then raise exception 'submission grace expired'; end if;
 if now()<=attempt_record.started_at+make_interval(secs=>attempt_record.selected_duration_seconds) then
  perform public.assert_excel_efficiency_document_schema(p_document);
 else
  if attempt_record.document_autosave is null or(p_document-'savedAt')is distinct from(attempt_record.document_autosave-'savedAt') then raise exception 'post-deadline submission must match the last valid autosave'; end if;
  perform public.assert_excel_efficiency_document_schema(attempt_record.document_autosave);
  p_document:=attempt_record.document_autosave;
 end if;
 update public.excel_efficiency_attempts as attempt_rows set document_autosave=p_document,final_document_snapshot=p_document,status='submitted',submitted_at=now(),updated_at=now() where attempt_rows.id=p_attempt_id and attempt_rows.student_id=auth.uid() and attempt_rows.status='active' and attempt_rows.final_document_snapshot is null;
 if not found then raise exception 'attempt unavailable or already submitted'; end if;
 for rule in select grading_rules.question_id,grading_rules.exact_target,grading_rules.expected_operation,grading_rules.expected_value,grading_rules.allocated_marks,grading_rules.partial_marks from public.excel_efficiency_grading_rules as grading_rules where grading_rules.version_id=attempt_record.version_id loop
  update public.excel_efficiency_question_scores as question_scores set awarded_marks=public.evaluate_excel_grading_rule(p_document,rule.exact_target,rule.expected_operation,rule.expected_value,rule.allocated_marks,rule.partial_marks),grading_status='graded',updated_at=now() where question_scores.attempt_id=p_attempt_id and question_scores.question_id=rule.question_id and question_scores.awarded_marks is null and question_scores.graded_by is null;
 end loop;
end $$;

revoke all on function public.submit_excel_efficiency_document(uuid,jsonb) from public,anon;
grant execute on function public.submit_excel_efficiency_document(uuid,jsonb) to authenticated;

commit;

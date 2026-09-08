begin;

-- Real bug, reproduced live: even AFTER the savedAt-stripping fix
-- (202609071537), a student attempt past its deadline still could not
-- submit -- "post-deadline submission must match the last valid
-- autosave" -- even immediately after a fresh page reload with zero
-- further edits.
--
-- Root cause: toSnapshot() (app/typing/word-efficiency/[language]/
-- [testId]/workspace/rich-document-editor.tsx) also stamps an
-- `operations` array onto every snapshot -- the running list of
-- capability-gated ribbon commands (bold, italic, fontColor, ...) the
-- student has used, read from editor.dataset.operations. Nothing ever
-- restored that dataset attribute when a snapshot was loaded back into
-- the DOM (renderSnapshot only ever set it, never read it), so a page
-- reload silently reset it to an empty string -- invisible during
-- normal editing, but fatal here: the freshly-recomputed snapshot sent
-- to Submit now carried operations:[] while attempt_record.
-- document_autosave (saved before the reload, while the student was
-- actively formatting) carried the real, non-empty list. Stripping only
-- 'savedAt' left this second volatile field to trip the same "is
-- distinct from" structural-equality check the last fix was meant to
-- neutralize.
--
-- Fixed on the client too (renderSnapshot now restores
-- editor.dataset.operations from the snapshot, making toSnapshot()
-- genuinely idempotent across a render/reload round trip), but fixing
-- it only there leaves this check exactly as fragile as before against
-- the NEXT bookkeeping field someone adds to the snapshot shape and
-- forgets to round-trip through render. Stripping 'operations' here too
-- means this check depends only on fields that actually describe
-- document content -- what every grading rule and the UI itself cares
-- about -- not on client-side telemetry.
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
  if attempt_record.document_autosave is null or(p_document-'savedAt'-'operations')is distinct from(attempt_record.document_autosave-'savedAt'-'operations')then raise exception'post-deadline submission must match the last valid autosave';end if;
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

-- Identical bug, identical fix, in the Excel Efficiency module's copy.
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
  if attempt_record.document_autosave is null or(p_document-'savedAt'-'operations')is distinct from(attempt_record.document_autosave-'savedAt'-'operations') then raise exception 'post-deadline submission must match the last valid autosave'; end if;
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

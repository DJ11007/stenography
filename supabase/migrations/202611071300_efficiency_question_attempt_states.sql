-- Word and Excel results: for each question, whether it was done correctly, attempted (but not as asked), or not
-- attempted, for the coloured circles on the result page.
--   correct      the question got its full marks
--   attempted    at least one of the question's checks that the untouched starting document fails now passes in
--                the student's document (or the question got some marks, from before whole-question marking)
--   unattempted  nothing the question checks was changed
--   pending      not marked yet
-- Only the attempt's own student, or an admin, can read it.
begin;

create or replace function public.word_efficiency_attempt_question_states(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  a record; q record; r record; c jsonb; doc jsonb; words_doc jsonb; start_doc jsonb;
  attempted boolean;states jsonb := '[]'::jsonb; state text;
begin
  select w.id, w.student_id, w.version_id, w.final_document_snapshot, v.working_matter_snapshot, v.model_answer_snapshot
    into a
    from public.word_efficiency_attempts w join public.word_efficiency_versions v on v.id = w.version_id
   where w.id = p_attempt_id;
  if not found then return null; end if;
  if a.student_id is distinct from auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  doc := a.final_document_snapshot;
  if doc is not null then
    begin words_doc := public.word_efficiency_merge_word_runs(doc); exception when others then words_doc := doc; end;
    begin start_doc := public.word_efficiency_initial_editor_document(a.working_matter_snapshot); exception when others then start_doc := null; end;
  end if;
  for q in select x.id, x.question_number, s.awarded_marks, s.maximum_marks
             from public.word_efficiency_questions x
             left join public.word_efficiency_question_scores s on s.question_id = x.id and s.attempt_id = p_attempt_id
            where x.version_id = a.version_id
            order by x.question_number loop
    if q.awarded_marks is null then state := 'pending';
    elsif q.awarded_marks >= q.maximum_marks - 0.005 then state := 'correct';
    elsif q.awarded_marks > 0 then state := 'attempted';
    else
      attempted := false;
      if doc is not null then
        for r in select * from public.word_efficiency_grading_rules g where g.version_id = a.version_id and g.question_id = q.id loop
          exit when attempted;
          if r.expected_operation = 'model-answer-match-v2' and jsonb_typeof(r.additional_criteria) = 'array' then
            for c in select value from jsonb_array_elements(r.additional_criteria) loop
              begin
                if (start_doc is null or not public.word_efficiency_criterion_matches(start_doc, c))
                   and (public.word_efficiency_criterion_matches(doc, c) or public.word_efficiency_criterion_matches(words_doc, c)) then
                  attempted := true; exit;
                end if;
              exception when others then null;
              end;
            end loop;
          else
            begin
              attempted := coalesce(public.evaluate_word_efficiency_grading_rule(doc, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks, r.additional_criteria, a.model_answer_snapshot), 0) > 0;
            exception when others then null;
            end;
          end if;
        end loop;
      end if;
      state := case when attempted then 'attempted' else 'unattempted' end;
    end if;
    states := states || jsonb_build_object('number', q.question_number, 'state', state);
  end loop;
  return states;
end $function$;
revoke all on function public.word_efficiency_attempt_question_states(uuid) from public, anon;
grant execute on function public.word_efficiency_attempt_question_states(uuid) to authenticated;

create or replace function public.excel_efficiency_attempt_question_states(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  a record; q record; r record; c jsonb; doc jsonb; start_doc jsonb;
  attempted boolean;states jsonb := '[]'::jsonb; state text;
begin
  select w.id, w.student_id, w.version_id, w.final_document_snapshot, v.working_matter_snapshot
    into a
    from public.excel_efficiency_attempts w join public.excel_efficiency_versions v on v.id = w.version_id
   where w.id = p_attempt_id;
  if not found then return null; end if;
  if a.student_id is distinct from auth.uid() and not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  doc := a.final_document_snapshot; start_doc := a.working_matter_snapshot;
  for q in select x.id, x.question_number, s.awarded_marks, s.maximum_marks
             from public.excel_efficiency_questions x
             left join public.excel_efficiency_question_scores s on s.question_id = x.id and s.attempt_id = p_attempt_id
            where x.version_id = a.version_id
            order by x.question_number loop
    if q.awarded_marks is null then state := 'pending';
    elsif q.awarded_marks >= q.maximum_marks - 0.005 then state := 'correct';
    elsif q.awarded_marks > 0 then state := 'attempted';
    else
      attempted := false;
      if doc is not null then
        for r in select * from public.excel_efficiency_grading_rules g where g.version_id = a.version_id and g.question_id = q.id loop
          exit when attempted;
          if r.expected_operation = 'rule-criteria' and jsonb_typeof(r.additional_criteria) = 'array' then
            for c in select value from jsonb_array_elements(r.additional_criteria) loop
              begin
                if (start_doc is null or not public.excel_efficiency_criterion_matches(start_doc, c)) and public.excel_efficiency_criterion_matches(doc, c) then
                  attempted := true; exit;
                end if;
              exception when others then null;
              end;
            end loop;
          else
            begin
              attempted := coalesce(public.evaluate_excel_grading_rule(doc, r.exact_target, r.expected_operation, r.expected_value, r.allocated_marks, r.partial_marks), 0) > 0;
            exception when others then null;
            end;
          end if;
        end loop;
      end if;
      state := case when attempted then 'attempted' else 'unattempted' end;
    end if;
    states := states || jsonb_build_object('number', q.question_number, 'state', state);
  end loop;
  return states;
end $function$;
revoke all on function public.excel_efficiency_attempt_question_states(uuid) from public, anon;
grant execute on function public.excel_efficiency_attempt_question_states(uuid) to authenticated;

commit;

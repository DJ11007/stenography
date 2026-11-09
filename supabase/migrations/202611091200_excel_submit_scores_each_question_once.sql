-- Load fix: submit_excel_efficiency_document marked every question TWICE (three times when the question was not full
-- marks): once for awarded_marks and again inside each WHEN of the teacher_comment CASE. On the 200-row papers one
-- marking pass costs 1.7 s (Test 4) / 0.9 s (Test 5), so one submit took ~3.4 s -- and with 100+ students submitting at
-- the same time the `authenticated` role's 8 s statement_timeout would fail submissions. Now each question is marked
-- once and the comment is chosen from that number. Marks and comments are exactly the same as before.
-- Safe to run twice.
do $mig$
declare
 def text;
 call constant text := 'public.excel_efficiency_score_question(p_document, attempt_record.version_id, q.question_id, q.maximum_marks)';
begin
 def := pg_get_functiondef('public.submit_excel_efficiency_document(uuid,jsonb)'::regprocedure);
 if position('awarded :=' in def) > 0 then raise notice 'submit_excel_efficiency_document already scores each question once'; return; end if;
 if position(call in def) = 0 then raise exception 'submit_excel_efficiency_document is not the expected version'; end if;

 def := replace(def, E' auto boolean;\nbegin', E' auto boolean; awarded numeric;\nbegin');
 def := replace(def, call, 'awarded');
 def := replace(def, E'  update public.excel_efficiency_question_scores set awarded_marks = awarded,',
   E'  awarded := ' || call || E';\n  update public.excel_efficiency_question_scores set awarded_marks = awarded,');
 if position('awarded :=' in def) = 0 or position('awarded numeric;' in def) = 0 then raise exception 'could not rewrite submit_excel_efficiency_document'; end if;
 if (length(def) - length(replace(def, 'excel_efficiency_score_question', ''))) / length('excel_efficiency_score_question') <> 1 then raise exception 'marking function should now be called once'; end if;
 execute def;
end $mig$;

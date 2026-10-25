-- Excel Efficiency: the starting sheet of an attempt is a version 3 sheet that keeps the uploaded sheet's
-- merged cells (the .xlsx reader now records them), and the student's result shows each question's part
-- marks (a, b, c), as Word Efficiency results do.
begin;

create or replace function public.excel_efficiency_initial_editor_document(m jsonb)
returns jsonb language sql immutable set search_path to 'pg_catalog', 'public' as $function$
 select jsonb_build_object('schemaVersion','3','rows',m->'rows','cols',m->'cols','cells',coalesce(m->'cells','{}'::jsonb),
  'merges',coalesce((select jsonb_agg(value) from jsonb_array_elements(case when jsonb_typeof(m->'merges')='array' then m->'merges' else '[]'::jsonb end) where jsonb_typeof(value)='string' and value#>>'{}' ~ '^[A-Z]{1,2}[0-9]{1,3}:[A-Z]{1,2}[0-9]{1,3}$'),'[]'::jsonb),
  'sheet','{}'::jsonb,'operations','[]'::jsonb,'savedAt','1970-01-01T00:00:00.000Z')
$function$;

do $mig$
declare def text; old_text text := '''feedback'',case when is_published then score_rows.teacher_comment else null end,';
new_text text := '''feedback'',case when is_published then score_rows.teacher_comment else null end,''partScores'',case when is_published and attempt_record.final_document_snapshot is not null then public.excel_efficiency_question_parts(attempt_record.final_document_snapshot,attempt_record.version_id,question_rows.id) end,';
begin
 def := pg_get_functiondef('public.get_excel_efficiency_attempt_result(uuid)'::regprocedure);
 if position('''partScores''' in def) > 0 then return; end if;
 if position(old_text in def) = 0 then raise exception 'expected feedback text not found'; end if;
 execute replace(def, old_text, new_text);
end $mig$;

commit;

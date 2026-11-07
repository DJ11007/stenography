-- Results page (Word and Excel): the (a) (b) (c)... marks under a question are shown only when the question is
-- written in sections (a) b) c) in its wording) and is marked section by section. A one-line question such as
-- Excel Test 2 Q7 "fill all the day's names from Sunday to Saturday" is marked as a whole (all or nothing), so
-- it showed (a) to (g) for nothing. The marks themselves were already right; only what the page shows changes.
-- Excel's part lines also now follow the marking: one line per section (all its checks together), and a check
-- the untouched sheet already meets does not count.
-- Safe to run twice.
begin;

create or replace function public.excel_efficiency_question_parts(p_doc jsonb, p_version uuid, p_question uuid)
returns jsonb
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  part record; r public.excel_efficiency_grading_rules; start_doc jsonb; part_count integer; sections integer;
  part_done boolean; trivial boolean; out jsonb := '[]'::jsonb;
begin
  select count(distinct g.part_label) into part_count from public.excel_efficiency_grading_rules g
   where g.version_id = p_version and g.question_id = p_question and g.part_label is not null;
  select public.efficiency_instruction_sections(q.instruction) into sections from public.excel_efficiency_questions q where q.id = p_question;
  -- Same test as the marking (excel_efficiency_score_question): not written in sections = one mark, no part lines.
  if part_count < 2 or part_count > coalesce(sections, 0) then return null; end if;
  select working_matter_snapshot into start_doc from public.excel_efficiency_versions where id = p_version;
  for part in select g.part_label, sum(g.allocated_marks) as marks from public.excel_efficiency_grading_rules g
               where g.version_id = p_version and g.question_id = p_question and g.part_label is not null
               group by g.part_label order by g.part_label loop
    part_done := true;
    for r in select * from public.excel_efficiency_grading_rules g
             where g.version_id = p_version and g.question_id = p_question and g.part_label = part.part_label loop
      trivial := false;
      begin trivial := public.excel_efficiency_rule_passes(start_doc, r); exception when others then trivial := false; end;
      continue when trivial;
      if not public.excel_efficiency_rule_passes(p_doc, r) then part_done := false; end if;
    end loop;
    out := out || jsonb_build_object('label', part.part_label, 'awarded', case when part_done then part.marks else 0 end, 'maximum', part.marks);
  end loop;
  return case when jsonb_array_length(out) = 0 then null else out end;
end $function$;

-- Word: the part lines are stored with each score; show them only for a question marked by section.
do $mig$
declare def text;
  old_text text := '''partScores'',case when is_published then score_rows.part_scores else null end';
  new_text text := '''partScores'',case when is_published and (select count(distinct g.part_label) from public.word_efficiency_grading_rules g where g.question_id = question_rows.id and g.part_label is not null) between 2 and public.efficiency_instruction_sections(question_rows.instruction) then score_rows.part_scores else null end';
begin
  def := pg_get_functiondef('public.get_word_efficiency_attempt_result(uuid)'::regprocedure);
  if position(new_text in def) > 0 then return; end if;
  if position(old_text in def) = 0 then raise exception 'expected partScores text not found in get_word_efficiency_attempt_result'; end if;
  execute replace(def, old_text, new_text);
end $mig$;

commit;

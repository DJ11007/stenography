-- Excel Efficiency results (23 Nov 2026): a question that gets part or no marks now says where to look, e.g.
--   "No marks: the required change was not found in your sheet. Check cell Q3 (your sheet shows "Hostal")."
-- It names the first checked cell (or range) that does not match, and shows only what the student's sheet has --
-- never the expected answer. A spelling slip such as "Hostal" for "Hostel" lost all of a question with no hint.
-- Applies to sheets submitted from now on; stored feedback is not changed.
create or replace function public.excel_efficiency_wrong_cell_hint(p_doc jsonb, p_question uuid)
returns text
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $function$
declare criteria jsonb; c jsonb; cell text; shown text;
begin
  for criteria in select r.additional_criteria from public.excel_efficiency_grading_rules r
                  where r.question_id = p_question and jsonb_typeof(r.additional_criteria) = 'array' loop
    for c in select e from jsonb_array_elements(criteria) e loop
      if public.excel_efficiency_criterion_matches(p_doc, c) then continue; end if;
      if c ? 'cell' then
        cell := upper(c->>'cell');
        shown := coalesce(p_doc->'cells'->cell->>'value', '');
        if shown = '' then return format(' Check cell %s: it is empty.', cell); end if;
        if (c->>'formula') = 'true' and coalesce(p_doc->'cells'->cell->>'formula', '') = '' then
          return format(' Check cell %s: it needs a formula, not a typed value.', cell);
        end if;
        return format(' Check cell %s (your sheet shows "%s").', cell, left(shown, 40));
      elsif c ? 'range' then
        return format(' Check the range %s.', c->>'range');
      elsif (c->>'rule') = 'sheet' then
        return ' Check the sheet setting this question asks for.';
      end if;
      return '';
    end loop;
  end loop;
  return '';
end
$function$;
revoke all on function public.excel_efficiency_wrong_cell_hint(jsonb, uuid) from public, anon, authenticated;

do $$
declare d text;
 old_text text := 'when awarded > 0 then ''Part marks: some of the required changes were found in your sheet.'' else ''No marks: the required change was not found in your sheet.'' end';
 new_text text := 'when awarded > 0 then ''Part marks: some of the required changes were found in your sheet.'' || public.excel_efficiency_wrong_cell_hint(p_document, q.question_id) else ''No marks: the required change was not found in your sheet.'' || public.excel_efficiency_wrong_cell_hint(p_document, q.question_id) end';
begin
  d := pg_get_functiondef('public.submit_excel_efficiency_document'::regproc);
  if position('excel_efficiency_wrong_cell_hint' in d) > 0 then return; end if;
  if position(old_text in d) = 0 then raise exception 'feedback anchor missing'; end if;
  execute replace(d, old_text, new_text);
end $$;

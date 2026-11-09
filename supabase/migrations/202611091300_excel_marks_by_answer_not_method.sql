-- Excel Efficiency marking: judge the ANSWER in the cell, not HOW the student got it.
-- Tests 4, 5 and 6 wrote every answer check as {"rule":"value", ..., "formula": true}, so a correct column made with
-- Flash Fill (Ctrl+E), by typing, copy/paste or any method other than a formula lost its marks. A question can be solved
-- in many ways (formula, drag and fill, Flash Fill, manually) and the result is the same, so the value alone is checked now.
-- (An untouched sheet still scores 0: the answer cells start empty. The stored "formula": true flags are simply ignored.)
-- Also fixes the instruction sentence that told students to use formulas only. Safe to run twice.
do $mig$
declare
 def text;
 line constant text := E'  if coalesce((p_c->>''formula'')::boolean, false) and coalesce(cell->>''formula'','''') = '''' then return false; end if;\n';
begin
 def := pg_get_functiondef('public.excel_efficiency_criterion_matches(jsonb,jsonb)'::regprocedure);
 if position(line in def) > 0 then
  def := replace(def, line, E'  -- the answer is judged by its value; how it was made (formula, Flash Fill, typing) does not matter\n');
  if position('cell->>''formula''' in def) > 0 then raise exception 'could not remove the formula requirement'; end if;
  execute def;
 else
  raise notice 'excel_efficiency_criterion_matches does not require formulas (already changed)';
 end if;
end $mig$;

update public.excel_efficiency_versions v
set instructions_markdown = replace(v.instructions_markdown,
  'Complete each task directly in the spreadsheet using formulas, not by typing the answers.',
  'Complete each task directly in the spreadsheet. Any method is fine (formula, drag and fill, Flash Fill or typing): the answer in the cells is what is checked.')
from public.excel_efficiency_tests t
where t.current_version_id = v.id and t.slug in ('efficiency-test-4', 'efficiency-test-5', 'efficiency-test-6')
  and v.instructions_markdown like '%using formulas, not by typing the answers.%';

-- Excel Auto-grading page ("Check the rules"): besides the Model Answer and untouched-sheet checks it already had, each
-- question now also reports, in plain words:
--   * written in a) b) c) sections but its checks are not split one part per section (it would be marked as a whole)
--   * no paper solution written
--   * checks a re-save on the Model Answer page can still overwrite (not marked hand-written)
-- These are warnings: they do not change "ready" (which still needs every question to pass its Model Answer and give
-- nothing for the untouched sheet).
begin;

create or replace function public.check_excel_efficiency_auto_grading(p_test_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v public.excel_efficiency_versions%rowtype; summary jsonb; all_ok boolean;
begin
  if not public.is_aal2_admin() then raise exception 'not authorized'; end if;
  select version_rows.* into v from public.excel_efficiency_tests as test_rows
    join public.excel_efficiency_versions as version_rows on version_rows.id = test_rows.current_version_id
   where test_rows.id = p_test_id;
  if not found then raise exception 'test version unavailable'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'number', x.question_number, 'instruction', x.instruction, 'marks', x.marks,
      'hasRule', x.rule_total is not null, 'allocatedMarks', x.rule_total, 'modelGets', x.model_gets, 'untouchedGets', x.untouched_gets,
      'sections', x.sections, 'parts', x.parts,
      'bySection', x.parts >= 2 and x.parts <= x.sections,
      'hasSolution', x.has_solution, 'protected', x.unprotected = 0,
      'ok', coalesce(x.rule_total is not null and x.model_gets is not null and x.rule_total >= x.marks - 0.005
                     and x.model_gets >= x.rule_total - 0.005 and x.untouched_gets < 0.005, false),
      'issues', to_jsonb(array_remove(array[
         case when x.rule_total is null then 'No checks: nobody can get marks for this question.' end,
         case when x.rule_total is not null and x.rule_total < x.marks - 0.005
              then format('The checks carry %s of the question''s %s marks.', x.rule_total, x.marks) end,
         case when x.rule_total is not null and v.model_answer_snapshot is not null and coalesce(x.model_gets, 0) < x.marks - 0.005
              then format('The Model Answer gets %s of %s: either the Model Answer is not done as the question asks, or a check asks for something the question does not.', coalesce(x.model_gets, 0), x.marks) end,
         case when x.untouched_gets >= 0.005
              then 'A check is already met by the untouched sheet, so it says nothing about what the student did.' end,
         case when x.sections >= 2 and not (x.parts >= 2 and x.parts <= x.sections)
              then format('Written in %s sections (a, b, c...) but its checks are not split one part per section, so it is marked as a whole: all or nothing.', x.sections) end,
         case when not x.has_solution then 'No paper solution written.' end,
         case when x.unprotected > 0
              then 'Solving this question again on the Model Answer page will rebuild its checks.' end
       ], null))
    ) order by x.question_number), '[]'::jsonb) into summary
  from (select q.question_number, q.instruction, q.marks,
               (select sum(r.allocated_marks) from public.excel_efficiency_grading_rules r where r.version_id = v.id and r.question_id = q.id) as rule_total,
               case when v.model_answer_snapshot is not null and exists (select 1 from public.excel_efficiency_grading_rules r where r.version_id = v.id and r.question_id = q.id)
                    then public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks) end as model_gets,
               coalesce((select sum(f.rule_marks) from public.excel_efficiency_free_parts(v.id) f where f.rule_question_id = q.id), 0) as untouched_gets,
               public.efficiency_instruction_sections(q.instruction) as sections,
               (select count(distinct r.part_label) from public.excel_efficiency_grading_rules r where r.version_id = v.id and r.question_id = q.id and r.part_label is not null)::integer as parts,
               coalesce(btrim(q.solution), '') <> '' or q.solution_image is not null as has_solution,
               (select count(*) from public.excel_efficiency_grading_rules r where r.version_id = v.id and r.question_id = q.id and r.exact_target is distinct from 'hand-written')::integer as unprotected
          from public.excel_efficiency_questions q where q.version_id = v.id) x;

  all_ok := jsonb_array_length(summary) > 0 and not exists (select 1 from jsonb_array_elements(summary) i where not (i->>'ok')::boolean);
  return jsonb_build_object('versionId', v.id, 'hasModelAnswer', v.model_answer_snapshot is not null,
                            'ready', v.model_answer_snapshot is not null and all_ok, 'questions', summary);
end $function$;

-- Stored Model Answers that were incomplete (the checks were right, the Model Answer was not), so the report above
-- shows real problems only:
-- EXCEL TEST 1 (8004a8fe): the Model Answer saved 31 Oct had only Q1, Q2 and Q6 done. Replaced with the complete
--   answer (tests/fixtures/excel-test1-model.json put on the starting sheet), which earns 25/25.
update public.excel_efficiency_versions v
   set model_answer_snapshot = v.working_matter_snapshot || jsonb_build_object(
         'cells', (v.working_matter_snapshot->'cells') || f.doc->'cells',
         'merges', (select jsonb_agg(distinct m) from (select jsonb_array_elements(coalesce(v.working_matter_snapshot->'merges', '[]'::jsonb)) m
                                                         union select jsonb_array_elements(f.doc->'merges')) z),
         'sheet', coalesce(v.working_matter_snapshot->'sheet', '{}'::jsonb) || (f.doc->'sheet'))
  from (select '{"cells":{"A1":{"bold":false,"align":"left","value":"Course details of Rajasthan High Court(LDC)","border":null,"italic":false,"formula":null,"fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General","vAlign":"middle"},"A6":{"bold":false,"align":"left","value":"Course details of Computer Anudesk","border":null,"italic":false,"formula":null,"fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General","vAlign":"middle"},"A9":{"bold":false,"align":"left","value":"Course details of I.A","border":null,"italic":false,"formula":null,"fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General","vAlign":"middle"},"A27":{"value":null,"formula":null,"bold":false,"italic":false,"underline":false,"fontColor":"FF0000","fillColor":null,"border":null,"numberFormat":"General","align":"center","fontSize":14},"A28":{"value":null,"formula":null,"bold":false,"italic":false,"underline":false,"fontColor":"FF0000","fillColor":null,"border":null,"numberFormat":"General","align":null,"fontSize":14},"A29":{"value":null,"formula":null,"bold":false,"italic":false,"underline":false,"fontColor":"FF0000","fillColor":null,"border":null,"numberFormat":"General","align":null,"fontSize":14},"A30":{"value":null,"formula":null,"bold":false,"italic":false,"underline":false,"fontColor":"FF0000","fillColor":null,"border":null,"numberFormat":"General","align":null,"fontSize":14},"A31":{"value":null,"formula":null,"bold":false,"italic":false,"underline":false,"fontColor":"FF0000","fillColor":null,"border":null,"numberFormat":"General","align":null,"fontSize":14},"B5":{"bold":true,"align":"left","value":"TOTAL COURSE FEE","border":null,"italic":false,"formula":null,"fillColor":"FF0000","fontColor":null,"underline":false,"numberFormat":"General"},"B13":{"bold":true,"align":"left","value":"TOTAL COURSE FEE","border":null,"italic":false,"formula":null,"fillColor":"FF0000","fontColor":null,"underline":false,"numberFormat":"General","fontSize":null,"fontFamily":null,"vAlign":null,"wrap":null},"B21":{"bold":true,"align":"left","value":"TOTAL COURSE FEE","border":null,"italic":false,"formula":null,"fillColor":"FF0000","fontColor":null,"underline":false,"numberFormat":"General","fontSize":null,"fontFamily":null,"vAlign":null,"wrap":null},"B26":{"bold":true,"align":"left","value":"TOTAL COURSE FEE","border":null,"italic":false,"formula":null,"fillColor":"FF0000","fontColor":null,"underline":false,"numberFormat":"General","fontSize":null,"fontFamily":null,"vAlign":null,"wrap":null},"I5":{"bold":false,"align":"left","value":6000,"border":null,"italic":false,"formula":"=SUM(I3:I4)","fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General"},"I13":{"bold":false,"align":"left","value":9999,"border":null,"italic":false,"formula":"=I11+I12","fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General"},"I21":{"bold":false,"align":"left","value":6499,"border":null,"italic":false,"formula":"=I16+I18","fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General"},"I25":{"bold":false,"align":"right","value":3000,"border":null,"italic":false,"formula":null,"fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General"},"I26":{"bold":false,"align":"left","value":7999,"border":null,"italic":false,"formula":"=SUM(I24:I25)","fillColor":null,"fontColor":null,"underline":false,"numberFormat":"General"}},"merges":["A27:L27","A28:L28","A29:L29","A30:L30","A31:L31","A1:G1","A6:G6","A9:G9"],"sheet":{"gridlines":false,"headings":false,"formulaBar":true,"printGridlines":false,"printHeadings":false,"printArea":"A1:L31","orientation":"landscape","paperSize":"Legal","margins":"Normal","header":{"right":"&[Page]"},"footer":{},"zoom":100}}'::jsonb as doc) f
 where v.id = '8004a8fe-5254-489b-b328-07d005b78029';

-- EXCEL TEST 3 (8f59bf4c): the Model Answer missed Q6 (A55:A59 font colour Blue, Accent 5, Lighter 40%) and Q9
--   (A1:L60 left aligned; its print area was already set). Those two are done on it now.
update public.excel_efficiency_versions v
   set model_answer_snapshot = jsonb_set(v.model_answer_snapshot, '{cells}', (
         select jsonb_object_agg(c.key,
                  case when c.key ~ '^[A-L]([1-9]|[1-5][0-9]|60)$' then c.value || '{"align":"left"}'::jsonb else c.value end
                  || case when c.key in ('A55', 'A56', 'A57', 'A58', 'A59') then '{"fontColor":"8EAADB"}'::jsonb else '{}'::jsonb end)
           from jsonb_each(v.model_answer_snapshot->'cells') c))
 where v.id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and v.model_answer_snapshot ? 'cells';

commit;

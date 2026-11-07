-- EXCEL TEST 3 (8f59bf4c), Q9: "indent 0.3" cannot be done in Excel 2013 (the Indent box takes whole numbers
-- only; 0.3 gives "Integer is not valid."). The admin changed the question to indent 3 (7 Nov 2026).
-- Edited in place (no new version) so the hand-written marking checks and solutions are kept.
-- Attempts already submitted keep their marks; new attempts get the new wording and check.
-- Safe to run twice.
begin;

update public.excel_efficiency_questions
   set instruction = 'Apply complete formatting to above range A1:L60, Horizontal Left indent 3 then set it as print area.',
       solution = E'1. Select **A1:L60**.\n2. Press **Ctrl+1** (Format Cells) → **Alignment** tab → Horizontal: **Left (Indent)** → Indent: **3** → **OK**.\n   (Or HOME → **Align Left**, then **Increase Indent** three times.)\n3. Keep A1:L60 selected → PAGE LAYOUT → **Print Area ▾** → **Set Print Area**.\n\nChecked: A1:L60 left aligned with indent 3, and the print area A1:L60.'
 where version_id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and question_number = 9;

update public.excel_efficiency_grading_rules r
   set additional_criteria = '[{"rule":"cells","range":"A1:L60","props":{"align":["left"],"indent":[3]}},{"rule":"sheet","path":"printArea","in":["A1:L60"]}]'::jsonb,
       exact_target = 'hand-written'
  from public.excel_efficiency_questions q
 where q.id = r.question_id and q.version_id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and q.question_number = 9;

-- The Model Answer: A1:L60 get indent 3 too.
update public.excel_efficiency_versions v
   set model_answer_snapshot = jsonb_set(v.model_answer_snapshot, '{cells}', (
         select jsonb_object_agg(c.key,
                  case when c.key ~ '^[A-L]([1-9]|[1-5][0-9]|60)$' then c.value || '{"indent":3}'::jsonb else c.value end)
           from jsonb_each(v.model_answer_snapshot->'cells') c))
 where v.id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' and v.model_answer_snapshot ? 'cells';

-- Check: the Model Answer still earns full marks on Q9 and on the whole paper.
select q.question_number,
       public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks) as model_gets, q.marks
  from public.excel_efficiency_versions v join public.excel_efficiency_questions q on q.version_id = v.id
 where v.id = '8f59bf4c-117a-4b87-ac19-19dc6b2125bc' order by q.question_number;

commit;

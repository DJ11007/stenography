-- English Excel Efficiency Test 8 (22 Nov 2026): Q6, Q7 and Q8 asked for 2-3 COUNTIF / COUNTIFS cells each, too
-- long for a 10-minute paper. Each now asks for one cell: Q6 T4 (passed), Q7 T6 (typing speed >= 35), Q8 T9 (girls
-- who passed). The question, its marking rule and its solution change; the labels of the dropped cells (S5, S7, S8,
-- S10) go from the starting sheet and the model answer, and the dropped answers (T5, T7, T8, T10) from the model
-- answer. Marks stay 2 each. Submitted attempts keep their marks.
do $$
declare v uuid := '94c31455-9e90-4f96-ae69-6359ddadae5d';
begin
  if not exists (select 1 from public.excel_efficiency_versions where id = v) then return; end if;

  update public.excel_efficiency_questions set
    instruction = 'Using COUNTIF, in cell T4 count the students whose Result is "PASS".',
    solution = E'**=COUNTIF(range, criteria)** counts the cells of a range that meet one condition.\n1. **T4**: =COUNTIF(M2:M201,"PASS") → 157.\n\n(T4 also works as =COUNTIF(K2:K201,">=160").)\n\nChecked: T4, with a formula.'
  where version_id = v and question_number = 6;
  update public.excel_efficiency_questions set
    instruction = 'Using COUNTIF with a sign, in cell T6 count the students with Typing Speed 35 WPM or more (>=35).',
    solution = E'In COUNTIF the sign and the number go together inside double quotes.\n1. **T6**: =COUNTIF(J2:J201,">=35") → 44.\n\nChecked: T6, with a formula.'
  where version_id = v and question_number = 7;
  update public.excel_efficiency_questions set
    instruction = 'Using COUNTIFS (more than one condition), in cell T9 count the girls (F) whose Result is PASS.',
    solution = E'**=COUNTIFS(range1, criteria1, range2, criteria2, ...)** counts the rows that meet **all** the conditions. Every range must have the same size.\n1. **T9**: =COUNTIFS(C2:C201,"F",M2:M201,"PASS") → 62.\n\nCOUNTIFS, SUMIFS and AVERAGEIFS all work in Excel 2013.\n\nChecked: T9, with a formula.'
  where version_id = v and question_number = 8;

  update public.excel_efficiency_grading_rules g set additional_criteria = '[{"cell":"T4","rule":"value","equals":157,"formula":true}]'::jsonb
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 6;
  update public.excel_efficiency_grading_rules g set additional_criteria = '[{"cell":"T6","rule":"value","equals":44,"formula":true}]'::jsonb
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 7;
  update public.excel_efficiency_grading_rules g set additional_criteria = '[{"cell":"T9","rule":"value","equals":62,"formula":true}]'::jsonb
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 8;

  update public.excel_efficiency_versions set
    working_matter_snapshot = jsonb_set(working_matter_snapshot, '{cells}', (working_matter_snapshot->'cells') - array['S5','S7','S8','S10']),
    model_answer_snapshot = case when model_answer_snapshot is null then null
      else jsonb_set(model_answer_snapshot, '{cells}', (model_answer_snapshot->'cells') - array['S5','S7','S8','S10','T5','T7','T8','T10']) end
  where id = v;
end $$;

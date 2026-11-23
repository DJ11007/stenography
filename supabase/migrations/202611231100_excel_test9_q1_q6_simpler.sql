-- English Excel Efficiency Test 9 (23 Nov 2026): Q1-Q6 made shorter and easier, one function idea each.
--  Q1  VLOOKUP only (was VLOOKUP inside IFERROR). Peon and Driver were missing from the Allowance table, which is why
--      IFERROR was needed; they are added with 0, so =VLOOKUP(D2,$S$6:$T$12,2,FALSE) gives every row's Allowance --
--      the same values as before, so Gross Salary, Rank and the other answers do not change.
--  Q2  unchanged (RANK).
--  Q3  LEFT only: the first 3 letters of the Department (was UPPER + LEFT + RIGHT + &).
--  Q4  SUMIF only: Gross of the Education department in Q2 (the SUMIFS part in Q3 and its label are removed).
--  Q5  MATCH with MAX: the position of the highest Gross Salary in L2:L201 (was INDEX + MATCH + MAX).
--  Q6  VLOOKUP for Q9 only (the Q10 part and its label are removed).
-- Marks stay 2 each. Existing marks are left as they are; new attempts use these questions.
do $$
declare v uuid; ws jsonb; ms jsonb; r integer; c text; n_rules jsonb := '[]'::jsonb;
begin
  select t.current_version_id into v from public.excel_efficiency_tests t where t.language = 'English' and t.title = 'EFFICIENCY TEST 9';
  if v is null then return; end if;
  select working_matter_snapshot, model_answer_snapshot into ws, ms from public.excel_efficiency_versions where id = v;

  -- The Allowance table gets Peon and Driver (0), in the starting sheet and the model answer.
  ws := jsonb_set(ws, '{cells,S11}', (ws->'cells'->'S10') || '{"value":"Peon"}');
  ws := jsonb_set(ws, '{cells,T11}', (ws->'cells'->'T10') || '{"value":0}');
  ws := jsonb_set(ws, '{cells,S12}', (ws->'cells'->'S10') || '{"value":"Driver"}');
  ws := jsonb_set(ws, '{cells,T12}', (ws->'cells'->'T10') || '{"value":0}');
  ms := jsonb_set(ms, '{cells,S11}', (ms->'cells'->'S10') || '{"value":"Peon"}');
  ms := jsonb_set(ms, '{cells,T11}', (ms->'cells'->'T10') || '{"value":0}');
  ms := jsonb_set(ms, '{cells,S12}', (ms->'cells'->'S10') || '{"value":"Driver"}');
  ms := jsonb_set(ms, '{cells,T12}', (ms->'cells'->'T10') || '{"value":0}');

  -- Labels: Q3 and Q10 answers are gone; Q6 now asks for a position.
  ws := jsonb_set(ws, '{cells}', (ws->'cells') - array['P3', 'P10']);
  ms := jsonb_set(ms, '{cells}', (ms->'cells') - array['P3', 'P10', 'Q3', 'Q10']);
  ws := jsonb_set(ws, '{cells,P6,value}', '"Position of the highest Gross Salary (in L2:L201)"');
  ms := jsonb_set(ms, '{cells,P6,value}', '"Position of the highest Gross Salary (in L2:L201)"');

  -- Model answer: K with plain VLOOKUP, N with LEFT, Q6 with MATCH + MAX.
  for r in 2..201 loop
    ms := jsonb_set(ms, array['cells', 'K' || r, 'formula'], to_jsonb('=VLOOKUP(D' || r || ',$S$6:$T$12,2,FALSE)'));
    c := left(ws->'cells'->('C' || r)->>'value', 3);
    ms := jsonb_set(ms, array['cells', 'N' || r], coalesce(ms->'cells'->('N' || r), '{}'::jsonb) || jsonb_build_object('formula', '=LEFT(C' || r || ',3)', 'value', c));
    n_rules := n_rules || jsonb_build_array(jsonb_build_object('cell', 'N' || r, 'rule', 'value', 'equals', c, 'formula', true));
  end loop;
  ms := jsonb_set(ms, '{cells,Q6}', (ms->'cells'->'Q6') || '{"formula":"=MATCH(MAX(L2:L201),L2:L201,0)","value":88}');

  update public.excel_efficiency_versions set working_matter_snapshot = ws, model_answer_snapshot = ms where id = v;

  update public.excel_efficiency_questions set
    instruction = 'In column K (Allowance) find the Allowance of each employee''s Post using VLOOKUP. The Allowance table is in S5:T12: VLOOKUP looks for the Post (column D) in the first column of the table and gives the Allowance from its 2nd column.',
    solution = E'**VLOOKUP(what to find, where to look, which column, FALSE)** looks for a value in the FIRST column of a table and gives the value from another column of the same row.\n- what to find: the Post, **D2**\n- where to look: the table **$S$6:$T$12** (with $, so it does not move when filled down)\n- which column: **2** (the Allowance is the table''s 2nd column)\n- **FALSE**: find the exact Post\n1. Click **K2** and type **=VLOOKUP(D2,$S$6:$T$12,2,FALSE)** → Enter (LDC → 2000).\n2. Double-click the fill handle to fill down to **K201**.\n\nChecked: the Allowance in every cell K2:K201.'
  where version_id = v and question_number = 1;

  update public.excel_efficiency_questions set
    instruction = 'In column N (Emp Code) write the first 3 letters of the Department using the LEFT function (for example Revenue → "Rev").',
    solution = E'**LEFT(text, n)** takes the first n letters of a text.\n1. Click **N2** and type **=LEFT(C2,3)** → Enter (Revenue → "Rev").\n2. Double-click the fill handle to fill down to **N201**.\n\nChecked: the first 3 letters of the Department in every cell N2:N201.'
  where version_id = v and question_number = 3;
  update public.excel_efficiency_grading_rules g set additional_criteria = n_rules
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 3;

  update public.excel_efficiency_questions set
    instruction = 'In Q2 find the total Gross Salary of the Education department using SUMIF.',
    solution = E'**SUMIF(range to check, condition, range to add)** adds the values that meet one condition.\n1. Click **Q2** and type **=SUMIF(C2:C201,"Education",L2:L201)** → Enter → 2264120.\n\nChecked: Q2, with a formula.'
  where version_id = v and question_number = 4;
  update public.excel_efficiency_grading_rules g set additional_criteria = '[{"cell":"Q2","rule":"value","equals":2264120,"formula":true}]'::jsonb
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 4;

  update public.excel_efficiency_questions set
    instruction = 'In Q6 find the position (in the list L2:L201) of the highest Gross Salary using MATCH and MAX.',
    solution = E'**MAX(range)** gives the highest value. **MATCH(value, range, 0)** gives the POSITION of that value in the range (0 = exact match).\n1. Click **Q6** and type **=MATCH(MAX(L2:L201),L2:L201,0)** → Enter → 88 (the 88th employee in the list, row 89).\n\nChecked: Q6, with a formula.'
  where version_id = v and question_number = 5;
  update public.excel_efficiency_grading_rules g set additional_criteria = '[{"cell":"Q6","rule":"value","equals":88,"formula":true}]'::jsonb
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 5;

  update public.excel_efficiency_questions set
    instruction = 'In Q9 find the Gross Salary of employee RJ26150 using VLOOKUP.',
    solution = E'Count the columns of the table from its first column: A = 1, B = 2, C = 3 ... L = 12 (Gross Salary).\n1. Click **Q9** and type **=VLOOKUP("RJ26150",A2:L201,12,FALSE)** → Enter → 50860.\n\nAlways write FALSE (exact match) when looking up an ID or a name.\n\nChecked: Q9, with a formula.'
  where version_id = v and question_number = 6;
  update public.excel_efficiency_grading_rules g set additional_criteria = '[{"cell":"Q9","rule":"value","equals":50860,"formula":true}]'::jsonb
  from public.excel_efficiency_questions q where g.question_id = q.id and q.version_id = v and q.question_number = 6;
end $$;

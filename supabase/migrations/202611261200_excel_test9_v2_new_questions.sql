-- English EXCEL EFFICIENCY TEST 9, version 2 (26 Nov 2026; built by scripts/build-excel-test9-v2.mjs, do not edit by hand).
-- The admin: "all questions should be different, and the formulas should be 2 or 3 -- but different questions from the
-- other papers". Version 1 asked 6 formulas and 9 formatting questions the other Excel papers ask too. Version 2 asks:
--   3 formulas, each with a function no other Excel paper uses: MONTH (Joining Month), ROUNDUP (Bonus), LOWER;
--   12 tools no other paper asks for: Duplicate Values and Data Bars (Conditional Formatting), a Comment, Hide Column,
--   Row Height, Column Width, Text Orientation (Angle Counterclockwise), Narrow margins + Center on page, Scale to Fit
--   (1 page wide), Double Underline, Data Validation (whole number between), Freeze First Column.
-- Same 200 employees. A NEW version: students' earlier attempts keep version 1 and their marks. Results are published
-- automatically. Every check was run through the real marking (tests/excel-test9-v2-rules-runtime.test.mjs): the
-- solved sheet passes each one, the untouched sheet none. Safe to run twice (skipped once TEST 9 is on version 2).
begin;

create or replace function pg_temp.excel_cell(v jsonb, f text default null, style jsonb default '{}'::jsonb) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) || style $f$;

do $mig$
declare
 old record; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb; ws jsonb; ms jsonb; r integer; k text; t text;
 vals jsonb := $q${"K":[2000,0,4000,2500,0,3000,4000,3000,2500,3000,3500,3000,2000,2000,2000,0,4000,0,2000,2500,4000,4000,4000,3500,0,0,2500,0,3000,2000,0,0,2500,4000,2000,3000,3500,2500,4000,2500,2000,0,2000,0,0,2000,0,0,0,2000,3500,2000,2500,2000,2500,3500,0,2500,0,3500,2000,3000,2000,2500,2000,2500,3000,4000,0,3500,0,4000,2500,0,3500,2000,2500,0,2000,0,2000,0,0,2500,4000,2000,2000,4000,2000,0,0,2500,2000,3000,2000,3500,3500,2500,2500,2500,0,2500,4000,2500,3000,2500,0,0,3000,2000,2500,0,2000,2000,2000,3500,2000,2000,0,0,0,4000,3500,2000,3000,2500,3500,0,4000,4000,3500,0,3500,2500,2500,0,2000,0,4000,3000,2000,0,0,2000,0,2500,3000,2000,3000,2500,0,2000,3000,2000,2000,2500,2000,0,0,2500,2500,3000,2500,2500,3500,2000,2000,2000,0,0,0,0,2000,0,2000,3000,3000,2500,3000,2000,0,2000,2000,2500,2000,2000,2000,3000,4000,2500,0,2500,2500,2000,2000,0,2000,3500,3000,2500],"M":[7,3,7,7,11,9,8,12,10,10,2,10,3,10,1,5,6,6,6,1,1,10,6,8,11,2,3,2,9,5,10,6,8,4,7,5,9,3,2,5,8,4,3,11,2,7,12,10,1,11,12,4,8,6,10,9,4,9,12,3,8,6,6,4,9,5,3,6,1,8,9,4,5,5,10,1,6,5,9,12,9,2,4,12,8,7,3,4,6,1,5,11,9,3,1,1,8,9,2,11,8,11,10,2,7,1,7,7,6,3,2,7,8,1,3,3,6,6,10,3,6,1,10,3,6,6,10,7,2,6,4,4,9,9,4,9,11,6,8,3,11,9,4,9,5,6,10,1,6,10,7,7,6,1,6,9,8,5,6,4,2,4,5,4,1,6,1,12,5,3,2,11,5,3,12,3,12,3,2,7,2,11,7,9,3,12,1,4,6,5,11,2,7,6,9,7,1,7,6,6],"N":[2041,1550,3499,2774,1916,2450,2958,2216,2733,2466,3491,2066,1866,2141,1941,1683,3199,1766,2141,2383,3624,3407,3541,3349,1575,1725,2225,1550,2008,1733,1725,1642,2816,3516,1983,2016,3407,2541,2958,2799,1875,1858,2166,1592,1575,1758,1650,1850,1608,2041,3041,1941,2674,2025,2441,3341,1583,2383,1850,2983,1941,2091,2041,2808,2091,2574,2075,3524,1766,3224,1550,2974,2258,1625,3299,2116,2441,1750,1850,1642,2158,1750,1517,2574,3707,1841,1833,3957,1941,1933,1750,2225,2041,2066,2150,3149,3108,2716,2366,2416,1708,2508,3407,2516,2016,2658,1691,1950,2191,2125,2241,1916,1933,2133,1841,3416,1766,1950,1475,1617,1808,3741,2916,1975,2300,2549,3341,1933,3058,3466,3283,1508,3091,2508,2441,1508,1975,1691,3424,2016,2141,1925,1583,1966,1525,2766,2416,2100,2391,2599,1675,2025,2008,2141,1783,2733,1800,1816,1933,2516,2300,2033,2533,2641,3174,2125,1900,1900,1533,1700,1483,1950,2133,1567,1775,2200,2166,2716,2283,2116,1933,1850,1925,2599,1941,1800,2150,2233,3341,2574,1650,2241,2416,2150,2133,1508,2008,3008,2258,2708],"O":["revenue","education","revenue","health","health","health","panchayati raj","revenue","education","education","education","revenue","education","finance","education","panchayati raj","education","health","police","health","finance","health","education","revenue","education","education","education","health","education","revenue","health","health","police","education","police","revenue","health","police","revenue","revenue","revenue","revenue","revenue","education","revenue","health","education","police","health","education","panchayati raj","health","revenue","police","education","revenue","panchayati raj","panchayati raj","education","health","finance","finance","education","education","education","police","education","health","health","education","education","health","education","panchayati raj","revenue","police","finance","police","finance","revenue","revenue","education","police","revenue","health","health","police","finance","health","education","education","health","revenue","police","police","panchayati raj","finance","panchayati raj","finance","education","revenue","police","health","education","revenue","police","education","health","health","police","education","education","police","finance","panchayati raj","panchayati raj","health","health","education","panchayati raj","health","police","health","health","education","police","education","panchayati raj","panchayati raj","revenue","police","education","education","revenue","finance","revenue","police","panchayati raj","police","revenue","revenue","health","revenue","finance","education","panchayati raj","police","police","health","health","health","revenue","health","health","police","education","finance","education","revenue","education","education","revenue","health","police","health","panchayati raj","education","health","education","health","health","finance","health","finance","panchayati raj","health","health","finance","finance","police","police","education","education","education","revenue","education","education","panchayati raj","police","health","revenue","health","revenue","revenue","education","education","revenue","education","finance","revenue"]}$q$::jsonb;
 asked jsonb := $q${"M":"=MONTH(E#)","N":"=ROUNDUP(F#*$T$3,0)","O":"=LOWER(C#)"}$q$::jsonb;
 questions jsonb := $q$[{"n":1,"marks":2,"text":"In column M (Joining Month) find the month number (1 to 12) of every employee's Joining Date (column E) using the MONTH function.","solution":"**MONTH(date)** gives the month of a date as a number from 1 (January) to 12 (December).\n1. Click **M2** and type **=MONTH(E2)** → Enter.\n2. Double-click the fill handle to fill down to **M201**.\n\nChecked: the month in every cell M2:M201.","criteria":[{"column":"M"}]},{"n":2,"marks":2,"text":"In column N (Bonus) find the Bonus = Basic Pay × Bonus Rate given in cell T3, rounded UP to a whole rupee with the ROUNDUP function. Use an absolute reference ($T$3).","solution":"**ROUNDUP(number, digits)** always rounds up (away from zero); with 0 digits it gives the next whole number.\n1. Click **N2** and type **=ROUNDUP(F2*$T$3,0)** → Enter.\n2. Double-click the fill handle to fill down to **N201**.\n\nChecked: the Bonus in every cell N2:N201.","criteria":[{"column":"N"}]},{"n":3,"marks":2,"text":"In column O (Dept (small letters)) write every employee's Department in small letters using the LOWER function (for example Revenue → \"revenue\").","solution":"**LOWER(text)** changes every letter to a small letter.\n1. Click **O2** and type **=LOWER(C2)** → Enter.\n2. Double-click the fill handle to fill down to **O201**.\n\nChecked: the exact text (small letters) in every cell O2:O201.","criteria":[{"column":"O","caseSensitive":true}]},{"n":4,"marks":2,"text":"With Conditional Formatting highlight the Duplicate Values in the Mobile No column G2:G201 with Light Red Fill with Dark Red Text.","solution":"1. Select **G2:G201**.\n2. HOME → **Conditional Formatting ▾** → **Highlight Cells Rules** → **Duplicate Values…**.\n3. Keep **Duplicate** and **Light Red Fill with Dark Red Text** → **OK**.\n\nChecked: a Duplicate Values rule on G2:G201.","criteria":[{"rule":"sheet","path":"conditionalFormats","includes":{"range":"G2:G201","type":"duplicate","style":"lightRedDarkRed"}}]},{"n":5,"marks":2,"text":"With Conditional Formatting apply Blue Data Bars (Gradient Fill) to the Basic Pay column F2:F201.","solution":"1. Select **F2:F201**.\n2. HOME → **Conditional Formatting ▾** → **Data Bars** → Gradient Fill → **Blue Data Bar**.\n\nChecked: a blue Data Bars rule on F2:F201.","criteria":[{"rule":"sheet","path":"conditionalFormats","includes":{"range":"F2:F201","type":"dataBar","style":"blueBar"}}]},{"n":6,"marks":1,"text":"Insert a Comment on cell A1 with the text \"Unique ID\".","solution":"1. Right-click **A1** → **Insert Comment** (or REVIEW → **New Comment**).\n2. Type **Unique ID** and click outside the comment.\n\nChecked: A1 has the comment \"Unique ID\".","criteria":[{"rule":"cells","range":"A1","props":{"comment":["Unique ID"]}}]},{"n":7,"marks":1,"text":"Hide the Mobile No column G.","solution":"1. Right-click the column letter **G** → **Hide** (or HOME → **Format ▾** → Hide & Unhide → **Hide Columns**).\n\nChecked: column G is hidden.","criteria":[{"rule":"sheet","path":"hiddenCols","includes":6}]},{"n":8,"marks":1,"text":"Set the Row Height of the heading row (row 1) to 30.","solution":"1. Right-click the row number **1** → **Row Height…** (or HOME → **Format ▾** → **Row Height…**).\n2. Type **30** → **OK**.\n\nChecked: row 1 is 30 high.","criteria":[{"rule":"sheet","path":"rowHeights.1","equals":30}]},{"n":9,"marks":1,"text":"Set the Column Width of the Employee Name column B to 30.","solution":"1. Right-click the column letter **B** → **Column Width…** (or HOME → **Format ▾** → **Column Width…**).\n2. Type **30** → **OK**.\n\nChecked: column B is 30 wide.","criteria":[{"rule":"sheet","path":"colWidths.B","equals":30}]},{"n":10,"marks":2,"text":"Rotate the text of the heading row A1:O1 with Orientation → Angle Counterclockwise.","solution":"1. Select **A1:O1**.\n2. HOME → **Orientation (ab↗) ▾** → **Angle Counterclockwise**.\n\nChecked: every heading cell is turned 45°.","criteria":[{"rule":"cells","range":"A1:O1","props":{"rotate":[45]}}]},{"n":11,"marks":2,"text":"Set the page Margins to Narrow and center the sheet Horizontally on the page (PAGE LAYOUT → Margins → Custom Margins → Center on page).","solution":"1. PAGE LAYOUT → **Margins ▾** → **Narrow**.\n2. PAGE LAYOUT → **Margins ▾** → **Custom Margins…** → Center on page: tick **Horizontally** → **OK**.\n\nChecked: narrow margins, centred horizontally.","criteria":[{"rule":"sheet","path":"margins","equals":"Narrow"},{"rule":"sheet","path":"centerHorizontally","equals":true}]},{"n":12,"marks":1,"text":"With Scale to Fit set the Width to 1 page (PAGE LAYOUT tab), so the sheet prints one page wide.","solution":"1. PAGE LAYOUT → Scale to Fit group → **Width ▾** → **1 page**.\n\nChecked: the sheet is set to 1 page wide.","criteria":[{"rule":"sheet","path":"fitWidth","equals":1}]},{"n":13,"marks":2,"text":"Apply Double Underline to the heading row A1:O1.","solution":"1. Select **A1:O1**.\n2. HOME → **Underline ▾** → **Double Underline**.\n\nChecked: every heading cell has a double underline.","criteria":[{"rule":"cells","range":"A1:O1","props":{"underline":[true],"underlineStyle":["double"]}}]},{"n":14,"marks":2,"text":"With Data Validation allow only a Whole number between 15000 and 60000 in the Basic Pay column F2:F201.","solution":"1. Select **F2:F201**.\n2. DATA → **Data Validation**.\n3. Allow **Whole number**, Data **between**, Minimum **15000**, Maximum **60000** → **OK**.\n\nChecked: the validation rule on F2:F201.","criteria":[{"rule":"sheet","path":"validations","includes":{"range":"F2:F201","type":"whole","operator":"between","value1":"15000","value2":"60000"}}]},{"n":15,"marks":2,"text":"Freeze the First Column of the sheet (VIEW → Freeze Panes).","solution":"1. VIEW → **Freeze Panes ▾** → **Freeze First Column**.\n\nChecked: column A stays visible while scrolling right.","criteria":[{"rule":"sheet","path":"freeze","equals":"B1"}]}]$q$::jsonb;
 headers jsonb := $q$["Emp ID","Employee Name","Department","Post","Joining Date","Basic Pay","Mobile No","Name (Proper)","Joining Year","DA","Allowance","Gross Salary","Joining Month","Bonus","Dept (small letters)"]$q$::jsonb;
 sheet jsonb := $q${"conditionalFormats":[{"range":"G2:G201","type":"duplicate","style":"lightRedDarkRed"},{"range":"F2:F201","type":"dataBar","style":"blueBar"}],"hiddenCols":[6],"rowHeights":{"1":30},"colWidths":{"B":30},"margins":"Narrow","centerHorizontally":true,"fitWidth":1,"validations":[{"range":"F2:F201","type":"whole","operator":"between","value1":"15000","value2":"60000"}],"freeze":"B1"}$q$::jsonb;
begin
 select v.* into old from public.excel_efficiency_tests tt join public.excel_efficiency_versions v on v.id = tt.current_version_id
  where tt.language = 'English' and tt.title = 'EFFICIENCY TEST 9';
 if old.id is null then raise exception 'English EXCEL EFFICIENCY TEST 9 not found'; end if;
 if exists (select 1 from public.excel_efficiency_questions where version_id = old.id and question_number = 1 and instruction = questions->0->>'text') then
  raise notice 'EXCEL EFFICIENCY TEST 9 already has version 2'; return;
 end if;

 -- the starting sheet
 ws := old.working_matter_snapshot;
 ws := jsonb_set(ws, '{cells}', (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(ws->'cells') e where e.key !~ '^[PQ][0-9]+$'));
 for r in 0..jsonb_array_length(headers) - 1 loop
  k := chr(65 + r) || '1';
  ws := jsonb_set(ws, array['cells', k], coalesce(ws->'cells'->k, pg_temp.excel_cell('null'::jsonb)) || jsonb_build_object('value', headers->r));
 end loop;
 ws := jsonb_set(ws, '{cells,S3}', pg_temp.excel_cell('"Bonus Rate"'));
 ws := jsonb_set(ws, '{cells,T3}', pg_temp.excel_cell('0.0833', null, '{"numberFormat":"Percentage","decimals":2}'));
 for r in 2..201 loop
  ws := jsonb_set(ws, array['cells', 'K' || r], pg_temp.excel_cell(vals->'K'->(r - 2), '=VLOOKUP(D' || r || ',$S$6:$T$12,2,FALSE)', '{"fillColor":"D9D9D9"}'));
 end loop;
 perform public.assert_excel_efficiency_working_matter(ws);

 -- the solved sheet
 ms := jsonb_build_object('schemaVersion', '3', 'rows', ws->'rows', 'cols', ws->'cols', 'cells', ws->'cells', 'merges', '[]'::jsonb, 'sheet', sheet,
   'operations', '[]'::jsonb, 'savedAt', '2026-11-26T00:00:00.000Z');
 for t in select jsonb_object_keys(asked) loop
  for r in 2..201 loop
   ms := jsonb_set(ms, array['cells', t || r], pg_temp.excel_cell(vals->t->(r - 2), replace(asked->>t, '#', r::text)));
  end loop;
 end loop;
 for r in 0..jsonb_array_length(headers) - 1 loop
  k := chr(65 + r) || '1';
  ms := jsonb_set(ms, array['cells', k], (ms->'cells'->k) || $q${"underline":true,"underlineStyle":"double","rotate":45}$q$::jsonb);
 end loop;
 ms := jsonb_set(ms, '{cells,A1}', (ms->'cells'->'A1') || '{"comment":"Unique ID"}');
 perform public.assert_excel_efficiency_document_schema(ms);

 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (old.test_id, (select max(version_number) + 1 from public.excel_efficiency_versions where test_id = old.test_id), old.title, old.language,
   'MONTH, ROUNDUP and LOWER, plus Conditional Formatting, Comment, Hide, Row Height, Column Width, Orientation, Page Setup, Double Underline, Data Validation and Freeze First Column on 200 employees',
   $q$1. Carefully read the instructions and solve the questions accordingly.
2. All questions are mandatory.
3. The sheet has 200 employees (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.
4. Columns **H to L** (Name Proper, Joining Year, DA, Allowance, Gross Salary) are already filled in for you (light grey background).
5. **Maximum marks** and question-wise marks are shown with the questions.
6. Complete each task directly in the spreadsheet. Any method is fine: the result in the sheet is what is checked.$q$, 15, 25, old.duration_options, old.passing_marks, ws, old.created_by, old.delivery_pdf, old.delivery_onscreen, old.student_question_toggle, ms)
 returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = (select version_number from public.excel_efficiency_versions where id = v_id),
   auto_publish_results = true where id = old.test_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if c ? 'column' then
    crit := crit || (select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', (c->>'column') || (i + 2), 'formula', true, 'equals', vals->(c->>'column')->i)
      || case when coalesce((c->>'caseSensitive')::boolean, false) then '{"caseSensitive":true}'::jsonb else '{}'::jsonb end order by i)
      from generate_series(0, 199) i);
   else crit := crit || jsonb_build_array(c);
   end if;
  end loop;
  insert into public.excel_efficiency_questions (version_id, question_number, instruction, marks, display_order, solution)
  values (v_id, (item->>'n')::int, item->>'text', (item->>'marks')::numeric, (item->>'n')::int, item->>'solution') returning id into q_id;
  insert into public.excel_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, additional_criteria)
  values (v_id, q_id, 'hand-written', 'rule-criteria', 'null'::jsonb, (item->>'marks')::numeric, crit);
 end loop;
end $mig$;

-- Check: the solved sheet scores every question's full marks (25 in all), the untouched sheet 0.
select q.question_number, q.marks,
  public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks) as model,
  public.excel_efficiency_score_question(public.excel_efficiency_initial_editor_document(v.working_matter_snapshot), v.id, q.id, q.marks) as untouched
from public.excel_efficiency_tests t join public.excel_efficiency_versions v on v.id = t.current_version_id
join public.excel_efficiency_questions q on q.version_id = v.id where t.language = 'English' and t.title = 'EFFICIENCY TEST 9' order by q.question_number;

commit;

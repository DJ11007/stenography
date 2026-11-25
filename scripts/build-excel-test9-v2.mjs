// Builds EXCEL EFFICIENCY TEST 9, version 2 (26 Nov 2026). The admin: "all questions should be different, and the
// formulas should be 2 or 3 -- but different questions from the other papers". Version 1 asked 6 formulas (VLOOKUP,
// RANK, LEFT, SUMIF, MATCH, VLOOKUP) and 9 formatting questions that the other Excel papers ask too (heading Bold +
// Yellow + Wrap, All Borders, AutoFit, Freeze Top Row + Filter, Center, Tab Color + Rename, Accounting, Italic, Comma).
// Version 2 asks 3 formulas with functions no other Excel paper uses (MONTH, ROUNDUP, LOWER) and 12 tools no other
// paper asks for: Duplicate Values and Data Bars (Conditional Formatting), a Comment, Hide Column, Row Height, Column
// Width, Text Orientation, Narrow margins + Center on page, Scale to Fit (1 page wide), Double Underline, Data
// Validation, Freeze First Column (Excel Test 1 already asks Landscape and Gridlines off). Same 200-employee data (scripts/lib/excel-test5-dataset.mjs); H-L are given (grey), M-O are asked.
// Writes tests/fixtures/excel-test9-v2-{initial,model,rules}.json and the migration.
//   node scripts/build-excel-test9-v2.mjs
import fs from "node:fs";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { employees, EMPLOYEES, ALLOWANCES, LAST, col, plain } from "./lib/excel-test5-dataset.mjs";

const HEADERS = ["Emp ID", "Employee Name", "Department", "Post", "Joining Date", "Basic Pay", "Mobile No",
  "Name (Proper)", "Joining Year", "DA", "Allowance", "Gross Salary", "Joining Month", "Bonus", "Dept (small letters)"];
const GIVEN_COLS = ["H", "I", "J", "K", "L"];
const ASKED_COLS = ["M", "N", "O"];
const ROW_FORMULAS = {
  H: (r) => `=PROPER(TRIM(B${r}))`,
  I: (r) => `=YEAR(E${r})`,
  J: (r) => `=ROUND(F${r}*$T$2,0)`,
  K: (r) => `=VLOOKUP(D${r},$S$6:$T$12,2,FALSE)`,
  L: (r) => `=F${r}+J${r}+K${r}`,
  M: (r) => `=MONTH(E${r})`,
  N: (r) => `=ROUNDUP(F${r}*$T$3,0)`,
  O: (r) => `=LOWER(C${r})`,
};
const EXTRA = {
  S1: plain("Rates", null, { bold: true }), S2: plain("DA Rate"), T2: plain(0.55, null, { numberFormat: "Percentage", decimals: 0 }),
  S3: plain("Bonus Rate"), T3: plain(0.0833, null, { numberFormat: "Percentage", decimals: 2 }),
  S5: plain("Post", null, { bold: true }), T5: plain("Allowance", null, { bold: true }),
  // The Allowance table as the live sheet has it since 23 Nov (migration 202611231100): Peon and Driver with 0.
  ...Object.fromEntries([...ALLOWANCES, ["Peon", 0], ["Driver", 0]].flatMap(([post, amount], i) => [[`S${6 + i}`, plain(post)], [`T${6 + i}`, plain(amount)]])),
};

const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
employees.forEach((row, r) => row.forEach((value, i) => { if (value !== null) initialCells[`${col(i)}${r + 2}`] = plain(value, null, i === 4 ? { numberFormat: "ShortDate" } : {}); }));
Object.assign(initialCells, EXTRA);
for (let r = 2; r <= LAST; r++) for (const c of GIVEN_COLS) initialCells[`${c}${r}`] = plain(null, ROW_FORMULAS[c](r), { fillColor: "D9D9D9" });
const initialComputed = recomputeFormulas(initialCells);

// ---------- the solved sheet (cell formats and sheet settings exactly as the editor saves them) ----------
const modelCells = structuredClone(initialComputed);
for (let r = 2; r <= LAST; r++) for (const c of ASKED_COLS) modelCells[`${c}${r}`] = plain(null, ROW_FORMULAS[c](r));
const computed = recomputeFormulas(modelCells);
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);
const value = (ref) => computed[ref].value;
// Independent check of the three answer columns (plain JavaScript, no spreadsheet code).
employees.forEach((e, i) => {
  const r = i + 2, month = new Date(Date.UTC(1899, 11, 30) + e[4] * 86400000).getUTCMonth() + 1;
  const want = { M: month, N: Math.ceil(Math.round(e[5] * 0.0833 * 1e6) / 1e6), O: e[2].toLowerCase() };
  for (const [c, v] of Object.entries(want)) if (value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${JSON.stringify(value(`${c}${r}`))} vs ${JSON.stringify(v)}`);
});
export const STYLE = { header: (cell) => ({ ...cell, underline: true, underlineStyle: "double", rotate: 45 }) };
for (let i = 0; i < HEADERS.length; i++) computed[`${col(i)}1`] = STYLE.header(computed[`${col(i)}1`]);
computed.A1 = { ...computed.A1, comment: "Unique ID" };

// ---------- questions and checks ----------
const cellCheck = (ref, equals, extra = {}) => ({ rule: "value", cell: ref, equals, formula: true, ...extra });
const columnChecks = (c, caseSensitive) => Array.from({ length: EMPLOYEES }, (_, i) => cellCheck(`${c}${i + 2}`, value(`${c}${i + 2}`), caseSensitive ? { caseSensitive: true } : {}));
const HEAD = `A1:${col(HEADERS.length - 1)}1`;
export const SHEET = {
  conditionalFormats: [{ range: `G2:G${LAST}`, type: "duplicate", style: "lightRedDarkRed" }, { range: `F2:F${LAST}`, type: "dataBar", style: "blueBar" }],
  // As the editor saves them: hidden columns by number (A = 0, so G = 6), rows by number from 1, margins "Narrow",
  // validation limits as typed text.
  hiddenCols: [6], rowHeights: { 1: 30 }, colWidths: { B: 30 }, margins: "Narrow", centerHorizontally: true, fitWidth: 1,
  validations: [{ range: `F2:F${LAST}`, type: "whole", operator: "between", value1: "15000", value2: "60000" }], freeze: "B1",
};
const QUESTIONS = [
  { marks: 2, text: "In column M (Joining Month) find the month number (1 to 12) of every employee's Joining Date (column E) using the MONTH function.",
    criteria: [{ column: "M" }],
    solution: "**MONTH(date)** gives the month of a date as a number from 1 (January) to 12 (December).\n1. Click **M2** and type **=MONTH(E2)** → Enter.\n2. Double-click the fill handle to fill down to **M201**.\n\nChecked: the month in every cell M2:M201." },
  { marks: 2, text: "In column N (Bonus) find the Bonus = Basic Pay × Bonus Rate given in cell T3, rounded UP to a whole rupee with the ROUNDUP function. Use an absolute reference ($T$3).",
    criteria: [{ column: "N" }],
    solution: "**ROUNDUP(number, digits)** always rounds up (away from zero); with 0 digits it gives the next whole number.\n1. Click **N2** and type **=ROUNDUP(F2*$T$3,0)** → Enter.\n2. Double-click the fill handle to fill down to **N201**.\n\nChecked: the Bonus in every cell N2:N201." },
  { marks: 2, text: "In column O (Dept (small letters)) write every employee's Department in small letters using the LOWER function (for example Revenue → \"revenue\").",
    criteria: [{ column: "O", caseSensitive: true }],
    solution: "**LOWER(text)** changes every letter to a small letter.\n1. Click **O2** and type **=LOWER(C2)** → Enter.\n2. Double-click the fill handle to fill down to **O201**.\n\nChecked: the exact text (small letters) in every cell O2:O201." },
  { marks: 2, text: "With Conditional Formatting highlight the Duplicate Values in the Mobile No column G2:G201 with Light Red Fill with Dark Red Text.",
    criteria: [{ rule: "sheet", path: "conditionalFormats", includes: SHEET.conditionalFormats[0] }],
    solution: "1. Select **G2:G201**.\n2. HOME → **Conditional Formatting ▾** → **Highlight Cells Rules** → **Duplicate Values…**.\n3. Keep **Duplicate** and **Light Red Fill with Dark Red Text** → **OK**.\n\nChecked: a Duplicate Values rule on G2:G201." },
  { marks: 2, text: "With Conditional Formatting apply Blue Data Bars (Gradient Fill) to the Basic Pay column F2:F201.",
    criteria: [{ rule: "sheet", path: "conditionalFormats", includes: SHEET.conditionalFormats[1] }],
    solution: "1. Select **F2:F201**.\n2. HOME → **Conditional Formatting ▾** → **Data Bars** → Gradient Fill → **Blue Data Bar**.\n\nChecked: a blue Data Bars rule on F2:F201." },
  { marks: 1, text: "Insert a Comment on cell A1 with the text \"Unique ID\".",
    criteria: [{ rule: "cells", range: "A1", props: { comment: ["Unique ID"] } }],
    solution: "1. Right-click **A1** → **Insert Comment** (or REVIEW → **New Comment**).\n2. Type **Unique ID** and click outside the comment.\n\nChecked: A1 has the comment \"Unique ID\"." },
  { marks: 1, text: "Hide the Mobile No column G.",
    criteria: [{ rule: "sheet", path: "hiddenCols", includes: 6 }],
    solution: "1. Right-click the column letter **G** → **Hide** (or HOME → **Format ▾** → Hide & Unhide → **Hide Columns**).\n\nChecked: column G is hidden." },
  { marks: 1, text: "Set the Row Height of the heading row (row 1) to 30.",
    criteria: [{ rule: "sheet", path: "rowHeights.1", equals: 30 }],
    solution: "1. Right-click the row number **1** → **Row Height…** (or HOME → **Format ▾** → **Row Height…**).\n2. Type **30** → **OK**.\n\nChecked: row 1 is 30 high." },
  { marks: 1, text: "Set the Column Width of the Employee Name column B to 30.",
    criteria: [{ rule: "sheet", path: "colWidths.B", equals: 30 }],
    solution: "1. Right-click the column letter **B** → **Column Width…** (or HOME → **Format ▾** → **Column Width…**).\n2. Type **30** → **OK**.\n\nChecked: column B is 30 wide." },
  { marks: 2, text: `Rotate the text of the heading row ${HEAD} with Orientation → Angle Counterclockwise.`,
    criteria: [{ rule: "cells", range: HEAD, props: { rotate: [45] } }],
    solution: `1. Select **${HEAD}**.\n2. HOME → **Orientation (ab↗) ▾** → **Angle Counterclockwise**.\n\nChecked: every heading cell is turned 45°.` },
  { marks: 2, text: "Set the page Margins to Narrow and center the sheet Horizontally on the page (PAGE LAYOUT → Margins → Custom Margins → Center on page).",
    criteria: [{ rule: "sheet", path: "margins", equals: SHEET.margins }, { rule: "sheet", path: "centerHorizontally", equals: true }],
    solution: "1. PAGE LAYOUT → **Margins ▾** → **Narrow**.\n2. PAGE LAYOUT → **Margins ▾** → **Custom Margins…** → Center on page: tick **Horizontally** → **OK**.\n\nChecked: narrow margins, centred horizontally." },
  { marks: 1, text: "With Scale to Fit set the Width to 1 page (PAGE LAYOUT tab), so the sheet prints one page wide.",
    criteria: [{ rule: "sheet", path: "fitWidth", equals: 1 }],
    solution: "1. PAGE LAYOUT → Scale to Fit group → **Width ▾** → **1 page**.\n\nChecked: the sheet is set to 1 page wide." },
  { marks: 2, text: `Apply Double Underline to the heading row ${HEAD}.`,
    criteria: [{ rule: "cells", range: HEAD, props: { underline: [true], underlineStyle: ["double"] } }],
    solution: `1. Select **${HEAD}**.\n2. HOME → **Underline ▾** → **Double Underline**.\n\nChecked: every heading cell has a double underline.` },
  { marks: 2, text: "With Data Validation allow only a Whole number between 15000 and 60000 in the Basic Pay column F2:F201.",
    criteria: [{ rule: "sheet", path: "validations", includes: SHEET.validations[0] }],
    solution: "1. Select **F2:F201**.\n2. DATA → **Data Validation**.\n3. Allow **Whole number**, Data **between**, Minimum **15000**, Maximum **60000** → **OK**.\n\nChecked: the validation rule on F2:F201." },
  { marks: 2, text: "Freeze the First Column of the sheet (VIEW → Freeze Panes).",
    criteria: [{ rule: "sheet", path: "freeze", equals: SHEET.freeze }],
    solution: "1. VIEW → **Freeze Panes ▾** → **Freeze First Column**.\n\nChecked: column A stays visible while scrolling right." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet: SHEET, operations: [], savedAt: "2026-11-26T00:00:00.000Z" };
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column, c.caseSensitive) : [c]));
fs.writeFileSync("tests/fixtures/excel-test9-v2-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test9-v2-model.json", JSON.stringify(model));
fs.writeFileSync("tests/fixtures/excel-test9-v2-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: expand(q.criteria) }))));
console.log("wrote fixtures for TEST 9 v2");

// ---------- the migration: a NEW version of TEST 9, built in the database from its current sheet ----------
// The sheet itself is ~1 MB, too much for the SQL editor, so only what changes travels in the file: the answer
// columns' values, the new heading texts and settings. Starting from the current version's working sheet:
// P/Q answer labels removed, K becomes given (grey, VLOOKUP), headings M1:O1 renamed, Bonus Rate added in S3:T3.
const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const columnValues = Object.fromEntries(["K", ...ASKED_COLS].map((c) => [c, Array.from({ length: EMPLOYEES }, (_, i) => value(`${c}${i + 2}`))]));
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const askedTemplates = Object.fromEntries(ASKED_COLS.map((c) => [c, ROW_FORMULAS[c]("#")]));
const headerStyle = { underline: true, underlineStyle: "double", rotate: 45 };
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 employees (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. Columns **H to L** (Name Proper, Joining Year, DA, Allowance, Gross Salary) are already filled in for you (light grey background).\n5. **Maximum marks** and question-wise marks are shown with the questions.\n6. Complete each task directly in the spreadsheet. Any method is fine: the result in the sheet is what is checked.";

const sql = `-- English EXCEL EFFICIENCY TEST 9, version 2 (26 Nov 2026; built by scripts/build-excel-test9-v2.mjs, do not edit by hand).
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
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 asked jsonb := ${dollar(JSON.stringify(askedTemplates))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 headers jsonb := ${dollar(JSON.stringify(HEADERS))}::jsonb;
 sheet jsonb := ${dollar(JSON.stringify(SHEET))}::jsonb;
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
 for r in 2..${LAST} loop
  ws := jsonb_set(ws, array['cells', 'K' || r], pg_temp.excel_cell(vals->'K'->(r - 2), '=VLOOKUP(D' || r || ',$S$6:$T$12,2,FALSE)', '{"fillColor":"D9D9D9"}'));
 end loop;
 perform public.assert_excel_efficiency_working_matter(ws);

 -- the solved sheet
 ms := jsonb_build_object('schemaVersion', '3', 'rows', ws->'rows', 'cols', ws->'cols', 'cells', ws->'cells', 'merges', '[]'::jsonb, 'sheet', sheet,
   'operations', '[]'::jsonb, 'savedAt', '2026-11-26T00:00:00.000Z');
 for t in select jsonb_object_keys(asked) loop
  for r in 2..${LAST} loop
   ms := jsonb_set(ms, array['cells', t || r], pg_temp.excel_cell(vals->t->(r - 2), replace(asked->>t, '#', r::text)));
  end loop;
 end loop;
 for r in 0..jsonb_array_length(headers) - 1 loop
  k := chr(65 + r) || '1';
  ms := jsonb_set(ms, array['cells', k], (ms->'cells'->k) || ${dollar(JSON.stringify(headerStyle))}::jsonb);
 end loop;
 ms := jsonb_set(ms, '{cells,A1}', (ms->'cells'->'A1') || '{"comment":"Unique ID"}');
 perform public.assert_excel_efficiency_document_schema(ms);

 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (old.test_id, (select max(version_number) + 1 from public.excel_efficiency_versions where test_id = old.test_id), old.title, old.language,
   'MONTH, ROUNDUP and LOWER, plus Conditional Formatting, Comment, Hide, Row Height, Column Width, Orientation, Page Setup, Double Underline, Data Validation and Freeze First Column on 200 employees',
   ${dollar(instructions)}, 15, 25, old.duration_options, old.passing_marks, ws, old.created_by, old.delivery_pdf, old.delivery_onscreen, old.student_question_toggle, ms)
 returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = (select version_number from public.excel_efficiency_versions where id = v_id),
   auto_publish_results = true where id = old.test_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if c ? 'column' then
    crit := crit || (select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', (c->>'column') || (i + 2), 'formula', true, 'equals', vals->(c->>'column')->i)
      || case when coalesce((c->>'caseSensitive')::boolean, false) then '{"caseSensitive":true}'::jsonb else '{}'::jsonb end order by i)
      from generate_series(0, ${EMPLOYEES - 1}) i);
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
`;
fs.writeFileSync("supabase/migrations/202611261200_excel_test9_v2_new_questions.sql", sql);
console.log("wrote migration", sql.length);

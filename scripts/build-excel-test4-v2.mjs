// Builds a migration that adds VERSION 2 to the EXISTING EXCEL EFFICIENCY TEST 4 (test id
// 48dd8076-8223-4887-a83e-4cdec34561fd) and repoints current_version_id to it. Version 1 (and every attempt graded
// against it) is left completely untouched -- get_excel_efficiency_attempt_result() and the solution functions
// always read an attempt's OWN version_id, not the test's current one, so old results keep showing correctly.
//
// Why a new version: test 4 was too hard to finish in 10 minutes (the admin's own words, after attempting it many
// times). This version drops the four hardest questions (nested IF Grade, IF+AND Selection, IF+OR Scholarship,
// IF+<> Hostel, and the COUNTIF/COUNTIFS/AVERAGEIF summary block that depended on them) -- they move to the new
// TEST 8 (scripts/build-excel-test8.mjs) -- and replaces them with 8 easy formatting-only questions. The sheet
// itself is trimmed from 17 columns (A-Q) to 13 (A-M): columns N-Q (Grade/Selection/Scholarship/Hostel) are no
// longer part of this paper at all, so the sheet looks less overwhelming too.
// Same 200-student data as TEST 4 and TEST 8 (scripts/lib/excel-test4-dataset.mjs) -- "practice test paper can
// same in both".
//   node scripts/build-excel-test4-v2.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { students, STUDENTS, LAST, col, plain, letters } from "./lib/excel-test4-dataset.mjs";

const TEST_ID = "48dd8076-8223-4887-a83e-4cdec34561fd";

// ---------- the sheet (A-M only: Total, Percentage, Result -- Grade/Selection/Scholarship/Hostel moved to TEST 8) ----------
const HEADERS = ["Roll No", "Student Name", "Gender", "District", "Category", "Hindi", "English", "Computer", "Rajasthan GK", "Typing Speed (WPM)",
  "Total", "Percentage", "Result"];
const SUMMARY = [
  ["S1", "Summary (use formulas)"], ["T1", "Answer"],
  ["S2", "Total students"], ["S3", "Students who appeared in English"],
];

const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
students.forEach((row, r) => row.forEach((value, i) => { initialCells[`${col(i)}${r + 2}`] = plain(value); }));
for (const [ref, text] of SUMMARY) initialCells[ref] = plain(text);

const ROW_FORMULAS = {
  K: (r) => `=SUM(F${r}:I${r})`,
  L: (r) => `=K${r}/400*100`,
  M: (r) => `=IF(K${r}>=160,"PASS","FAIL")`,
};
const rng = (c) => `${c}2:${c}${LAST}`;
const SUMMARY_FORMULAS = {
  T2: `=COUNTA(${rng("B")})`,
  T3: `=COUNT(${rng("G")})`,
};

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
// Q1: header row bold, yellow, wrapped
for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}1`], { bold: true, fillColor: "FFFF00", wrap: true });
// NF5: heading row also dark blue font + 12pt (adds onto Q1's formatting)
for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}1`], { fontColor: "1F3864", fontSize: 12 });
// NF2: all borders on the complete table
for (let r = 1; r <= LAST; r++) for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}${r}`], { border: "trbl" });
// NF1 / NF8: number formats
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`L${r}`], { numberFormat: "Percentage", decimals: 2 });
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`J${r}`], { numberFormat: "Number", decimals: 0, align: "center" });
// NF3: center align Gender
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`C${r}`], { align: "center" });
// NF6: italic Category, center Rajasthan GK
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`E${r}`], { italic: true });
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`H${r}`], { align: "center" });
// NF7: bold Total column
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`K${r}`], { bold: true });

const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check of the engine's answers (plain JavaScript, no spreadsheet code).
{
  const rows = students.map((s) => { const nums = [s[5], s[6], s[7], s[8]].filter((v) => typeof v === "number"); const total = nums.reduce((a, b) => a + b, 0); return { s, total, pct: total / 4 }; });
  rows.forEach(({ s, total, pct }, i) => {
    const r = i + 2, want = { K: total, L: pct, M: total >= 160 ? "PASS" : "FAIL" };
    for (const [c, v] of Object.entries(want)) if (typeof v === "number" ? Math.abs(value(`${c}${r}`) - v) > 1e-9 : value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${value(`${c}${r}`)} vs ${v}`);
  });
  const want = { T2: 200, T3: students.filter((s) => typeof s[6] === "number").length };
  for (const [ref, v] of Object.entries(want)) if (Math.abs(value(ref) - v) > 1e-9) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want);
}

// ---------- marking ----------
const cellCheck = (ref, equals) => ({ rule: "value", cell: ref, equals, formula: true });
const columnChecks = (c, map = (v) => v) => Array.from({ length: STUDENTS }, (_, i) => cellCheck(`${c}${i + 2}`, map(value(`${c}${i + 2}`))));
const conditional = [];
for (const range of [rng("M"), `M1:M${LAST}`]) for (const type of ["equalTo", "textContains"]) for (const text of ["FAIL", "Fail", "fail"]) conditional.push({ rule: "sheet", path: "conditionalFormats", includes: { range, type, value: text, style: "lightRedDarkRed" } });
const filterRanges = ["J", "K", "L", "M"].map((c) => `A1:${c}${LAST}`);

const QUESTIONS = [
  { marks: 1, text: "Make the heading row A1:M1 Bold, give it Yellow fill colour and apply Wrap Text.",
    criteria: [{ rule: "cells", range: "A1:M1", props: { bold: [true], fillColor: ["FFFF00"], wrap: [true] } }],
    solution: "1. Select **A1:M1** (click A1, hold Shift, click M1).\n2. HOME → **Bold** (Ctrl+B).\n3. HOME → **Fill Color ▾** → Standard Colors → **Yellow**.\n4. HOME → **Wrap Text**.\n\nChecked: every heading cell A1 to M1 is bold, yellow and wrapped." },
  { marks: 1, text: "In column K (Total) find the Total of Hindi, English, Computer and Rajasthan GK (F to I) for every student using the SUM function.",
    criteria: [{ column: "K" }],
    solution: "1. Click **K2** and type **=SUM(F2:I2)** → Enter (Rajnish Sharma: 78+64+91+70 = 303).\n2. Click K2 again and **double-click the fill handle** (small square at the bottom-right of the cell) to copy the formula down to **K201**.\n\nWhy SUM and not =F2+G2+H2+I2? Some students were absent in English (**AB**). The + sign gives **#VALUE!** when a cell has text, but SUM skips text, so Pooja Meena (row 3) gets 92+66+58 = 216.\n\nChecked: a formula in every cell K2:K201 with the right total." },
  { marks: 1, text: "In column L (Percentage) find the percentage of every student. Each subject is out of 100, so the maximum total is 400 (Percentage = Total ÷ 400 × 100).",
    criteria: [{ column: "L", alsoFraction: true }],
    solution: "1. Click **L2** and type **=K2/400*100** → Enter (303 ÷ 400 × 100 = 75.75).\n2. Double-click the fill handle of L2 to fill down to **L201**.\n\n(=K2/400 with the **Percent Style** button (%) also counts: it shows 75.75%.)\n\nChecked: every percentage in L2:L201." },
  { marks: 2, text: "In column M (Result) using IF function write \"PASS\" if the Total is 160 or more (>=160), otherwise write \"FAIL\".",
    criteria: [{ column: "M" }],
    solution: "IF checks a condition: **=IF(condition, value if TRUE, value if FALSE)**. Text answers go inside double quotes.\n1. Click **M2** and type **=IF(K2>=160,\"PASS\",\"FAIL\")** → Enter.\n2. Double-click the fill handle to fill down to **M201**.\n\nComparison signs in Excel: **>** greater than, **<** less than, **>=** greater than or equal, **<=** less than or equal, **=** equal, **<>** not equal.\n\nChecked: PASS/FAIL in every cell M2:M201 (capital or small letters both count)." },
  { marks: 2, text: "In cell T2 find the total number of students using COUNTA on Student Name (B2:B201), and in cell T3 find how many students appeared in English using COUNT on G2:G201.",
    criteria: [cellCheck("T2", value("T2")), cellCheck("T3", value("T3"))],
    solution: `**COUNTA** counts every cell that is not empty (text and numbers). **COUNT** counts only cells with numbers.\n1. **T2**: =COUNTA(B2:B201) → ${value("T2")}.\n2. **T3**: =COUNT(G2:G201) → ${value("T3")} (the ${200 - value("T3")} students marked AB are text, so COUNT leaves them out).\n\nAlso useful: **COUNTBLANK** counts empty cells.\n\nChecked: T2 and T3, both with formulas.` },
  { marks: 1, text: "Select M2:M201 and with Conditional Formatting highlight the cells equal to \"FAIL\" with Light Red Fill with Dark Red Text.",
    criteria: [{ rule: "anyOf", criteria: conditional }],
    solution: "1. Select **M2:M201** (click M2, then press **Ctrl+Shift+↓**).\n2. HOME → **Conditional Formatting ▾** → **Highlight Cells Rules** → **Equal To...**\n3. Type **FAIL**, keep **Light Red Fill with Dark Red Text** → **OK**.\n\n(Highlight Cells Rules → Text that Contains... with FAIL also counts.)\n\nChecked: the rule on M2:M201." },
  { marks: 1, text: "Apply Filter to the complete table A1:M201.",
    criteria: [{ rule: "sheet", path: "filter", in: filterRanges }],
    solution: "1. Click any cell of the table, for example **A1**.\n2. DATA → **Filter** (or HOME → Sort & Filter ▾ → Filter, or **Ctrl+Shift+L**). Arrow buttons appear in the heading row.\n\nDo this after the formula columns are filled, so the filter covers A1:M201.\n\nChecked: a filter on the table." },
  { marks: 2, text: "Apply Percentage Number Format with 2 decimal places to the Percentage column L2:L201.",
    criteria: [{ rule: "cells", range: rng("L"), props: { numberFormat: ["Percentage"], decimals: [2] } }],
    solution: "1. Select **L2:L201** (click L2, then **Ctrl+Shift+↓**).\n2. Right-click → **Format Cells** (Ctrl+1) → **Number** → **Percentage** → 2 decimal places → **OK**.\n\n(The % button plus Increase Decimal twice also works.)\n\nChecked: L2:L201 in Percentage format with 2 decimals." },
  { marks: 2, text: "Apply All Borders to the complete table A1:M201.",
    criteria: [{ rule: "cells", range: `A1:M${LAST}`, props: { border: ["trbl"] } }],
    solution: `1. Select **A1:M${LAST}** (click A1, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Borders ▾** → **All Borders**.\n\nChecked: every cell A1:M${LAST} has borders on all four sides.` },
  { marks: 2, text: "Apply AutoFit Column Width to the columns A to M, and Center alignment to the Gender column C2:C201.",
    criteria: [{ rule: "sheet", path: "autoFitCols", includesAll: letters("A", "M") }, { rule: "cells", range: "C2:C201", props: { align: ["center"] } }],
    solution: "1. Select the columns **A to M** (click column letter A, hold Shift, click M).\n2. HOME → **Format ▾** → **AutoFit Column Width**.\n3. Select **C2:C201** and click HOME → **Center** (Ctrl+E).\n\n(Double-clicking the line between two column letters also does AutoFit.)\n\nChecked: AutoFit on columns A to M, and C2:C201 centred." },
  { marks: 2, text: "Freeze the Top Row of the sheet, and rename the sheet Sheet1 to \"Students\".",
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }, { rule: "sheet", path: "name", equals: "Students" }],
    solution: "1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n2. **Right-click** the sheet tab **Sheet1** (bottom-left) → **Rename**, type **Students** → Enter.\n\nChecked: panes frozen below row 1, and the sheet name is Students." },
  { marks: 2, text: "Give the heading row A1:M1 a Dark Blue font colour and Font Size 12, in addition to the Bold, Yellow fill and Wrap Text from question 1.",
    criteria: [{ rule: "cells", range: "A1:M1", props: { fontColor: ["1F3864", "002060", "1F4E78"], fontSize: [12] } }],
    solution: "1. Select **A1:M1**.\n2. HOME → **Font Color ▾** → Standard Colors → **Dark Blue**.\n3. HOME → **Font Size** box → type **12** → Enter.\n\nChecked: A1:M1 has a dark blue font colour and font size 12." },
  { marks: 2, text: "Apply Italic to the Category column E2:E201, and Center alignment to the Rajasthan GK column H2:H201.",
    criteria: [{ rule: "cells", range: "E2:E201", props: { italic: [true] } }, { rule: "cells", range: "H2:H201", props: { align: ["center"] } }],
    solution: "1. Select **E2:E201** and click HOME → **Italic** (Ctrl+I).\n2. Select **H2:H201** and click HOME → **Center** (Ctrl+E).\n\nChecked: E2:E201 italic, H2:H201 centred." },
  { marks: 2, text: "Give the sheet tab a Blue Tab Color, and Bold the Total column K2:K201.",
    criteria: [{ rule: "sheet", path: "tabColor", equals: ["0070C0", "2E75B6", "1F4E78"] }, { rule: "cells", range: "K2:K201", props: { bold: [true] } }],
    solution: "1. **Right-click** the sheet tab → **Tab Color** → Standard Colors → **Blue**.\n2. Select **K2:K201** and click HOME → **Bold** (Ctrl+B).\n\nChecked: the tab colour is blue, and K2:K201 is bold." },
  { marks: 2, text: "Apply Number Format with 0 decimal places to the Typing Speed column J2:J201, and Center alignment to J2:J201.",
    criteria: [{ rule: "cells", range: "J2:J201", props: { numberFormat: ["Number", "General"], decimals: [0], align: ["center"] } }],
    solution: "1. Select **J2:J201**.\n2. Right-click → **Format Cells** (Ctrl+1) → **Number** → **Number** → 0 decimal places → **OK**.\n3. HOME → **Center** (Ctrl+E).\n\nChecked: J2:J201 with 0 decimals and centred." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sheet1", freeze: "A2", filter: `A1:M${LAST}`, filterHidden: {}, autoFitCols: letters("A", "M"),
  conditionalFormats: [{ range: rng("M"), type: "equalTo", value: "FAIL", style: "lightRedDarkRed" }] };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet: { ...sheet, name: "Students", tabColor: "0070C0" }, operations: [], savedAt: "2026-11-10T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test4-v2-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test4-v2-model.json", JSON.stringify(model));

// ---------- SQL ----------
const expand = (criteria) => criteria.flatMap((c) => !c.column ? [c] : c.alsoFraction
  ? [{ rule: "anyOf", criteria: [{ rule: "allOf", criteria: columnChecks(c.column) }, { rule: "allOf", criteria: columnChecks(c.column, (v) => v / 100) }] }]
  : columnChecks(c.column));
fs.writeFileSync("tests/fixtures/excel-test4-v2-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const templates = Object.fromEntries(Object.entries(ROW_FORMULAS).map(([c, f]) => [c, f("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: STUDENTS }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 students (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. **Maximum marks** and question-wise marks are shown with the questions.\n5. Complete each task directly in the spreadsheet. Any method is fine (formula, drag and fill, Flash Fill or typing): the answer in the cells is what is checked.";

const sql = `-- English EXCEL EFFICIENCY TEST 4, VERSION 2 (built by scripts/build-excel-test4-v2.mjs; do not edit by hand).
-- The admin found version 1 too hard to finish in 10 minutes. This version drops the hardest 4 logic questions
-- (nested IF Grade, IF+AND Selection, IF+OR Scholarship, IF+<> Hostel) and the COUNTIF/COUNTIFS/AVERAGEIF summary
-- block that depended on them -- they move to the new EFFICIENCY TEST 8 -- and replaces them with 8 easy
-- formatting-only questions. Version 1 (and every attempt already graded against it) is left completely
-- untouched: this inserts a NEW version row and repoints current_version_id, it never updates version 1's rows.
-- Safe to run twice.
begin;

create or replace function pg_temp.excel_cell(v jsonb, f text default null) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) $f$;
create or replace function pg_temp.column_checks(vals jsonb, col text, divide numeric) returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', col || (r + 2), 'formula', true,
   'equals', case when divide = 1 then vals->col->r else to_jsonb((vals->col->>r)::numeric / divide) end) order by r)
 from generate_series(0, jsonb_array_length(vals->col) - 1) r $f$;

do $mig$
declare
 t_id uuid := '${TEST_ID}'; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb; next_version int;
 students jsonb := ${dollar(JSON.stringify(students))}::jsonb;
 headers jsonb := ${dollar(JSON.stringify(HEADERS))}::jsonb;
 summary jsonb := ${dollar(JSON.stringify(SUMMARY))}::jsonb;
 templates jsonb := ${dollar(JSON.stringify(templates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 select coalesce(max(version_number), 0) + 1 into next_version from public.excel_efficiency_versions where test_id = t_id;
 if next_version <> 2 then raise notice 'EXCEL EFFICIENCY TEST 4 already has version %, skipping', next_version; return; end if;

 select jsonb_object_agg(ref, cell) into cells from (
   select chr(65 + i) || '1' as ref, pg_temp.excel_cell(headers->i) as cell from generate_series(0, jsonb_array_length(headers) - 1) i
   union all select chr(65 + i) || (r + 2), pg_temp.excel_cell(students->r->i) from generate_series(0, jsonb_array_length(students) - 1) r, generate_series(0, 9) i
   union all select s->>0, pg_temp.excel_cell(s->1) from jsonb_array_elements(summary) s) x;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(templates) t, generate_series(0, ${STUDENTS - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;

 -- Q1 + "dark blue / 12pt" question: header row style
 select model_cells || jsonb_object_agg(chr(65 + i) || '1', (model_cells->(chr(65 + i) || '1')) || '{"bold":true,"fillColor":"FFFF00","wrap":true,"fontColor":"1F3864","fontSize":12}'::jsonb)
   into model_cells from generate_series(0, jsonb_array_length(headers) - 1) i;
 -- "All Borders" question: every cell of the table A1:M201
 select model_cells || jsonb_object_agg(chr(65 + i) || r, (model_cells->(chr(65 + i) || r)) || '{"border":"trbl"}'::jsonb)
   into model_cells from generate_series(1, ${LAST}) r, generate_series(0, jsonb_array_length(headers) - 1) i;
 -- "Percentage format" question: L2:L201
 select model_cells || jsonb_object_agg('L' || r, (model_cells->('L' || r)) || '{"numberFormat":"Percentage","decimals":2}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- "Number format + center" question: J2:J201
 select model_cells || jsonb_object_agg('J' || r, (model_cells->('J' || r)) || '{"numberFormat":"Number","decimals":0,"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- "AutoFit + center Gender" question: C2:C201
 select model_cells || jsonb_object_agg('C' || r, (model_cells->('C' || r)) || '{"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- "Italic Category + center Rajasthan GK" question: E2:E201, H2:H201
 select model_cells || jsonb_object_agg('E' || r, (model_cells->('E' || r)) || '{"italic":true}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 select model_cells || jsonb_object_agg('H' || r, (model_cells->('H' || r)) || '{"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- "Tab Color + bold Total" question: K2:K201
 select model_cells || jsonb_object_agg('K' || r, (model_cells->('K' || r)) || '{"bold":true}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;

 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify({ ...sheet, name: "Students", tabColor: "0070C0" }))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-10T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 2, 'EFFICIENCY TEST 4', 'English', 'SUM, Percentage, IF, COUNTA/COUNT and everyday formatting on 200 students (easier than version 1)',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9,
   working, (select created_by from public.excel_efficiency_tests where id = t_id), false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 2 where id = t_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if not c ? 'column' then crit := crit || jsonb_build_array(c);
   elsif coalesce((c->>'alsoFraction')::boolean, false) then
    crit := crit || jsonb_build_array(jsonb_build_object('rule', 'anyOf', 'criteria', jsonb_build_array(
      jsonb_build_object('rule', 'allOf', 'criteria', pg_temp.column_checks(vals, c->>'column', 1)),
      jsonb_build_object('rule', 'allOf', 'criteria', pg_temp.column_checks(vals, c->>'column', 100)))));
   else crit := crit || pg_temp.column_checks(vals, c->>'column', 1);
   end if;
  end loop;
  insert into public.excel_efficiency_questions (version_id, question_number, instruction, marks, display_order, solution)
  values (v_id, (item->>'n')::int, item->>'text', (item->>'marks')::numeric, (item->>'n')::int, item->>'solution') returning id into q_id;
  insert into public.excel_efficiency_grading_rules (version_id, question_id, exact_target, expected_operation, expected_value, allocated_marks, additional_criteria)
  values (v_id, q_id, 'hand-written', 'rule-criteria', 'null'::jsonb, (item->>'marks')::numeric, crit);
 end loop;
end $mig$;

-- Check: the model answer scores the full marks of every question, the untouched sheet 0.
select q.question_number, q.marks,
  public.excel_efficiency_score_question(v.model_answer_snapshot, v.id, q.id, q.marks) as model,
  public.excel_efficiency_score_question(public.excel_efficiency_initial_editor_document(v.working_matter_snapshot), v.id, q.id, q.marks) as untouched
from public.excel_efficiency_tests t join public.excel_efficiency_versions v on v.id = t.current_version_id
join public.excel_efficiency_questions q on q.version_id = v.id where t.id = '${TEST_ID}' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611101400_excel_test4_v2_easier.sql", sql);
console.log("wrote migration + fixtures for TEST 4 version 2");

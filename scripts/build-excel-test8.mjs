// Builds supabase/migrations/202611101500_excel_test8_recruitment_logic.sql: a BRAND NEW English EXCEL EFFICIENCY
// TEST 8, 15 questions, 25 marks, 200 students -- the same data as EXCEL EFFICIENCY TEST 4
// (scripts/lib/excel-test4-dataset.mjs; "practice test paper can same in both").
//
// Test 4 (version 1) was too hard to finish in 10 minutes, so its hardest 4 logic questions (nested IF Grade,
// IF+AND Selection, IF+OR Scholarship, IF+<> Hostel) plus the COUNTIF/COUNTIFS/AVERAGEIF summary block that
// depended on them move here as TEST 8's core (8 questions, 16 marks) -- reused word-for-word from Test 4 version
// 1 (scripts/build-excel-test4.mjs). Total (K), Percentage (L) and Result (M) are given/pre-filled in the starting
// sheet here (light grey fill) instead of being asked, since several of the harder questions depend on them and
// Test 4's basic-formula questions already cover that ground. 7 new easy formatting-only questions round the
// paper out to 15 / 25.
//   node scripts/build-excel-test8.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { students, STUDENTS, LAST, col, plain, letters } from "./lib/excel-test4-dataset.mjs";

// ---------- the sheet (same A-Q, 17 columns as Test 4 version 1) ----------
const HEADERS = ["Roll No", "Student Name", "Gender", "District", "Category", "Hindi", "English", "Computer", "Rajasthan GK", "Typing Speed (WPM)",
  "Total", "Percentage", "Result", "Grade", "Selection", "Scholarship", "Hostel"];
const SUMMARY = [
  ["S1", "Summary (use formulas)"], ["T1", "Answer"],
  ["S4", "Students who passed"], ["S5", "Girl students"],
  ["S6", "Typing speed 35 WPM or more"], ["S7", "Computer marks below 40"], ["S8", "Students not from Jaipur"],
  ["S9", "Girls who passed"], ["S10", "OBC students from Kota"], ["S11", "Average Total of Jodhpur students"],
];

const ROW_FORMULAS = {
  K: (r) => `=SUM(F${r}:I${r})`,
  L: (r) => `=K${r}/400*100`,
  M: (r) => `=IF(K${r}>=160,"PASS","FAIL")`,
  N: (r) => `=IF(L${r}>=75,"A",IF(L${r}>=60,"B",IF(L${r}>=40,"C","D")))`,
  O: (r) => `=IF(AND(K${r}>=160,J${r}>=25),"Selected","Not Selected")`,
  P: (r) => `=IF(OR(F${r}>=90,H${r}>=90),"Yes","No")`,
  Q: (r) => `=IF(D${r}<>"Jaipur","Hostel","Day Scholar")`,
};
const GIVEN_COLS = ["K", "L", "M"]; // pre-filled in the starting sheet, not asked
const rng = (c) => `${c}2:${c}${LAST}`;
const SUMMARY_FORMULAS = {
  T4: `=COUNTIF(${rng("M")},"PASS")`,
  T5: `=COUNTIF(${rng("C")},"F")`,
  T6: `=COUNTIF(${rng("J")},">=35")`,
  T7: `=COUNTIF(${rng("H")},"<40")`,
  T8: `=COUNTIF(${rng("D")},"<>Jaipur")`,
  T9: `=COUNTIFS(${rng("C")},"F",${rng("M")},"PASS")`,
  T10: `=COUNTIFS(${rng("E")},"OBC",${rng("D")},"Kota")`,
  T11: `=ROUND(AVERAGEIF(${rng("D")},"Jodhpur",${rng("K")}),2)`,
};

const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
students.forEach((row, r) => row.forEach((value, i) => { initialCells[`${col(i)}${r + 2}`] = plain(value); }));
for (const [ref, text] of SUMMARY) initialCells[ref] = plain(text);
// K, L, M are given: pre-filled with their formula + a light grey fill, so students see them are not asked.
for (let r = 2; r <= LAST; r++) for (const c of GIVEN_COLS) initialCells[`${c}${r}`] = plain(null, ROW_FORMULAS[c](r), { fillColor: "D9D9D9" });

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) if (!GIVEN_COLS.includes(c)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
// E1: header row bold, yellow, wrapped
for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}1`], { bold: true, fillColor: "FFFF00", wrap: true });
// E2: all borders on the complete table
for (let r = 1; r <= LAST; r++) for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}${r}`], { border: "trbl" });
// E5: center align Gender
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`C${r}`], { align: "center" });
// E7: percentage number format on L (K/L/M keep their given grey fill; the border/format patches below layer on top)
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`L${r}`], { numberFormat: "Percentage", decimals: 2 });

const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check of the engine's answers (plain JavaScript, no spreadsheet code) -- same formulas as Test 4 v1.
{
  const rows = students.map((s) => { const nums = [s[5], s[6], s[7], s[8]].filter((v) => typeof v === "number"); const total = nums.reduce((a, b) => a + b, 0); return { s, total, pct: total / 4 }; });
  rows.forEach(({ s, total, pct }, i) => {
    const r = i + 2, want = { K: total, L: pct, M: total >= 160 ? "PASS" : "FAIL", N: pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D", O: total >= 160 && s[9] >= 25 ? "Selected" : "Not Selected", P: s[5] >= 90 || s[7] >= 90 ? "Yes" : "No", Q: s[3] !== "Jaipur" ? "Hostel" : "Day Scholar" };
    for (const [c, v] of Object.entries(want)) if (typeof v === "number" ? Math.abs(value(`${c}${r}`) - v) > 1e-9 : value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${value(`${c}${r}`)} vs ${v}`);
  });
  const jodhpur = rows.filter((x) => x.s[3] === "Jodhpur");
  const want = { T4: rows.filter((x) => x.total >= 160).length, T5: students.filter((s) => s[2] === "F").length,
    T6: students.filter((s) => s[9] >= 35).length, T7: students.filter((s) => s[7] < 40).length, T8: students.filter((s) => s[3] !== "Jaipur").length,
    T9: rows.filter((x) => x.s[2] === "F" && x.total >= 160).length, T10: students.filter((s) => s[4] === "OBC" && s[3] === "Kota").length,
    T11: Math.round((jodhpur.reduce((a, x) => a + x.total, 0) / jodhpur.length) * 100) / 100 };
  for (const [ref, v] of Object.entries(want)) if (Math.abs(value(ref) - v) > 1e-9) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want);
}

// ---------- marking ----------
const cellCheck = (ref, equals) => ({ rule: "value", cell: ref, equals, formula: true });
const columnChecks = (c, map = (v) => v) => Array.from({ length: STUDENTS }, (_, i) => cellCheck(`${c}${i + 2}`, map(value(`${c}${i + 2}`))));
const filterRanges = ["J", "K", "L", "M", "N", "O", "P", "Q"].map((c) => `A1:${c}${LAST}`);

const QUESTIONS = [
  { marks: 2, text: "Make the heading row A1:Q1 Bold, give it Yellow fill colour and apply Wrap Text.",
    criteria: [{ rule: "cells", range: "A1:Q1", props: { bold: [true], fillColor: ["FFFF00"], wrap: [true] } }],
    solution: "1. Select **A1:Q1** (click A1, hold Shift, click Q1).\n2. HOME → **Bold** (Ctrl+B).\n3. HOME → **Fill Color ▾** → Standard Colors → **Yellow**.\n4. HOME → **Wrap Text**.\n\nChecked: every heading cell A1 to Q1 is bold, yellow and wrapped." },
  { marks: 2, text: "Columns K (Total), L (Percentage) and M (Result) are already filled in for you (grey cells). In column N (Grade) using nested IF give grade on Percentage: 75 or more = \"A\", 60 or more = \"B\", 40 or more = \"C\", below 40 = \"D\".",
    criteria: [{ column: "N" }],
    solution: "A nested IF puts one IF inside another. Excel checks from left to right and stops at the first TRUE condition, so start from the highest grade.\n1. Click **N2** and type:\n   **=IF(L2>=75,\"A\",IF(L2>=60,\"B\",IF(L2>=40,\"C\",\"D\")))** → Enter.\n2. Double-click the fill handle to fill down to **N201**.\n\nCount the brackets: 3 IFs need 3 closing brackets at the end.\n\n**IFS** does the same job: =IFS(L2>=75,\"A\",L2>=60,\"B\",L2>=40,\"C\",L2<40,\"D\"). But IFS exists only in Excel 2019 / 365. **The exam uses Excel 2013, where IFS gives #NAME?** — learn the nested IF.\n\nChecked: the grade in every cell N2:N201." },
  { marks: 2, text: "In column O (Selection) using IF with AND write \"Selected\" if the Total is 160 or more AND Typing Speed is 25 WPM or more, otherwise \"Not Selected\".",
    criteria: [{ column: "O" }],
    solution: "AND is TRUE only when **every** condition is TRUE.\n1. Click **O2** and type **=IF(AND(K2>=160,J2>=25),\"Selected\",\"Not Selected\")** → Enter.\n2. Double-click the fill handle to fill down to **O201**.\n\nNote: && (used in programming) does not work in Excel. Excel uses the **AND( )** function.\n\nChecked: every cell O2:O201." },
  { marks: 2, text: "In column P (Scholarship) using IF with OR write \"Yes\" if a student got 90 or more in Hindi OR 90 or more in Computer, otherwise \"No\".",
    criteria: [{ column: "P" }],
    solution: "OR is TRUE when **at least one** condition is TRUE.\n1. Click **P2** and type **=IF(OR(F2>=90,H2>=90),\"Yes\",\"No\")** → Enter (Rajnish: Computer 91 → Yes).\n2. Double-click the fill handle to fill down to **P201**.\n\nNote: | or || (OR in programming) does not work in Excel. Excel uses the **OR( )** function.\n\nChecked: every cell P2:P201." },
  { marks: 2, text: "In column Q (Hostel) using IF write \"Hostel\" if the District is not Jaipur, otherwise \"Day Scholar\". Use the not equal to (<>) sign.",
    criteria: [{ column: "Q" }],
    solution: "In Excel \"not equal to\" is written **<>**. The signs ! and != (from programming) do not work in Excel; = means equal.\n1. Click **Q2** and type **=IF(D2<>\"Jaipur\",\"Hostel\",\"Day Scholar\")** → Enter.\n2. Double-click the fill handle to fill down to **Q201**.\n\nSame answer another way: =IF(D2=\"Jaipur\",\"Day Scholar\",\"Hostel\"), or =IF(NOT(D2=\"Jaipur\"),\"Hostel\",\"Day Scholar\").\n\nChecked: every cell Q2:Q201." },
  { marks: 2, text: "Using COUNTIF, in cell T4 count the students whose Result is \"PASS\", and in cell T5 count the girl students (Gender = \"F\").",
    criteria: [cellCheck("T4", value("T4")), cellCheck("T5", value("T5"))],
    solution: `**=COUNTIF(range, criteria)** counts the cells of a range that meet one condition.\n1. **T4**: =COUNTIF(M2:M201,"PASS") → ${value("T4")}.\n2. **T5**: =COUNTIF(C2:C201,"F") → ${value("T5")}.\n\n(T4 also works as =COUNTIF(K2:K201,">=160").)\n\nChecked: T4 and T5, both with formulas.` },
  { marks: 2, text: "Using COUNTIF with signs, count in T6 the students with Typing Speed 35 or more (>=35), in T7 the students with Computer marks below 40 (<40), and in T8 the students not from Jaipur (<>).",
    criteria: [cellCheck("T6", value("T6")), cellCheck("T7", value("T7")), cellCheck("T8", value("T8"))],
    solution: `In COUNTIF the sign and the number go together inside double quotes.\n1. **T6**: =COUNTIF(J2:J201,">=35") → ${value("T6")}.\n2. **T7**: =COUNTIF(H2:H201,"<40") → ${value("T7")}.\n3. **T8**: =COUNTIF(D2:D201,"<>Jaipur") → ${value("T8")}.\n\nChecked: T6, T7 and T8, all with formulas.` },
  { marks: 2, text: "Using COUNTIFS (more than one condition), count in T9 the girls (F) whose Result is PASS, and in T10 the OBC students from Kota district.",
    criteria: [cellCheck("T9", value("T9")), cellCheck("T10", value("T10"))],
    solution: `**=COUNTIFS(range1, criteria1, range2, criteria2, ...)** counts the rows that meet **all** the conditions. Every range must have the same size.\n1. **T9**: =COUNTIFS(C2:C201,"F",M2:M201,"PASS") → ${value("T9")}.\n2. **T10**: =COUNTIFS(E2:E201,"OBC",D2:D201,"Kota") → ${value("T10")}.\n\nCOUNTIFS, SUMIFS and AVERAGEIFS all work in Excel 2013.\n\nChecked: T9 and T10, both with formulas.` },
  { marks: 2, text: "In cell T11 find the average Total (column K) of the students of Jodhpur district using AVERAGEIF, rounded to 2 decimal places with ROUND.",
    criteria: [cellCheck("T11", value("T11"))],
    solution: `**=AVERAGEIF(range, criteria, average_range)** averages only the rows that meet the condition. **=ROUND(number, 2)** keeps 2 decimal places.\n1. Click **T11** and type **=ROUND(AVERAGEIF(D2:D201,"Jodhpur",K2:K201),2)** → Enter → ${value("T11")}.\n\nThe same pattern: =SUMIF(D2:D201,"Jodhpur",K2:K201) adds them up instead.\n\nChecked: T11 = ${value("T11")} with a formula. (The Decrease Decimal button only changes how the number looks, not the value, so use ROUND.)` },
  { marks: 1, text: "Apply All Borders to the complete table A1:Q201.",
    criteria: [{ rule: "cells", range: `A1:Q${LAST}`, props: { border: ["trbl"] } }],
    solution: `1. Select **A1:Q${LAST}** (click A1, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Borders ▾** → **All Borders**.\n\nChecked: every cell A1:Q${LAST} has borders on all four sides.` },
  { marks: 1, text: "Apply AutoFit Column Width to the columns A to Q.",
    criteria: [{ rule: "sheet", path: "autoFitCols", includesAll: letters("A", "Q") }],
    solution: "1. Select the columns **A to Q** (click column letter A, hold Shift, click Q).\n2. HOME → **Format ▾** → **AutoFit Column Width**.\n\n(Double-clicking the line between two column letters also does AutoFit.)\n\nChecked: AutoFit on columns A to Q." },
  { marks: 2, text: "Freeze the Top Row of the sheet, and apply Filter to the complete table A1:Q201.",
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }, { rule: "sheet", path: "filter", in: filterRanges }],
    solution: "1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n2. Click any cell of the table, for example A1. DATA → **Filter** (or **Ctrl+Shift+L**).\n\nDo the Filter step after the formula columns are filled, so it covers the complete table.\n\nChecked: panes frozen below row 1, and a filter on the table." },
  { marks: 1, text: "Center align the Gender column C2:C201.",
    criteria: [{ rule: "cells", range: "C2:C201", props: { align: ["center"] } }],
    solution: "1. Select **C2:C201** (click C2, then **Ctrl+Shift+↓**).\n2. HOME → **Center** (Ctrl+E).\n\nChecked: C2:C201 centred." },
  { marks: 1, text: "Give the sheet tab a Green Tab Color, and rename the sheet Sheet1 to \"Students\".",
    criteria: [{ rule: "sheet", path: "tabColor", equals: ["00B050", "548235", "375623"] }, { rule: "sheet", path: "name", equals: "Students" }],
    solution: "1. **Right-click** the sheet tab → **Tab Color** → Standard Colors → **Green**.\n2. **Right-click** the tab again → **Rename**, type **Students** → Enter.\n\nChecked: the tab colour is green, and the sheet name is Students." },
  { marks: 1, text: "Apply Percentage Number Format with 2 decimal places to the Percentage column L2:L201.",
    criteria: [{ rule: "cells", range: rng("L"), props: { numberFormat: ["Percentage"], decimals: [2] } }],
    solution: "1. Select **L2:L201** (it is already filled in for you -- this question is only about its format).\n2. Right-click → **Format Cells** (Ctrl+1) → **Number** → **Percentage** → 2 decimal places → **OK**.\n\n(The % button plus Increase Decimal twice also works.)\n\nChecked: L2:L201 in Percentage format with 2 decimals." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sheet1", freeze: "A2", filter: `A1:Q${LAST}`, filterHidden: {}, autoFitCols: letters("A", "Q") };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet: { ...sheet, name: "Students", tabColor: "00B050" }, operations: [], savedAt: "2026-11-10T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test8-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test8-model.json", JSON.stringify(model));

// ---------- SQL ----------
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column) : [c]));
fs.writeFileSync("tests/fixtures/excel-test8-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const rowTemplates = Object.fromEntries(Object.entries(ROW_FORMULAS).filter(([c]) => !GIVEN_COLS.includes(c)).map(([c, f]) => [c, f("#")]));
const givenTemplates = Object.fromEntries(GIVEN_COLS.map((c) => [c, ROW_FORMULAS[c]("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: STUDENTS }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 students (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. Columns **K (Total)**, **L (Percentage)** and **M (Result)** are already filled in for you (shown with a light grey background) -- you do not need to redo them.\n5. **Maximum marks** and question-wise marks are shown with the questions.\n6. Complete each task directly in the spreadsheet. Any method is fine (formula, drag and fill, Flash Fill or typing): the answer in the cells is what is checked.";

const sql = `-- English EXCEL EFFICIENCY TEST 8 (built by scripts/build-excel-test8.mjs; do not edit by hand).
-- The harder half of EXCEL EFFICIENCY TEST 4 (nested IF Grade, IF+AND Selection, IF+OR Scholarship, IF+<> Hostel,
-- COUNTIF/COUNTIFS/AVERAGEIF), reused word-for-word, plus 7 new easy formatting questions. Total/Percentage/Result
-- are given/pre-filled in the starting sheet (grey cells) since the harder questions depend on them. Same
-- 200-student data as EXCEL EFFICIENCY TEST 4 (practice paper can be the same for both).
-- Creates the test as a DRAFT: 15 questions, 25 marks, hand-written checks, text solutions and a model answer
-- that scores 25/25. Publish it from Admin -> Excel Efficiency.
-- Safe to run twice.
begin;

create or replace function pg_temp.excel_cell(v jsonb, f text default null, style jsonb default '{}'::jsonb) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) || style $f$;
create or replace function pg_temp.column_checks(vals jsonb, col text, divide numeric) returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', col || (r + 2), 'formula', true,
   'equals', case when divide = 1 then vals->col->r else to_jsonb((vals->col->>r)::numeric / divide) end) order by r)
 from generate_series(0, jsonb_array_length(vals->col) - 1) r $f$;

do $mig$
declare
 t_id uuid; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb;
 admin_id uuid := '1cbaa98b-7310-4d0b-b659-f2fabcbcf86d';
 students jsonb := ${dollar(JSON.stringify(students))}::jsonb;
 headers jsonb := ${dollar(JSON.stringify(HEADERS))}::jsonb;
 summary jsonb := ${dollar(JSON.stringify(SUMMARY))}::jsonb;
 given_cols jsonb := ${dollar(JSON.stringify(GIVEN_COLS))}::jsonb;
 given_templates jsonb := ${dollar(JSON.stringify(givenTemplates))}::jsonb;
 row_templates jsonb := ${dollar(JSON.stringify(rowTemplates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 if exists (select 1 from public.excel_efficiency_tests where slug = 'efficiency-test-8') then raise notice 'EXCEL EFFICIENCY TEST 8 already exists'; return; end if;

 select jsonb_object_agg(ref, cell) into cells from (
   select chr(65 + i) || '1' as ref, pg_temp.excel_cell(headers->i) as cell from generate_series(0, jsonb_array_length(headers) - 1) i
   union all select chr(65 + i) || (r + 2), pg_temp.excel_cell(students->r->i) from generate_series(0, jsonb_array_length(students) - 1) r, generate_series(0, 9) i
   union all select s->>0, pg_temp.excel_cell(s->1) from jsonb_array_elements(summary) s) x;
 -- K, L, M are given: pre-filled with their formula + a light grey fill
 select cells || jsonb_object_agg(t.key || (r + 2), pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text), '{"fillColor":"D9D9D9"}'::jsonb))
   into cells from jsonb_each_text(given_templates) t, generate_series(0, ${STUDENTS - 1}) r;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(row_templates) t, generate_series(0, ${STUDENTS - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 -- E1: header row style
 select model_cells || jsonb_object_agg(chr(65 + i) || '1', (model_cells->(chr(65 + i) || '1')) || '{"bold":true,"fillColor":"FFFF00","wrap":true}'::jsonb)
   into model_cells from generate_series(0, jsonb_array_length(headers) - 1) i;
 -- E2: all borders on the complete table A1:Q201
 select model_cells || jsonb_object_agg(chr(65 + i) || r, (model_cells->(chr(65 + i) || r)) || '{"border":"trbl"}'::jsonb)
   into model_cells from generate_series(1, ${LAST}) r, generate_series(0, jsonb_array_length(headers) - 1) i;
 -- E5: center align Gender C2:C201
 select model_cells || jsonb_object_agg('C' || r, (model_cells->('C' || r)) || '{"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- E7: percentage format L2:L201
 select model_cells || jsonb_object_agg('L' || r, (model_cells->('L' || r)) || '{"numberFormat":"Percentage","decimals":2}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;

 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify({ ...sheet, name: "Students", tabColor: "00B050" }))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-10T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_tests (slug, title, language, status, created_by, sequence, auto_publish_results)
 values ('efficiency-test-8', 'EFFICIENCY TEST 8', 'English', 'draft', admin_id, 8, true) returning id into t_id;
 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 1, 'EFFICIENCY TEST 8', 'English', 'Nested IF, AND, OR, <>, COUNTIF, COUNTIFS, AVERAGEIF and everyday formatting on 200 students (Total/Percentage/Result given)',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9, working, admin_id, false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 1 where id = t_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if not c ? 'column' then crit := crit || jsonb_build_array(c);
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
join public.excel_efficiency_questions q on q.version_id = v.id where t.slug = 'efficiency-test-8' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611101500_excel_test8_recruitment_logic.sql", sql);

// ---------- practice .xlsx (real Excel 2013) ----------
// K, L, M are "given" in initialCells as value:null + formula (the app recomputes them on load); the static .xlsx
// export does not go through the formula engine, so it needs their actual computed value to show anything at all.
const xlsxValue = (ref, cell) => { const m = ref.match(/^([A-Z]+)(\d+)$/); return GIVEN_COLS.includes(m[1]) && +m[2] >= 2 ? value(ref) : cell.value; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rowsXml = [], strings = [], stringIndex = new Map();
const shared = (text) => { if (!stringIndex.has(text)) { stringIndex.set(text, strings.length); strings.push(text); } return stringIndex.get(text); };
const byRow = {};
for (const [ref, c] of Object.entries(initialCells)) { const m = ref.match(/^([A-Z]+)(\d+)$/); (byRow[m[2]] ??= []).push([m[1], xlsxValue(ref, c)]); }
for (const r of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
  const cellsXml = byRow[r].sort((a, b) => a[0].localeCompare(b[0])).map(([c, v]) => typeof v === "number" ? `<c r="${c}${r}"><v>${v}</v></c>` : `<c r="${c}${r}" t="s"><v>${shared(v)}</v></c>`).join("");
  rowsXml.push(`<row r="${r}">${cellsXml}</row>`);
}
const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="2" max="2" width="20" customWidth="1"/><col min="10" max="10" width="12" customWidth="1"/></cols><sheetData>${rowsXml.join("")}</sheetData></worksheet>`,
};
files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((t) => `<si><t>${esc(t)}</t></si>`).join("")}</sst>`;
fs.mkdirSync("docs/excel-practice", { recursive: true });
fs.writeFileSync("docs/excel-practice/EXCEL-TEST-8-practice-200-students.xlsx", zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));
console.log("wrote migration + fixtures + practice xlsx for TEST 8");

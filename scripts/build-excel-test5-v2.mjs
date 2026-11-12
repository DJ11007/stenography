// Builds a migration that adds VERSION 2 to the EXISTING EXCEL EFFICIENCY TEST 5 (test id
// 89d14ede-4263-4510-b42f-1d7469e27ca6) and repoints current_version_id to it. Version 1 (and every attempt graded
// against it) is left completely untouched -- same safety pattern as TEST 4 version 2/3.
//
// Why a new version: test 5 was too hard to finish in 10 minutes (the admin's own words, after attempting it).
// This version drops the hardest 6 questions (VLOOKUP+IFERROR Allowance, RANK, UPPER/LEFT/RIGHT/& Emp Code,
// SUMIF/SUMIFS, INDEX/MATCH, double VLOOKUP) -- they move to the new TEST 9 (scripts/build-excel-test9.mjs) --
// and replaces them with 6 easy formatting-only questions. The sheet is trimmed from 14 columns (A-N) to 12
// (A-L): columns M (Rank) and N (Emp Code) are no longer part of this paper at all. Column K (Allowance) is
// given/pre-filled (grey) since the kept Gross Salary question (L = F+J+K) depends on it.
// Same 200-employee data as TEST 5 and TEST 9 (scripts/lib/excel-test5-dataset.mjs) -- "practice test paper can
// same in both".
//   node scripts/build-excel-test5-v2.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { employees, EMPLOYEES, ALLOWANCES, LAST, col, plain, letters } from "./lib/excel-test5-dataset.mjs";

const TEST_ID = "89d14ede-4263-4510-b42f-1d7469e27ca6";

// ---------- the sheet (A-L: drop Rank/Emp Code -- moved to TEST 9; Allowance (K) given/pre-filled) ----------
const HEADERS = ["Emp ID", "Employee Name", "Department", "Post", "Joining Date", "Basic Pay", "Mobile No",
  "Name (Proper)", "Joining Year", "DA", "Allowance", "Gross Salary"];
const GIVEN_COLS = ["K"]; // pre-filled in the starting sheet, not asked
const EXTRA = {
  S1: plain("Rates", null, { bold: true }), S2: plain("DA Rate"), T2: plain(0.55, null, { numberFormat: "Percentage", decimals: 0 }),
  S5: plain("Post", null, { bold: true }), T5: plain("Allowance", null, { bold: true }),
  ...Object.fromEntries(ALLOWANCES.flatMap(([post, amount], i) => [[`S${6 + i}`, plain(post)], [`T${6 + i}`, plain(amount)]])),
  P1: plain("Summary (use formulas)", null, { bold: true }), Q1: plain("Answer", null, { bold: true }),
  P2: plain("Gross of Education department"), P3: plain("Gross of LDCs in Revenue"), P4: plain("3rd highest Gross"), P5: plain("2nd lowest Gross"),
  P7: plain("Employees who joined in 2015 or later"), P8: plain("Employees without a mobile number"),
};

const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
employees.forEach((row, r) => row.forEach((value, i) => { if (value !== null) initialCells[`${col(i)}${r + 2}`] = plain(value, null, i === 4 ? { numberFormat: "ShortDate" } : {}); }));
Object.assign(initialCells, EXTRA);

const ROW_FORMULAS = {
  H: (r) => `=PROPER(TRIM(B${r}))`,
  I: (r) => `=YEAR(E${r})`,
  J: (r) => `=ROUND(F${r}*$T$2,0)`,
  K: (r) => `=IFERROR(VLOOKUP(D${r},$S$6:$T$10,2,FALSE),0)`,
  L: (r) => `=F${r}+J${r}+K${r}`,
};
const rng = (c) => `${c}2:${c}${LAST}`;
const SUMMARY_FORMULAS = {
  Q2: `=SUMIF(${rng("C")},"Education",${rng("L")})`,
  Q3: `=SUMIFS(${rng("L")},${rng("C")},"Revenue",${rng("D")},"LDC")`,
  Q4: `=LARGE(${rng("L")},3)`,
  Q5: `=SMALL(${rng("L")},2)`,
  Q7: `=COUNTIF(${rng("I")},">=2015")`,
  Q8: `=COUNTBLANK(${rng("G")})`,
};
// K is given: pre-filled with its formula + a light grey fill in the starting sheet.
for (let r = 2; r <= LAST; r++) for (const c of GIVEN_COLS) initialCells[`${c}${r}`] = plain(null, ROW_FORMULAS[c](r), { fillColor: "D9D9D9" });

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) if (!GIVEN_COLS.includes(c)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
// NF1: header row bold, yellow, wrapped
for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}1`], { bold: true, fillColor: "FFFF00", wrap: true });
// NF2: all borders on the complete table (column G has genuinely blank cells for employees with no
// mobile number -- create a blank bordered cell there rather than skipping it)
for (let r = 1; r <= LAST; r++) for (let i = 0; i < HEADERS.length; i++) {
  const ref = `${col(i)}${r}`;
  modelCells[ref] = { ...(modelCells[ref] ?? plain(null)), border: "trbl" };
}
// Q13 (kept): Accounting format on Gross Salary L
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`L${r}`], { numberFormat: "Accounting", currency: null, decimals: 2 });
// NF3: center align Department
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`C${r}`], { align: "center" });
// NF5: center align Emp ID, bold Basic Pay
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`A${r}`], { align: "center" });
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`F${r}`], { bold: true });
// NF6: Comma Style (Number, 0 decimals) + center on DA
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`J${r}`], { numberFormat: "Number", decimals: 0, align: "center" });

const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check of the engine's answers (plain JavaScript, no spreadsheet code) -- same formulas as TEST 5 v1.
{
  const proper = (s) => s.trim().replace(/ +/g, " ").toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  const allowance = Object.fromEntries(ALLOWANCES);
  const rows = employees.map((e) => { const da = Math.round(e[5] * 0.55); const al = allowance[e[3]] ?? 0; return { e, da, al, gross: e[5] + da + al }; });
  const grosses = rows.map((x) => x.gross);
  rows.forEach(({ e, da, al, gross }, i) => {
    const r = i + 2, year = new Date(Date.UTC(1899, 11, 30) + e[4] * 86400000).getUTCFullYear();
    const want = { H: proper(e[1]), I: year, J: da, K: al, L: gross };
    for (const [c, v] of Object.entries(want)) if (value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${JSON.stringify(value(`${c}${r}`))} vs ${JSON.stringify(v)}`);
  });
  const sorted = [...grosses].sort((a, b) => b - a);
  const want = { Q2: rows.filter((x) => x.e[2] === "Education").reduce((a, x) => a + x.gross, 0), Q3: rows.filter((x) => x.e[2] === "Revenue" && x.e[3] === "LDC").reduce((a, x) => a + x.gross, 0),
    Q4: sorted[2], Q5: [...grosses].sort((a, b) => a - b)[1], Q7: rows.filter((x) => value(`I${employees.indexOf(x.e) + 2}`) >= 2015).length, Q8: employees.filter((e) => e[6] === null).length };
  for (const [ref, v] of Object.entries(want)) if (value(ref) !== v) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want);
}

// ---------- marking ----------
const cellCheck = (ref, equals, extra = {}) => ({ rule: "value", cell: ref, equals, formula: true, ...extra });
const columnChecks = (c, caseSensitive) => Array.from({ length: EMPLOYEES }, (_, i) => cellCheck(`${c}${i + 2}`, value(`${c}${i + 2}`), caseSensitive ? { caseSensitive: true } : {}));

const QUESTIONS = [
  { marks: 2, text: "In column H (Name (Proper)) write every Employee Name in proper case without extra spaces, using the PROPER and TRIM functions (for example \"  rAMESH  kumar SHARMA \" becomes \"Ramesh Kumar Sharma\").",
    criteria: [{ column: "H", caseSensitive: true }],
    solution: "**TRIM** removes spaces at the start and end and leaves one space between words. **PROPER** makes the first letter of every word capital and the rest small. One function can go inside another.\n1. Click **H2** and type **=PROPER(TRIM(B2))** → Enter (\"  rAMESH  kumar SHARMA \" → \"Ramesh Kumar Sharma\").\n2. Double-click the fill handle of H2 to fill down to **H201**.\n\nChecked: the exact text (capital letters matter here) in every cell H2:H201." },
  { marks: 1, text: "In column I (Joining Year) find the year of joining from the Joining Date using the YEAR function.",
    criteria: [{ column: "I" }],
    solution: "A date in Excel is a number (days since 1 Jan 1900) shown in date format. **YEAR**, **MONTH** and **DAY** take out one part of it.\n1. Click **I2** and type **=YEAR(E2)** → Enter (16-07-2018 → 2018).\n2. Double-click the fill handle to fill down to **I201**.\n\nChecked: the year in every cell I2:I201." },
  { marks: 2, text: "In column J (DA) find DA = Basic Pay × DA Rate given in cell T2, rounded to 0 decimal places with ROUND. Use an absolute reference ($T$2) so the formula can be filled down.",
    criteria: [{ column: "J" }],
    solution: "When a formula is filled down, every reference moves one row: F2 becomes F3, F4... A **$** sign stops it moving. **$T$2** always points to T2 (press **F4** after typing T2 to add the $ signs).\n1. Click **J2** and type **=ROUND(F2*$T$2,0)** → Enter (24500 × 55% = 13475).\n2. Double-click the fill handle to fill down to **J201**.\n\nChecked: the DA in every cell J2:J201." },
  { marks: 1, text: "In column L (Gross Salary) find Gross Salary = Basic Pay + DA + Allowance. (Allowance in column K is already filled in for you.)",
    criteria: [{ column: "L" }],
    solution: "1. Click **L2** and type **=F2+J2+K2** (or =SUM(F2,J2,K2)) → Enter (24500 + 13475 + 2000 = 39975).\n2. Double-click the fill handle to fill down to **L201**.\n\nChecked: every cell L2:L201." },
  { marks: 2, text: "In Q4 find the 3rd highest Gross Salary using LARGE, and in Q5 the 2nd lowest Gross Salary using SMALL.",
    criteria: [cellCheck("Q4", value("Q4")), cellCheck("Q5", value("Q5"))],
    solution: `**=LARGE(range, k)** gives the k-th highest value, **=SMALL(range, k)** the k-th lowest. LARGE(range,1) is the same as MAX, SMALL(range,1) as MIN.\n1. **Q4**: =LARGE(L2:L201,3) → ${value("Q4")}.\n2. **Q5**: =SMALL(L2:L201,2) → ${value("Q5")}.\n\nChecked: Q4 and Q5, both with formulas.` },
  { marks: 2, text: "In Q7 count the employees who joined in 2015 or later (use column I with COUNTIF), and in Q8 count the employees without a mobile number using COUNTBLANK.",
    criteria: [cellCheck("Q7", value("Q7")), cellCheck("Q8", value("Q8"))],
    solution: `1. **Q7**: =COUNTIF(I2:I201,">=2015") → ${value("Q7")}.\n2. **Q8**: =COUNTBLANK(G2:G201) → ${value("Q8")} (COUNTBLANK counts the empty cells).\n\nChecked: Q7 and Q8, both with formulas.` },
  { marks: 1, text: "Format the Gross Salary range L2:L201 as Accounting Number Format with the ₹ symbol and 2 decimal places.",
    criteria: [{ rule: "cells", range: rng("L"), props: { numberFormat: ["Accounting", "Currency"], currency: [null, "₹"], decimals: [2] } }],
    solution: "1. Select **L2:L201** (click L2, then **Ctrl+Shift+↓**).\n2. HOME → **Accounting Number Format (₹)**. It shows 2 decimal places: ₹ 39,975.00.\n\nChecked: L2:L201 in Accounting or Currency format with ₹ and 2 decimals." },
  { marks: 1, text: "Freeze the top row of the sheet so the headings stay visible while scrolling.",
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }],
    solution: "1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n\nChecked: panes frozen below row 1." },
  { marks: 1, text: "With Conditional Formatting highlight the Top 10 Gross Salaries in L2:L201 with Green Fill with Dark Green Text.",
    criteria: [{ rule: "anyOf", criteria: [10, "10"].flatMap((v) => [rng("L"), `L1:L${LAST}`].map((range) => ({ rule: "sheet", path: "conditionalFormats", includes: { range, type: "top", value: v, style: "greenDarkGreen" } }))) }],
    solution: "1. Select **L2:L201**.\n2. HOME → **Conditional Formatting ▾** → **Top/Bottom Rules** → **Top 10 Items...**\n3. Keep **10**, choose **Green Fill with Dark Green Text** → **OK**.\n\nChecked: a Top 10 rule with the green style on L2:L201." },
  { marks: 2, text: "Make the heading row A1:L1 Bold, give it Yellow fill colour and apply Wrap Text.",
    criteria: [{ rule: "cells", range: "A1:L1", props: { bold: [true], fillColor: ["FFFF00"], wrap: [true] } }],
    solution: "1. Select **A1:L1** (click A1, hold Shift, click L1).\n2. HOME → **Bold** (Ctrl+B).\n3. HOME → **Fill Color ▾** → Standard Colors → **Yellow**.\n4. HOME → **Wrap Text**.\n\nChecked: every heading cell A1 to L1 is bold, yellow and wrapped." },
  { marks: 2, text: "Apply All Borders to the complete table A1:L201.",
    criteria: [{ rule: "cells", range: `A1:L${LAST}`, props: { border: ["trbl"] } }],
    solution: `1. Select **A1:L${LAST}** (click A1, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Borders ▾** → **All Borders**.\n\nChecked: every cell A1:L${LAST} has borders on all four sides.` },
  { marks: 2, text: "Apply AutoFit Column Width to the columns A to L, and Center alignment to the Department column C2:C201.",
    criteria: [{ rule: "sheet", path: "autoFitCols", includesAll: letters("A", "L") }, { rule: "cells", range: "C2:C201", props: { align: ["center"] } }],
    solution: "1. Select the columns **A to L** (click column letter A, hold Shift, click L).\n2. HOME → **Format ▾** → **AutoFit Column Width**.\n3. Select **C2:C201** and click HOME → **Center** (Ctrl+E).\n\nChecked: AutoFit on columns A to L, and C2:C201 centred." },
  { marks: 2, text: "Give the sheet tab a Blue Tab Color, and rename the sheet Sheet1 to \"Employees\".",
    criteria: [{ rule: "sheet", path: "tabColor", equals: ["0070C0", "2E75B6", "1F4E78"] }, { rule: "sheet", path: "name", equals: "Employees" }],
    solution: "1. **Right-click** the sheet tab → **Tab Color** → Standard Colors → **Blue**.\n2. **Right-click** the tab again → **Rename**, type **Employees** → Enter.\n\nChecked: the tab colour is blue, and the sheet name is Employees." },
  { marks: 2, text: "Center align the Emp ID column A2:A201, and Bold the Basic Pay column F2:F201.",
    criteria: [{ rule: "cells", range: "A2:A201", props: { align: ["center"] } }, { rule: "cells", range: "F2:F201", props: { bold: [true] } }],
    solution: "1. Select **A2:A201** and click HOME → **Center** (Ctrl+E).\n2. Select **F2:F201** and click HOME → **Bold** (Ctrl+B).\n\nChecked: A2:A201 centred, F2:F201 bold." },
  { marks: 2, text: "Apply Comma Style (Number Format, 0 decimal places) to the DA column J2:J201, and Center alignment to J2:J201.",
    criteria: [{ rule: "cells", range: "J2:J201", props: { numberFormat: ["Number", "General"], decimals: [0], align: ["center"] } }],
    solution: "1. Select **J2:J201**.\n2. HOME → **Comma Style** (,) button in the Number group.\n3. If it shows 2 decimals, click **Decrease Decimal** twice to reach 0.\n4. HOME → **Center** (Ctrl+E).\n\nChecked: J2:J201 with 0 decimals and centred." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sheet1", freeze: "A2", autoFitCols: letters("A", "L"), conditionalFormats: [{ range: rng("L"), type: "top", value: 10, style: "greenDarkGreen" }] };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet: { ...sheet, name: "Employees", tabColor: "0070C0" }, operations: [], savedAt: "2026-11-12T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test5-v2-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test5-v2-model.json", JSON.stringify(model));

// ---------- SQL ----------
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column, c.caseSensitive) : [c]));
fs.writeFileSync("tests/fixtures/excel-test5-v2-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const rowTemplates = Object.fromEntries(Object.entries(ROW_FORMULAS).filter(([c]) => !GIVEN_COLS.includes(c)).map(([c, f]) => [c, f("#")]));
const givenTemplates = Object.fromEntries(GIVEN_COLS.map((c) => [c, ROW_FORMULAS[c]("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: EMPLOYEES }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const fixedCells = { ...EXTRA, ...Object.fromEntries(HEADERS.map((text, i) => [`${col(i)}1`, initialCells[`${col(i)}1`]])) };
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 employees (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. Column **K (Allowance)** is already filled in for you (shown with a light grey background) -- you do not need to redo it.\n5. **Maximum marks** and question-wise marks are shown with the questions.\n6. Complete each task directly in the spreadsheet. Any method is fine (formula, drag and fill, Flash Fill or typing): the answer in the cells is what is checked.";

const sql = `-- English EXCEL EFFICIENCY TEST 5, VERSION 2 (built by scripts/build-excel-test5-v2.mjs; do not edit by hand).
-- The admin found version 1 too hard to finish in 10 minutes. This version drops the hardest 6 questions
-- (VLOOKUP+IFERROR Allowance, RANK, UPPER/LEFT/RIGHT/& Emp Code, SUMIF/SUMIFS, INDEX/MATCH, double VLOOKUP) --
-- they move to the new EXCEL EFFICIENCY TEST 9 -- and replaces them with 6 easy formatting-only questions.
-- Allowance (K) is given/pre-filled (grey) since the kept Gross Salary question depends on it. Version 1 (and
-- every attempt already graded against it) is left completely untouched: this inserts a NEW version row and
-- repoints current_version_id, it never updates version 1's rows.
-- Safe to run twice.
begin;

do $mig$
declare def text;
begin
 def := pg_get_functiondef('public.excel_efficiency_criterion_matches(jsonb,jsonb)'::regprocedure);
 if position('caseSensitive' in def) = 0 then raise exception 'caseSensitive support missing from excel_efficiency_criterion_matches -- run migration 202611081500 first'; end if;
end $mig$;

create or replace function pg_temp.excel_cell(v jsonb, f text default null, style jsonb default '{}'::jsonb) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) || style $f$;
create or replace function pg_temp.column_checks(vals jsonb, col text, case_sensitive boolean) returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', col || (r + 2), 'formula', true, 'equals', vals->col->r)
   || case when case_sensitive then '{"caseSensitive":true}'::jsonb else '{}'::jsonb end order by r)
 from generate_series(0, jsonb_array_length(vals->col) - 1) r $f$;

do $mig$
declare
 t_id uuid := '${TEST_ID}'; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb; next_version int;
 employees jsonb := ${dollar(JSON.stringify(employees))}::jsonb;
 fixed jsonb := ${dollar(JSON.stringify(fixedCells))}::jsonb;
 row_templates jsonb := ${dollar(JSON.stringify(rowTemplates))}::jsonb;
 given_templates jsonb := ${dollar(JSON.stringify(givenTemplates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 select coalesce(max(version_number), 0) + 1 into next_version from public.excel_efficiency_versions where test_id = t_id;
 if next_version <> 2 then raise notice 'EXCEL EFFICIENCY TEST 5 already has version %, skipping', next_version; return; end if;

 select fixed || jsonb_object_agg(chr(65 + i) || (r + 2), pg_temp.excel_cell(employees->r->i, null, case when i = 4 then '{"numberFormat":"ShortDate"}'::jsonb else '{}'::jsonb end)) into cells
 from generate_series(0, jsonb_array_length(employees) - 1) r, generate_series(0, 6) i where jsonb_typeof(employees->r->i) <> 'null';
 select cells || jsonb_object_agg(t.key || (r + 2), pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text), '{"fillColor":"D9D9D9"}'::jsonb))
   into cells from jsonb_each_text(given_templates) t, generate_series(0, ${EMPLOYEES - 1}) r;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(row_templates) t, generate_series(0, ${EMPLOYEES - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 -- NF1: header row style
 select model_cells || jsonb_object_agg(chr(65 + i) || '1', (model_cells->(chr(65 + i) || '1')) || '{"bold":true,"fillColor":"FFFF00","wrap":true}'::jsonb)
   into model_cells from generate_series(0, 11) i;
 -- NF2: all borders on the complete table A1:L201 (column G has genuinely blank cells for employees
 -- with no mobile number -- create a blank bordered cell there rather than skipping it)
 select model_cells || jsonb_object_agg(chr(65 + i) || r, coalesce(model_cells->(chr(65 + i) || r), pg_temp.excel_cell('null'::jsonb)) || '{"border":"trbl"}'::jsonb)
   into model_cells from generate_series(1, ${LAST}) r, generate_series(0, 11) i;
 -- Accounting format on Gross Salary L2:L201
 select model_cells || jsonb_object_agg('L' || r, (model_cells->('L' || r)) || '{"numberFormat":"Accounting","currency":null,"decimals":2}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- NF3: center align Department C2:C201
 select model_cells || jsonb_object_agg('C' || r, (model_cells->('C' || r)) || '{"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- NF5: center Emp ID A2:A201, bold Basic Pay F2:F201
 select model_cells || jsonb_object_agg('A' || r, (model_cells->('A' || r)) || '{"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 select model_cells || jsonb_object_agg('F' || r, (model_cells->('F' || r)) || '{"bold":true}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- NF6: Comma Style + center on DA J2:J201
 select model_cells || jsonb_object_agg('J' || r, (model_cells->('J' || r)) || '{"numberFormat":"Number","decimals":0,"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;

 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify({ ...sheet, name: "Employees", tabColor: "0070C0" }))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-12T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 2, 'EFFICIENCY TEST 5', 'English', 'PROPER/TRIM, YEAR, $ references, LARGE/SMALL, COUNTIF/COUNTBLANK and everyday formatting on 200 employees (easier than version 1)',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9,
   working, (select created_by from public.excel_efficiency_tests where id = t_id), false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 2 where id = t_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if c ? 'column' then crit := crit || pg_temp.column_checks(vals, c->>'column', coalesce((c->>'caseSensitive')::boolean, false));
   else crit := crit || jsonb_build_array(c);
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
fs.writeFileSync("supabase/migrations/202611121500_excel_test5_v2_easier.sql", sql);
console.log("wrote migration + fixtures for TEST 5 version 2");

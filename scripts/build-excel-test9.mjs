// Builds a migration that creates a brand-new EXCEL EFFICIENCY TEST 9, the harder half of the TEST 5 split
// (see scripts/build-excel-test5-v2.mjs). Gets the 6 hardest questions from original TEST 5 (VLOOKUP+IFERROR
// Allowance, RANK, UPPER/LEFT/RIGHT/& Emp Code, SUMIF/SUMIFS, INDEX/MATCH, double VLOOKUP) plus 9 new easy
// formatting questions, to reach 15 questions / 25 marks -- same "split a too-hard test into two" pattern as
// TEST 4 -> TEST 8.
// Full A-N (14 column) layout kept. H (Name Proper), I (Joining Year), J (DA) are given/pre-filled (grey) since
// they feed later columns but their own questions moved to TEST 5 v2. L (Gross Salary) is also given, but as a
// GIVEN FORMULA (=F+J+K) rather than a plain value, so it recomputes live once the student fills in K (Allowance)
// themselves -- K is one of the ASKED columns here (original-Q4). M (Rank) and N (Emp Code) are the other asked
// columns. Same 200-employee data as TEST 5 / TEST 5 v2 (scripts/lib/excel-test5-dataset.mjs).
//   node scripts/build-excel-test9.mjs
import fs from "node:fs";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { employees, EMPLOYEES, ALLOWANCES, LAST, col, plain, letters } from "./lib/excel-test5-dataset.mjs";

// ---------- the sheet (A-N: full original layout; H/I/J/L given, K/M/N asked) ----------
const HEADERS = ["Emp ID", "Employee Name", "Department", "Post", "Joining Date", "Basic Pay", "Mobile No",
  "Name (Proper)", "Joining Year", "DA", "Allowance", "Gross Salary", "Rank", "Emp Code"];
const GIVEN_COLS = ["H", "I", "J", "L"];
const EXTRA = {
  S1: plain("Rates", null, { bold: true }), S2: plain("DA Rate"), T2: plain(0.55, null, { numberFormat: "Percentage", decimals: 0 }),
  S5: plain("Post", null, { bold: true }), T5: plain("Allowance", null, { bold: true }),
  ...Object.fromEntries(ALLOWANCES.flatMap(([post, amount], i) => [[`S${6 + i}`, plain(post)], [`T${6 + i}`, plain(amount)]])),
  P1: plain("Summary (use formulas)", null, { bold: true }), Q1: plain("Answer", null, { bold: true }),
  P2: plain("Gross of Education department"), P3: plain("Gross of LDCs in Revenue"),
  P6: plain("Name of the highest-paid employee"), P9: plain("Gross Salary of employee RJ26150"), P10: plain("Post of employee RJ26150"),
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
  M: (r) => `=RANK(L${r},$L$2:$L$${LAST})`,
  N: (r) => `=UPPER(LEFT(C${r},3))&"-"&RIGHT(A${r},3)`,
};
const rng = (c) => `${c}2:${c}${LAST}`;
const SUMMARY_FORMULAS = {
  Q2: `=SUMIF(${rng("C")},"Education",${rng("L")})`,
  Q3: `=SUMIFS(${rng("L")},${rng("C")},"Revenue",${rng("D")},"LDC")`,
  Q6: `=INDEX(${rng("H")},MATCH(MAX(${rng("L")}),${rng("L")},0))`,
  Q9: `=VLOOKUP("RJ26150",A2:L${LAST},12,FALSE)`,
  Q10: `=VLOOKUP("RJ26150",A2:L${LAST},4,FALSE)`,
};

// H, I, J given with their formulas + grey fill. L given with ITS FORMULA too (so it recomputes once K is filled).
for (let r = 2; r <= LAST; r++) for (const c of GIVEN_COLS) initialCells[`${c}${r}`] = plain(null, ROW_FORMULAS[c](r), { fillColor: "D9D9D9" });

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) if (!GIVEN_COLS.includes(c)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
// header row style
for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}1`], { bold: true, fillColor: "FFFF00", wrap: true });
// all borders A1:N201 (G has genuinely blank cells for employees with no mobile number)
for (let r = 1; r <= LAST; r++) for (let i = 0; i < HEADERS.length; i++) {
  const ref = `${col(i)}${r}`;
  modelCells[ref] = { ...(modelCells[ref] ?? plain(null)), border: "trbl" };
}
// center Department
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`C${r}`], { align: "center" });
// Accounting ₹ format on Gross Salary L
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`L${r}`], { numberFormat: "Accounting", currency: null, decimals: 2 });
// italic Post
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`D${r}`], { italic: true });
// Comma Style + center Basic Pay
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`F${r}`], { numberFormat: "Number", decimals: 0, align: "center" });

const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check of the engine's answers (plain JavaScript, no spreadsheet code) -- same formulas as TEST 5 v1.
{
  const proper = (s) => s.trim().replace(/ +/g, " ").toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  const allowance = Object.fromEntries(ALLOWANCES);
  const rows = employees.map((e) => { const da = Math.round(e[5] * 0.55); const al = allowance[e[3]] ?? 0; return { e, da, al, gross: e[5] + da + al }; });
  rows.forEach(({ e, da, al, gross }, i) => {
    const r = i + 2, year = new Date(Date.UTC(1899, 11, 30) + e[4] * 86400000).getUTCFullYear();
    const want = { H: proper(e[1]), I: year, J: da, K: al, L: gross, N: `${e[2].slice(0, 3).toUpperCase()}-${e[0].slice(-3)}` };
    for (const [c, v] of Object.entries(want)) if (value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${JSON.stringify(value(`${c}${r}`))} vs ${JSON.stringify(v)}`);
  });
  const grosses = rows.map((x) => x.gross);
  const ranks = grosses.map((g) => grosses.filter((o) => o > g).length + 1);
  ranks.forEach((rk, i) => { if (value(`M${i + 2}`) !== rk) throw new Error(`M${i + 2}: engine ${value(`M${i + 2}`)} vs ${rk}`); });
  const topName = rows[grosses.indexOf(Math.max(...grosses))].e[1];
  const want = { Q6: proper(topName), Q2: rows.filter((x) => x.e[2] === "Education").reduce((a, x) => a + x.gross, 0),
    Q3: rows.filter((x) => x.e[2] === "Revenue" && x.e[3] === "LDC").reduce((a, x) => a + x.gross, 0),
    Q9: rows[149].gross, Q10: employees[149][3] };
  for (const [ref, v] of Object.entries(want)) if (value(ref) !== v) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want);
}

// ---------- marking ----------
const cellCheck = (ref, equals, extra = {}) => ({ rule: "value", cell: ref, equals, formula: true, ...extra });
const columnChecks = (c, caseSensitive) => Array.from({ length: EMPLOYEES }, (_, i) => cellCheck(`${c}${i + 2}`, value(`${c}${i + 2}`), caseSensitive ? { caseSensitive: true } : {}));

const QUESTIONS = [
  { marks: 2, text: "In column K (Allowance) look up the Allowance for each employee's Post from the table S5:T10, using VLOOKUP wrapped in IFERROR so a post with no listed allowance shows 0 instead of an error.",
    criteria: [{ column: "K" }],
    solution: "**VLOOKUP(what to find, where to look, which column, FALSE)** finds a value in the leftmost column of a table and returns a value from another column of the same row. **IFERROR(formula, value if error)** shows a chosen value instead of an error like #N/A.\n1. Click **K2** and type **=IFERROR(VLOOKUP(D2,$S$6:$T$10,2,FALSE),0)** → Enter.\n2. Double-click the fill handle to fill down to **K201**.\n\nChecked: the Allowance in every cell K2:K201." },
  { marks: 2, text: "In column M (Rank) find the rank of each employee's Gross Salary (column L) among all 200 employees, highest = 1, using the RANK function.",
    criteria: [{ column: "M" }],
    solution: "**RANK(number, range)** tells you the position of a number when the whole range is sorted highest to lowest (by default). Use an absolute reference ($L$2:$L$201) so the range does not move when filled down.\n1. Click **M2** and type **=RANK(L2,$L$2:$L$201)** → Enter.\n2. Double-click the fill handle to fill down to **M201**.\n\nChecked: the rank in every cell M2:M201." },
  { marks: 2, text: "In column N (Emp Code) build a code as the first 3 letters of Department in CAPITALS, a hyphen, then the last 3 digits of Emp ID (for example Revenue + RJ26001 → \"REV-001\"), using UPPER, LEFT, RIGHT and the & operator.",
    criteria: [{ column: "N", caseSensitive: true }],
    solution: "**LEFT(text, n)** takes the first n letters, **RIGHT(text, n)** the last n letters, **UPPER** makes letters capital, and **&** joins pieces of text together.\n1. Click **N2** and type **=UPPER(LEFT(C2,3))&\"-\"&RIGHT(A2,3)** → Enter (Revenue, RJ26001 → \"REV-001\").\n2. Double-click the fill handle to fill down to **N201**.\n\nChecked: the exact text (capital letters matter here) in every cell N2:N201." },
  { marks: 2, text: "In Q8 find the total Gross Salary of the Education department using SUMIF, and the total Gross Salary of LDCs in the Revenue department using SUMIFS (two separate answer cells are shown next to Q8 in the sheet).",
    criteria: [cellCheck("Q2", value("Q2")), cellCheck("Q3", value("Q3"))],
    solution: `**SUMIF(range to check, condition, range to add)** adds values that meet ONE condition. **SUMIFS(range to add, range1, condition1, range2, condition2, ...)** adds values that meet MULTIPLE conditions (notice the range to add comes FIRST in SUMIFS, not last).\n1. Gross of Education: =SUMIF(C2:C201,"Education",L2:L201) → ${value("Q2")}.\n2. Gross of LDCs in Revenue: =SUMIFS(L2:L201,C2:C201,"Revenue",D2:D201,"LDC") → ${value("Q3")}.\n\nChecked: both answer cells, with formulas.` },
  { marks: 2, text: "In Q6 find the Name (Proper) of the highest-paid employee (by Gross Salary) using INDEX and MATCH together.",
    criteria: [cellCheck("Q6", value("Q6"))],
    solution: `**MATCH(value, range, 0)** finds the POSITION of a value in a range. **INDEX(range, position)** returns the value at that position in another range. Together they look up a name by finding where the maximum salary is.\n1. Click **Q6** and type **=INDEX(H2:H201,MATCH(MAX(L2:L201),L2:L201,0))** → Enter → "${value("Q6")}".\n\nChecked: Q6, with formula.` },
  { marks: 2, text: "In Q9 find the Gross Salary of employee RJ26150, and in Q10 find the Post of employee RJ26150, both using VLOOKUP.",
    criteria: [cellCheck("Q9", value("Q9")), cellCheck("Q10", value("Q10"))],
    solution: `Count the columns of the table from its first column: A = 1, B = 2, C = 3, D = 4 ... L = 12.\n1. **Q9**: =VLOOKUP("RJ26150",A2:L201,12,FALSE) → ${value("Q9")}.\n2. **Q10**: =VLOOKUP("RJ26150",A2:L201,4,FALSE) → ${value("Q10")}.\n\nAlways write FALSE (exact match) when looking up an ID or a name; TRUE (approximate) needs a sorted list and can give a wrong row.\n\nChecked: Q9 and Q10, both with formulas.` },
  { marks: 2, text: "Make the heading row A1:N1 Bold, give it Yellow fill colour and apply Wrap Text.",
    criteria: [{ rule: "cells", range: "A1:N1", props: { bold: [true], fillColor: ["FFFF00"], wrap: [true] } }],
    solution: "1. Select **A1:N1** (click A1, hold Shift, click N1).\n2. HOME → **Bold** (Ctrl+B).\n3. HOME → **Fill Color ▾** → Standard Colors → **Yellow**.\n4. HOME → **Wrap Text**.\n\nChecked: every heading cell A1 to N1 is bold, yellow and wrapped." },
  { marks: 2, text: "Apply All Borders to the complete table A1:N201.",
    criteria: [{ rule: "cells", range: `A1:N${LAST}`, props: { border: ["trbl"] } }],
    solution: `1. Select **A1:N${LAST}** (click A1, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Borders ▾** → **All Borders**.\n\nChecked: every cell A1:N${LAST} has borders on all four sides.` },
  { marks: 1, text: "Apply AutoFit Column Width to the columns A to N.",
    criteria: [{ rule: "sheet", path: "autoFitCols", includesAll: letters("A", "N") }],
    solution: "1. Select the columns **A to N** (click column letter A, hold Shift, click N).\n2. HOME → **Format ▾** → **AutoFit Column Width**.\n\nChecked: AutoFit is applied to every column A to N." },
  { marks: 2, text: "Freeze the top row of the sheet and apply a Filter to the complete table A1:N201.",
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }, { rule: "sheet", path: "filter", equals: `A1:N${LAST}` }],
    solution: `1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n2. Select **A1:N${LAST}** and click DATA → **Filter**.\n\nChecked: panes frozen below row 1, and a filter applied on A1:N${LAST}.` },
  { marks: 1, text: "Center align the Department column C2:C201.",
    criteria: [{ rule: "cells", range: "C2:C201", props: { align: ["center"] } }],
    solution: "1. Select **C2:C201** and click HOME → **Center** (Ctrl+E).\n\nChecked: C2:C201 centred." },
  { marks: 1, text: "Give the sheet tab a Green Tab Color, and rename the sheet Sheet1 to \"Employees\".",
    criteria: [{ rule: "sheet", path: "tabColor", equals: ["00B050", "548235", "375623"] }, { rule: "sheet", path: "name", equals: "Employees" }],
    solution: "1. **Right-click** the sheet tab → **Tab Color** → Standard Colors → **Green**.\n2. **Right-click** the tab again → **Rename**, type **Employees** → Enter.\n\nChecked: the tab colour is green, and the sheet name is Employees." },
  { marks: 1, text: "Format the Gross Salary range L2:L201 as Accounting Number Format with the ₹ symbol and 2 decimal places.",
    criteria: [{ rule: "cells", range: rng("L"), props: { numberFormat: ["Accounting", "Currency"], currency: [null, "₹"], decimals: [2] } }],
    solution: "1. Select **L2:L201**.\n2. HOME → **Accounting Number Format (₹)**. It shows 2 decimal places: ₹ 39,975.00.\n\nChecked: L2:L201 in Accounting or Currency format with ₹ and 2 decimals." },
  { marks: 1, text: "Apply Italic to the Post column D2:D201.",
    criteria: [{ rule: "cells", range: "D2:D201", props: { italic: [true] } }],
    solution: "1. Select **D2:D201** and click HOME → **Italic** (Ctrl+I).\n\nChecked: D2:D201 in italics." },
  { marks: 2, text: "Apply Comma Style (Number Format, 0 decimal places) to the Basic Pay column F2:F201, and Center alignment to F2:F201.",
    criteria: [{ rule: "cells", range: "F2:F201", props: { numberFormat: ["Number", "General"], decimals: [0], align: ["center"] } }],
    solution: "1. Select **F2:F201**.\n2. HOME → **Comma Style** (,) button in the Number group.\n3. If it shows 2 decimals, click **Decrease Decimal** twice to reach 0.\n4. HOME → **Center** (Ctrl+E).\n\nChecked: F2:F201 with 0 decimals and centred." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sheet1", freeze: "A2", filter: `A1:N${LAST}`, autoFitCols: letters("A", "N") };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet: { ...sheet, name: "Employees", tabColor: "00B050" }, operations: [], savedAt: "2026-11-12T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test9-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test9-model.json", JSON.stringify(model));

// ---------- SQL ----------
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column, c.caseSensitive) : [c]));
fs.writeFileSync("tests/fixtures/excel-test9-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const rowTemplates = Object.fromEntries(Object.entries(ROW_FORMULAS).filter(([c]) => !GIVEN_COLS.includes(c)).map(([c, f]) => [c, f("#")]));
const givenTemplates = Object.fromEntries(GIVEN_COLS.map((c) => [c, ROW_FORMULAS[c]("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: EMPLOYEES }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const fixedCells = { ...EXTRA, ...Object.fromEntries(HEADERS.map((text, i) => [`${col(i)}1`, initialCells[`${col(i)}1`]])) };
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 employees (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. Columns **H (Name Proper), I (Joining Year), J (DA) and L (Gross Salary)** are already filled in for you (shown with a light grey background) -- you do not need to redo them. Gross Salary (L) will update on its own once you fill in Allowance (K).\n5. **Maximum marks** and question-wise marks are shown with the questions.\n6. Complete each task directly in the spreadsheet. Any method is fine (formula, drag and fill, Flash Fill or typing): the answer in the cells is what is checked.";

const sql = `-- English EXCEL EFFICIENCY TEST 9 (built by scripts/build-excel-test9.mjs; do not edit by hand).
-- The harder half of EXCEL EFFICIENCY TEST 5's split (the admin found version 1 too hard for 10 minutes -- see
-- 202611121500_excel_test5_v2_easier.sql). Carries the 6 hardest TEST 5 questions (VLOOKUP+IFERROR Allowance,
-- RANK, UPPER/LEFT/RIGHT/& Emp Code, SUMIF/SUMIFS, INDEX/MATCH, double VLOOKUP) plus 9 new easy formatting
-- questions, to reach 15 questions / 25 marks. Columns H/I/J/L are given/pre-filled (grey) -- L specifically as
-- a GIVEN FORMULA (=F+J+K) so it recomputes once the student fills in K (Allowance) themselves. A brand-new
-- test: creates its own excel_efficiency_tests row, does not touch TEST 5 in any version.
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
 t_id uuid; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb;
 employees jsonb := ${dollar(JSON.stringify(employees))}::jsonb;
 fixed jsonb := ${dollar(JSON.stringify(fixedCells))}::jsonb;
 row_templates jsonb := ${dollar(JSON.stringify(rowTemplates))}::jsonb;
 given_templates jsonb := ${dollar(JSON.stringify(givenTemplates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb; admin_id uuid;
begin
 if exists (select 1 from public.excel_efficiency_tests where slug = 'efficiency-test-9') then
  raise notice 'EXCEL EFFICIENCY TEST 9 already exists, skipping'; return;
 end if;
 select created_by into admin_id from public.excel_efficiency_tests where id = '89d14ede-4263-4510-b42f-1d7469e27ca6';

 select fixed || jsonb_object_agg(chr(65 + i) || (r + 2), pg_temp.excel_cell(employees->r->i, null, case when i = 4 then '{"numberFormat":"ShortDate"}'::jsonb else '{}'::jsonb end)) into cells
 from generate_series(0, jsonb_array_length(employees) - 1) r, generate_series(0, 6) i where jsonb_typeof(employees->r->i) <> 'null';
 select cells || jsonb_object_agg(t.key || (r + 2), pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text), '{"fillColor":"D9D9D9"}'::jsonb))
   into cells from jsonb_each_text(given_templates) t, generate_series(0, ${EMPLOYEES - 1}) r;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(row_templates) t, generate_series(0, ${EMPLOYEES - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 -- header row style
 select model_cells || jsonb_object_agg(chr(65 + i) || '1', (model_cells->(chr(65 + i) || '1')) || '{"bold":true,"fillColor":"FFFF00","wrap":true}'::jsonb)
   into model_cells from generate_series(0, 13) i;
 -- all borders A1:N201 (G has genuinely blank cells for employees with no mobile number)
 select model_cells || jsonb_object_agg(chr(65 + i) || r, coalesce(model_cells->(chr(65 + i) || r), pg_temp.excel_cell('null'::jsonb)) || '{"border":"trbl"}'::jsonb)
   into model_cells from generate_series(1, ${LAST}) r, generate_series(0, 13) i;
 -- center Department C2:C201
 select model_cells || jsonb_object_agg('C' || r, (model_cells->('C' || r)) || '{"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- Accounting ₹ format on Gross Salary L2:L201
 select model_cells || jsonb_object_agg('L' || r, (model_cells->('L' || r)) || '{"numberFormat":"Accounting","currency":null,"decimals":2}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- italic Post D2:D201
 select model_cells || jsonb_object_agg('D' || r, (model_cells->('D' || r)) || '{"italic":true}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 -- Comma Style + center Basic Pay F2:F201
 select model_cells || jsonb_object_agg('F' || r, (model_cells->('F' || r)) || '{"numberFormat":"Number","decimals":0,"align":"center"}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;

 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify({ ...sheet, name: "Employees", tabColor: "00B050" }))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-12T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_tests (slug, title, language, status, created_by, sequence, auto_publish_results)
 values ('efficiency-test-9', 'EFFICIENCY TEST 9', 'English', 'draft', admin_id, 9, true) returning id into t_id;

 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 1, 'EFFICIENCY TEST 9', 'English', 'VLOOKUP+IFERROR, RANK, UPPER/LEFT/RIGHT/&, SUMIF/SUMIFS, INDEX/MATCH, double VLOOKUP and everyday formatting on 200 employees',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9,
   working, admin_id, false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 1 where id = t_id;

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
join public.excel_efficiency_questions q on q.version_id = v.id where t.slug = 'efficiency-test-9' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611121600_excel_test9_split.sql", sql);
console.log("wrote migration + fixtures for TEST 9");

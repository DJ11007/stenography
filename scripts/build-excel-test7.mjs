// Builds supabase/migrations/202611091400_excel_test7_recruitment_advanced.sql: English EXCEL EFFICIENCY TEST 7, an
// ADVANCED-level paper -- a recruitment exam sheet of 499 candidates (rows 2-500), 15 questions, 25 marks, solvable
// in about 10 minutes (one formula typed and filled down per column, same effort regardless of row count).
// Raises the sheet's row cap from 300 to 500 (workspace, saved-sheet checks and the database -- same technique as
// migration 202611081400, which raised it from 200 to 300).
// New ground not covered by Tests 1-6: Theme Colour fill, Format as Table (a named table style with header +
// banded rows), IFS, HLOOKUP, SUMPRODUCT, MEDIAN.
// Every expected answer comes from the workspace's own formula engine (lib/excel-formula.ts). Also writes
// tests/fixtures/excel-test7-*.json and docs/excel-practice/EXCEL-TEST-7-practice-499-candidates.xlsx.
//   node scripts/build-excel-test7.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";

// ---------- deterministic data (499 candidates) ----------
let seed = 20261109;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const FIRST_M = ["Rajnish", "Mukesh", "Pradeep", "Harish", "Ankit", "Vinod", "Sunil", "Tarun", "Rohit", "Naresh", "Dinesh", "Sandeep", "Kamlesh", "Gopal", "Rakesh", "Manish", "Aarav", "Kuldeep", "Yogesh", "Bhanu"];
const FIRST_F = ["Pooja", "Jyoti", "Priya", "Seema", "Mamta", "Ritu", "Komal", "Lalita", "Aarti", "Manisha", "Payal", "Neha", "Sunita", "Kavita", "Anjali", "Suman", "Nisha", "Deepika", "Monika", "Pinki"];
const LAST = ["Sharma", "Meena", "Saini", "Rathore", "Gurjar", "Jat", "Choudhary", "Yadav", "Soni", "Bishnoi", "Khandelwal", "Parihar", "Shekhawat", "Dadhich", "Verma", "Mali", "Regar", "Agarwal", "Swami", "Jangid"];
const DISTRICTS = ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Udaipur", "Ajmer"];
const ZONES = { Jaipur: "Zone A", Jodhpur: "Zone B", Kota: "Zone A", Bikaner: "Zone C", Udaipur: "Zone B", Ajmer: "Zone C" };
const CATEGORIES = ["GEN", "OBC", "SC", "ST", "EWS"];
const ROWS = 499, LAST_ROW = ROWS + 1; // rows 2..500
const candidates = Array.from({ length: ROWS }, (_, i) => {
  const female = rnd() < 0.5;
  const name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
  const written = 15 + Math.floor(rnd() * 34); // 15-48
  const interview = 5 + Math.floor(rnd() * 15); // 5-19
  const gk = 2 + Math.floor(rnd() * 8); // 2-9
  const typing = 15 + Math.floor(rnd() * 30); // 15-44
  return [`C${1001 + i}`, name, female ? "F" : "M", pick(DISTRICTS), pick(CATEGORIES), written, interview, gk, typing];
});

// ---------- the sheet ----------
const HEADERS = ["Cand ID", "Candidate Name", "Gender", "District", "Category", "Written (/50)", "Interview (/20)", "GK (/10)", "Typing (WPM)",
  "Total", "Percentage", "Grade", "Result", "Selection", "Fee Waiver", "Zone"];
const col = (i) => String.fromCharCode(65 + i);
const plain = (value, formula = null, extra = {}) => ({ value, formula, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null, ...extra });
const ZONE_TABLE = {}; DISTRICTS.forEach((d, i) => { ZONE_TABLE[`${col(17 + i)}1`] = plain(d); ZONE_TABLE[`${col(17 + i)}2`] = plain(ZONES[d]); }); // R1:W2
const SUMMARY_LABELS = { X1: "Summary (use formulas)", Y1: "Answer", X2: "Total candidates", X3: "Median Total", X4: "Admission Index: sum of Written x Typing Speed (SUMPRODUCT)",
  X5: "Girls who Qualified (COUNTIFS)", X6: "Avg Written of SC category, 2 dp (AVERAGEIFS)" };
const EXTRA = { ...ZONE_TABLE, ...Object.fromEntries(Object.entries(SUMMARY_LABELS).map(([ref, text]) => [ref, plain(text, null, ref === "X1" || ref === "Y1" ? { bold: true } : {})])) };
const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
candidates.forEach((row, r) => row.forEach((value, i) => { initialCells[`${col(i)}${r + 2}`] = plain(value); }));
Object.assign(initialCells, EXTRA);

const ROW_FORMULAS = {
  J: (r) => `=SUM(F${r}:H${r})`,
  K: (r) => `=ROUND(J${r}/80*100,2)`,
  L: (r) => `=IFS(K${r}>=80,"A+",K${r}>=65,"A",K${r}>=50,"B",K${r}>=35,"C",TRUE,"D")`,
  M: (r) => `=IF(J${r}>=40,"Qualified","Not Qualified")`,
  N: (r) => `=IF(AND(M${r}="Qualified",I${r}>=30),"Selected","Not Selected")`,
  O: (r) => `=IF(OR(E${r}="SC",E${r}="ST"),"Yes","No")`,
  P: (r) => `=HLOOKUP(D${r},$R$1:$W$2,2,FALSE)`,
};
const rng = (c) => `${c}2:${c}${LAST_ROW}`;
const SUMMARY_FORMULAS = {
  Y2: `=COUNTA(${rng("B")})`,
  Y3: `=MEDIAN(${rng("J")})`,
  Y4: `=SUMPRODUCT(${rng("F")},${rng("I")})`,
  Y5: `=COUNTIFS(${rng("C")},"F",${rng("M")},"Qualified")`,
  Y6: `=ROUND(AVERAGEIFS(${rng("F")},${rng("E")},"SC"),2)`,
};

// Format as Table ("Table Style Medium 3": header ED7D31/white bold, band FCE4D6 / white alternating) over A1:P500,
// plus Theme Colour ("Blue, Accent 1") on the Zone lookup table header R1:W1.
const TABLE_HEADER_FILL = "ED7D31", TABLE_HEADER_FONT = "FFFFFF", TABLE_BAND = "FCE4D6";
const THEME_BLUE_ACCENT1 = "5B9BD5";
const patches = {};
const patch = (ref, props) => { patches[ref] = { ...(patches[ref] ?? {}), ...props }; };
for (let i = 0; i < HEADERS.length; i++) patch(`${col(i)}1`, { bold: true, fillColor: TABLE_HEADER_FILL, fontColor: TABLE_HEADER_FONT });
for (const ref of ["R1", "S1", "T1", "U1", "V1", "W1"]) patch(ref, { bold: true, fillColor: THEME_BLUE_ACCENT1, fontColor: "FFFFFF", align: "center" });
// sqlPatches is what gets embedded as a literal in the migration (just the 22 header/theme cells); the 499-row
// column-A band pattern is generated server-side by pg_temp.band_patches() instead, to keep the migration file
// a reasonable size. jsPatches (used only for the local model/fixtures) includes the band pattern explicitly.
const sqlPatches = structuredClone(patches);
const jsPatches = structuredClone(patches);
for (let r = 2; r <= LAST_ROW; r++) jsPatches[`A${r}`] = { ...(jsPatches[`A${r}`] ?? {}), fillColor: (r - 1) % 2 === 0 ? TABLE_BAND : "FFFFFF" };

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST_ROW; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
for (const [ref, props] of Object.entries(jsPatches)) Object.assign(modelCells[ref], props);
const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check in plain JavaScript.
{
  const rows = candidates.map(([id, name, gender, district, category, written, interview, gk, typing]) => {
    const total = written + interview + gk, pct = Math.round((total / 80) * 10000) / 100;
    const grade = pct >= 80 ? "A+" : pct >= 65 ? "A" : pct >= 50 ? "B" : pct >= 35 ? "C" : "D";
    const result = total >= 40 ? "Qualified" : "Not Qualified";
    const selection = result === "Qualified" && typing >= 30 ? "Selected" : "Not Selected";
    const waiver = category === "SC" || category === "ST" ? "Yes" : "No";
    const zone = ZONES[district];
    return { id, name, gender, district, category, written, interview, gk, typing, total, pct, grade, result, selection, waiver, zone };
  });
  rows.forEach((x, i) => {
    const r = i + 2, want = { J: x.total, K: x.pct, L: x.grade, M: x.result, N: x.selection, O: x.waiver, P: x.zone };
    for (const [c, v] of Object.entries(want)) if (typeof v === "number" ? Math.abs(value(`${c}${r}`) - v) > 1e-6 : value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${value(`${c}${r}`)} vs ${v}`);
  });
  const totals = rows.map((x) => x.total).sort((a, b) => a - b);
  const median = totals.length % 2 ? totals[(totals.length - 1) / 2] : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2;
  const want = { Y2: rows.length, Y3: median, Y4: rows.reduce((a, x) => a + x.written * x.typing, 0),
    Y5: rows.filter((x) => x.gender === "F" && x.result === "Qualified").length,
    Y6: Math.round((rows.filter((x) => x.category === "SC").reduce((a, x) => a + x.written, 0) / rows.filter((x) => x.category === "SC").length) * 100) / 100 };
  for (const [ref, v] of Object.entries(want)) if (Math.abs(value(ref) - v) > 1e-6) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want, "grades", { "A+": rows.filter((x) => x.grade === "A+").length, A: rows.filter((x) => x.grade === "A").length,
    B: rows.filter((x) => x.grade === "B").length, C: rows.filter((x) => x.grade === "C").length, D: rows.filter((x) => x.grade === "D").length });
}

// ---------- marking ----------
const cellCheck = (ref, equals, extra = {}) => ({ rule: "value", cell: ref, equals, formula: true, ...extra });
const columnChecks = (c) => Array.from({ length: ROWS }, (_, i) => cellCheck(`${c}${i + 2}`, value(`${c}${i + 2}`)));
// Format-as-Table band pattern, checked on column A across every data row (same O(rows) scale already proven at
// 499 rows by the column-formula checks below; a cell-by-cell check across all 16 columns would be excessive).
const bandChecks = () => Array.from({ length: ROWS }, (_, i) => { const r = i + 2; return { rule: "cells", range: `A${r}:A${r}`, props: { fillColor: [(r - 1) % 2 === 0 ? TABLE_BAND : "FFFFFF"] } }; });
const letters = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));

const QUESTIONS = [
  { marks: 3, text: `Select the table A1:P${LAST_ROW} (with its heading) and apply Format as Table using "Table Style Medium 3".`,
    criteria: [{ rule: "cells", range: "A1:P1", props: { bold: [true], fillColor: [TABLE_HEADER_FILL], fontColor: [TABLE_HEADER_FONT] } }, { band: true }],
    solution: `1. Select **A1:P${LAST_ROW}** (click A1, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Format as Table** → **Table Style Medium 3** (the orange one).\n3. In the dialog, keep "My table has headers" ticked → **OK**.\n\nChecked: the heading row is bold, orange fill (#${TABLE_HEADER_FILL}) with white text, and the data rows below it alternate orange-tint and white banding.` },
  { marks: 1, text: "Fill the Zone table's heading R1:W1 with Theme Colour \"Blue, Accent 1\", white font colour, Bold and Center.",
    criteria: [{ rule: "cells", range: "R1:W1", props: { bold: [true], fillColor: [THEME_BLUE_ACCENT1], fontColor: ["FFFFFF"], align: ["center"] } }],
    solution: `1. Select **R1:W1** (the row of district names above the Zone row).\n2. HOME → **Bold** (Ctrl+B) and **Center** (Ctrl+E).\n3. HOME → **Fill Color ▾** → **Theme Colors** (top row) → **Blue, Accent 1**.\n4. HOME → **Font Color ▾** → **Theme Colors** → **White, Background 1**.\n\nChecked: R1:W1 bold, centred, filled #${THEME_BLUE_ACCENT1} (Blue, Accent 1) with white text.` },
  { marks: 1, text: "In column J (Total) find the Total of Written, Interview and GK marks (F to H) for every candidate using the SUM function.",
    criteria: [{ column: "J" }],
    solution: `1. Click **J2** and type **=SUM(F2:H2)** → Enter (${candidates[0][5]}+${candidates[0][6]}+${candidates[0][7]} = ${value("J2")}).\n2. Double-click the fill handle of J2 to copy the formula down to **J${LAST_ROW}**.\n\nChecked: a formula in every cell J2:J${LAST_ROW} with the right total.` },
  { marks: 1, text: "In column K (Percentage) find the percentage of every candidate. The maximum Total is 80, rounded to 2 decimal places with ROUND.",
    criteria: [{ column: "K" }],
    solution: `1. Click **K2** and type **=ROUND(J2/80*100,2)** → Enter.\n2. Double-click the fill handle to fill down to **K${LAST_ROW}**.\n\nChecked: every percentage in K2:K${LAST_ROW}.` },
  { marks: 2, text: "In column L (Grade) using the IFS function give grade on Percentage: 80 or more = \"A+\", 65 or more = \"A\", 50 or more = \"B\", 35 or more = \"C\", otherwise \"D\".",
    criteria: [{ column: "L" }],
    solution: `**IFS** checks each condition in order and returns the result next to the first TRUE one: **=IFS(condition1,result1,condition2,result2,...)**. A final **TRUE** catches everything else.\n1. Click **L2** and type:\n   **=IFS(K2>=80,"A+",K2>=65,"A",K2>=50,"B",K2>=35,"C",TRUE,"D")** → Enter.\n2. Double-click the fill handle to fill down to **L${LAST_ROW}**.\n\n**IFS exists only in Excel 2019 / 365, not Excel 2013** — there, write it as nested IF instead: =IF(K2>=80,"A+",IF(K2>=65,"A",IF(K2>=50,"B",IF(K2>=35,"C","D")))). Either formula is accepted here.\n\nChecked: the grade in every cell L2:L${LAST_ROW}.` },
  { marks: 1, text: "In column M (Result) using IF write \"Qualified\" if the Total is 40 or more (>=40), otherwise \"Not Qualified\".",
    criteria: [{ column: "M" }],
    solution: `1. Click **M2** and type **=IF(J2>=40,"Qualified","Not Qualified")** → Enter.\n2. Double-click the fill handle to fill down to **M${LAST_ROW}**.\n\nChecked: every cell M2:M${LAST_ROW}.` },
  { marks: 2, text: "In column N (Selection) using IF with AND write \"Selected\" if the Result is \"Qualified\" AND the Typing Speed is 30 WPM or more, otherwise \"Not Selected\".",
    criteria: [{ column: "N" }],
    solution: `AND is TRUE only when **every** condition is TRUE.\n1. Click **N2** and type **=IF(AND(M2="Qualified",I2>=30),"Selected","Not Selected")** → Enter.\n2. Double-click the fill handle to fill down to **N${LAST_ROW}**.\n\nChecked: every cell N2:N${LAST_ROW}.` },
  { marks: 2, text: "In column O (Fee Waiver) using IF with OR write \"Yes\" if the Category is \"SC\" OR \"ST\", otherwise \"No\".",
    criteria: [{ column: "O" }],
    solution: `OR is TRUE when **at least one** condition is TRUE.\n1. Click **O2** and type **=IF(OR(E2="SC",E2="ST"),"Yes","No")** → Enter.\n2. Double-click the fill handle to fill down to **O${LAST_ROW}**.\n\nChecked: every cell O2:O${LAST_ROW}.` },
  { marks: 2, text: "In column P (Zone) using HLOOKUP find each candidate's Zone from the table R1:W2 (district names in row 1, zone in row 2), based on the District.",
    criteria: [{ column: "P" }],
    solution: `**HLOOKUP** looks up a value across a **horizontal** table (VLOOKUP looks down a vertical one): **=HLOOKUP(lookup_value, table, row_index, FALSE)**.\n1. Click **P2** and type **=HLOOKUP(D2,$R$1:$W$2,2,FALSE)** → Enter.\n2. The table R1:W2 does not move as you fill down, so use **$R$1:$W$2** (press F4 after typing the range to add the $ signs).\n3. Double-click the fill handle to fill down to **P${LAST_ROW}**.\n\nChecked: every cell P2:P${LAST_ROW}.` },
  { marks: 1, text: "In cell Y2 count the total number of candidates using COUNTA on Candidate Name.",
    criteria: [cellCheck("Y2", value("Y2"))],
    solution: `**COUNTA** counts every cell that is not empty.\n1. Click **Y2** and type **=COUNTA(B2:B${LAST_ROW})** → Enter → ${value("Y2")}.\n\nChecked: Y2 with a formula.` },
  { marks: 2, text: "In cell Y3 find the Median Total using the MEDIAN function.",
    criteria: [cellCheck("Y3", value("Y3"))],
    solution: `**MEDIAN** finds the middle value when the numbers are sorted (not the same as AVERAGE).\n1. Click **Y3** and type **=MEDIAN(J2:J${LAST_ROW})** → Enter → ${value("Y3")}.\n\nChecked: Y3 with a formula.` },
  { marks: 2, text: "In cell Y4 find the Admission Index -- the sum of (Written marks x Typing Speed) for every candidate -- using the SUMPRODUCT function.",
    criteria: [cellCheck("Y4", value("Y4"))],
    solution: `**SUMPRODUCT** multiplies two (or more) ranges cell by cell, then adds up all the results in one go -- no helper column needed: **=SUMPRODUCT(range1,range2)**.\n1. Click **Y4** and type **=SUMPRODUCT(F2:F${LAST_ROW},I2:I${LAST_ROW})** → Enter → ${value("Y4")}.\n\n(The long way: a helper column with =F2*I2 filled down, then =SUM() of that column -- SUMPRODUCT does both steps in one formula.)\n\nChecked: Y4 with a formula.` },
  { marks: 2, text: "Using COUNTIFS, in cell Y5 count the girl candidates (Gender = \"F\") whose Result is \"Qualified\".",
    criteria: [cellCheck("Y5", value("Y5"))],
    solution: `**=COUNTIFS(range1,criteria1,range2,criteria2,...)** counts the rows that meet **all** the conditions.\n1. Click **Y5** and type **=COUNTIFS(C2:C${LAST_ROW},"F",M2:M${LAST_ROW},"Qualified")** → Enter → ${value("Y5")}.\n\nChecked: Y5 with a formula.` },
  { marks: 1, text: "In cell Y6 find the average Written marks of the SC category candidates using AVERAGEIFS, rounded to 2 decimal places with ROUND.",
    criteria: [cellCheck("Y6", value("Y6"))],
    solution: `**=AVERAGEIFS(average_range,range1,criteria1)** averages only the rows that meet the condition.\n1. Click **Y6** and type **=ROUND(AVERAGEIFS(F2:F${LAST_ROW},E2:E${LAST_ROW},"SC"),2)** → Enter → ${value("Y6")}.\n\nChecked: Y6 = ${value("Y6")} with a formula.` },
  { marks: 2, text: `Freeze the top row of the sheet so the headings stay visible while scrolling, and apply Filter to the table A1:P${LAST_ROW}.`,
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }, { rule: "sheet", path: "filter", in: letters("A", "P").map((c) => `A1:${c}${LAST_ROW}`) }],
    solution: `1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n2. Click any cell of the table, for example A1. DATA → **Filter** (or **Ctrl+Shift+L**).\n\nDo the Filter step after the formula columns are filled, so it covers the complete table.\n\nChecked: panes frozen below row 1, and a filter on the table.` },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total} questions ${QUESTIONS.length}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST_ROW, cols: 25, cells: initialCells };
const sheet = { name: "Sheet1", freeze: "A2", filter: `A1:P${LAST_ROW}`, filterHidden: {} };
const model = { schemaVersion: "3", rows: LAST_ROW, cols: 25, cells: computed, merges: [], sheet, operations: [], savedAt: "2026-11-09T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test7-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test7-model.json", JSON.stringify(model));
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column) : c.band ? [{ rule: "allOf", criteria: bandChecks() }] : [c]));
fs.writeFileSync("tests/fixtures/excel-test7-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

// ---------- SQL ----------
const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const templates = Object.fromEntries(Object.entries(ROW_FORMULAS).map(([c, f]) => [c, f("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: ROWS }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const fixedCells = { ...EXTRA, ...Object.fromEntries(HEADERS.map((text, i) => [`${col(i)}1`, initialCells[`${col(i)}1`]])) };
const instructions = `1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has ${ROWS} candidates (rows 2 to ${LAST_ROW}). Fill a formula in row 2, then double-click the fill handle to copy it down to row ${LAST_ROW}.\n4. **Maximum marks** and question-wise marks are shown with the questions.\n5. This is an ADVANCED-level paper (Theme Colour, Format as Table, IFS, HLOOKUP, SUMPRODUCT, MEDIAN): you can still finish it in about 10 minutes -- type a formula once and fill it down, the row count does not add extra work. Any method is fine: the answer in the cells is what is checked.`;

const sql = `-- English EXCEL EFFICIENCY TEST 7 (built by scripts/build-excel-test7.mjs; do not edit by hand): an ADVANCED-level
-- recruitment-exam sheet of ${ROWS} candidates (rows 2-${LAST_ROW}) -- SUM, ROUND, IFS, IF+AND, IF+OR, HLOOKUP, COUNTA,
-- MEDIAN, SUMPRODUCT, COUNTIFS, AVERAGEIFS, Format as Table (named table style with banded rows), Theme Colour fill,
-- Freeze + Filter.
-- 1) A sheet may now have up to 500 rows (was 300), in the workspace, the saved-sheet checks and the database --
--    same technique as migration 202611081400, which raised it from 200 to 300.
-- 2) Creates the test as a DRAFT: 15 questions, 25 marks, hand-written checks, text solutions and a model answer
--    that scores 25/25. Publish it from Admin -> Excel Efficiency after deploying the code that allows 500 rows.
-- Safe to run twice.
begin;

do $mig$
declare fn text; def text;
begin
 foreach fn in array array['public.assert_excel_efficiency_document_schema(jsonb)', 'public.assert_excel_efficiency_working_matter(jsonb)'] loop
  def := regexp_replace(pg_get_functiondef(fn::regprocedure), '\\m300\\M', '500', 'g');
  execute def;
 end loop;
 -- A 499-row sheet has ~8,000 filled cells; the per-sheet cap was 5000 (lib/excel-document.ts has the same bump).
 def := regexp_replace(pg_get_functiondef('public.assert_excel_efficiency_cells(jsonb)'::regprocedure), '\\m5000\\M', '10000', 'g');
 execute def;
end $mig$;

create or replace function pg_temp.excel_cell(v jsonb, f text default null) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) $f$;
create or replace function pg_temp.column_checks(vals jsonb, col text) returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', col || (r + 2), 'formula', true, 'equals', vals->col->r) order by r)
 from generate_series(0, jsonb_array_length(vals->col) - 1) r $f$;
create or replace function pg_temp.band_checks() returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'cells', 'range', 'A' || (r + 2) || ':A' || (r + 2), 'props',
   jsonb_build_object('fillColor', jsonb_build_array(case when (r + 1) % 2 = 0 then '${TABLE_BAND}' else 'FFFFFF' end))) order by r)
 from generate_series(0, ${ROWS - 1}) r $f$;
-- The Format-as-Table band pattern on column A for the model answer (497 of the 499 patches -- same alternating
-- rule as band_checks() above), generated server-side instead of as a literal, to keep this file a reasonable size.
create or replace function pg_temp.band_patches() returns jsonb language sql immutable as $f$
 select jsonb_object_agg('A' || (r + 2), jsonb_build_object('fillColor', case when (r + 1) % 2 = 0 then '${TABLE_BAND}' else 'FFFFFF' end))
 from generate_series(0, ${ROWS - 1}) r $f$;

do $mig$
declare
 t_id uuid; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb;
 admin_id uuid := '1cbaa98b-7310-4d0b-b659-f2fabcbcf86d';
 candidates jsonb := ${dollar(JSON.stringify(candidates))}::jsonb;
 fixed jsonb := ${dollar(JSON.stringify(fixedCells))}::jsonb;
 templates jsonb := ${dollar(JSON.stringify(templates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 patches jsonb := ${dollar(JSON.stringify(sqlPatches))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 if exists (select 1 from public.excel_efficiency_tests where slug = 'efficiency-test-7') then raise notice 'EXCEL EFFICIENCY TEST 7 already exists'; return; end if;

 select fixed || jsonb_object_agg(chr(65 + i) || (r + 2), pg_temp.excel_cell(candidates->r->i)) into cells
 from generate_series(0, jsonb_array_length(candidates) - 1) r, generate_series(0, 8) i;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST_ROW}, 'cols', 25, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(templates) t, generate_series(0, ${ROWS - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 select model_cells || jsonb_object_agg(key, (model_cells->key) || value) into model_cells from jsonb_each(patches || pg_temp.band_patches());
 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST_ROW}, 'cols', 25, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify(sheet))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-09T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_tests (slug, title, language, status, created_by, sequence, auto_publish_results)
 values ('efficiency-test-7', 'EFFICIENCY TEST 7', 'English', 'draft', admin_id, 7, true) returning id into t_id;
 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 1, 'EFFICIENCY TEST 7', 'English', 'Advanced level, about 10 minutes: recruitment sheet of ${ROWS} candidates -- Theme Colour, Format as Table, IFS, HLOOKUP, SUMPRODUCT, MEDIAN',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9, working, admin_id, false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 1 where id = t_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if c ? 'column' then crit := crit || pg_temp.column_checks(vals, c->>'column');
   elsif c ? 'band' then crit := crit || jsonb_build_array(jsonb_build_object('rule', 'allOf', 'criteria', pg_temp.band_checks()));
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
join public.excel_efficiency_questions q on q.version_id = v.id where t.slug = 'efficiency-test-7' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611091400_excel_test7_recruitment_advanced.sql", sql);

// ---------- practice .xlsx (real Excel 2013): bold headings keep their look ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strings = [], stringIndex = new Map();
const shared = (text) => { if (!stringIndex.has(text)) { stringIndex.set(text, strings.length); strings.push(text); } return stringIndex.get(text); };
const styleOf = (c) => (c.bold ? 1 : 0);
const byRow = {};
for (const [ref, c] of Object.entries(initialCells)) { const m = ref.match(/^([A-Z]+)(\d+)$/); (byRow[m[2]] ??= []).push([m[1], c]); }
const rowsXml = Object.keys(byRow).map(Number).sort((a, b) => a - b).map((r) => `<row r="${r}">${byRow[r].sort((a, b) => a[0].localeCompare(b[0])).map(([c, cell]) => {
  const s = styleOf(cell) ? ` s="${styleOf(cell)}"` : "";
  return typeof cell.value === "number" ? `<c r="${c}${r}"${s}><v>${cell.value}</v></c>` : `<c r="${c}${r}"${s} t="s"><v>${shared(cell.value)}</v></c>`;
}).join("")}</row>`);
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><cols><col min="2" max="2" width="22" customWidth="1"/></cols><sheetData>${rowsXml.join("")}</sheetData></worksheet>`,
  "xl/sharedStrings.xml": "",
};
files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${NS} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join("")}</sst>`;
fs.mkdirSync("docs/excel-practice", { recursive: true });
fs.writeFileSync("docs/excel-practice/EXCEL-TEST-7-practice-499-candidates.xlsx", zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));
console.log("sql bytes", sql.length, "questions", QUESTIONS.length, "marks", total, "rows", ROWS);

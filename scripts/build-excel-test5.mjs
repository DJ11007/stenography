// Builds supabase/migrations/202611081500_excel_test5_lookup_text_date.sql: English EXCEL EFFICIENCY TEST 5, a salary
// sheet of 200 employees: absolute references ($), VLOOKUP + IFERROR, RANK, PROPER/TRIM, UPPER/LEFT/RIGHT/&, YEAR,
// SUMIF/SUMIFS, LARGE/SMALL, INDEX/MATCH, COUNTIF/COUNTBLANK, Accounting (₹), Freeze Top Row, Top 10 highlighting.
// Every expected answer comes from the workspace's own formula engine (lib/excel-formula.ts). Also writes
// tests/fixtures/excel-test5-*.json and docs/excel-practice/EXCEL-TEST-5-practice-200-employees.xlsx.
//   node scripts/build-excel-test5.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { dateToSerial } from "../lib/excel-formula.ts";

// ---------- deterministic data ----------
let seed = 20261109;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const MEN = ["ramesh", "mahendra", "vikram", "deepak", "manish", "lokesh", "naresh", "kamlesh", "ankit", "sandeep", "mukesh", "ashok", "gopal", "harish", "dinesh", "yogesh", "rajendra", "vinod"];
const WOMEN = ["sunita", "kavita", "pooja", "rekha", "anjali", "seema", "priya", "neha", "mamta", "jyoti", "payal", "komal", "nisha", "suman", "ritu", "lalita", "aarti", "monika"];
const MIDDLE_MEN = ["", "", "", "kumar", "lal", "prasad", "singh"], MIDDLE_WOMEN = ["", "", "", "devi", "kumari", "kanwar"];
const SURNAMES = ["sharma", "meena", "choudhary", "saini", "jat", "gurjar", "bairwa", "rathore", "shekhawat", "agarwal", "kumawat", "yadav", "prajapat", "swami", "mali", "verma", "joshi", "soni", "bishnoi", "jangid", "regar", "parihar"];
const DEPARTMENTS = ["Revenue", "Revenue", "Education", "Education", "Education", "Health", "Health", "Police", "Finance", "Panchayati Raj"];
const POSTS = [["LDC", 20800, 26000], ["LDC", 20800, 26000], ["LDC", 20800, 26000], ["UDC", 26500, 33800], ["UDC", 26500, 33800], ["Junior Assistant", 24000, 30000], ["Senior Assistant", 33800, 42000], ["Accountant", 35400, 45000], ["Peon", 17700, 19900], ["Driver", 19900, 23500]];
const messy = (word) => [...word].map((ch) => (rand() < 0.35 ? ch.toUpperCase() : ch)).join("");
const EMPLOYEES = 200;
const employees = [];
for (let i = 0; i < EMPLOYEES; i++) {
  const woman = rand() < 0.45, middle = pick(woman ? MIDDLE_WOMEN : MIDDLE_MEN);
  const parts = [pick(woman ? WOMEN : MEN), ...(middle ? [middle] : []), pick(SURNAMES)].map(messy);
  // untidy spacing as typed by different clerks: leading/trailing spaces and double spaces between words
  const name = (rand() < 0.3 ? " " : "") + parts.join(rand() < 0.35 ? "  " : " ") + (rand() < 0.3 ? "  " : "");
  const [post, lo, hi] = pick(POSTS);
  const joined = Math.floor(dateToSerial(new Date(between(2005, 2025), between(0, 11), between(1, 28))));
  const mobile = rand() < 0.07 ? null : Number(`${pick(["6", "7", "8", "9"])}${String(between(0, 999999999)).padStart(9, "0")}`);
  employees.push([`RJ26${String(i + 1).padStart(3, "0")}`, name, pick(DEPARTMENTS), post, joined, Math.round(between(lo, hi) / 100) * 100, mobile]);
}
// worked example rows the solutions talk about
employees[0] = ["RJ26001", "  rAMESH  kumar SHARMA ", "Revenue", "LDC", Math.floor(dateToSerial(new Date(2018, 6, 16))), 24500, 9414012345];
employees[1] = ["RJ26002", "sunita devi meena", "Education", "Peon", Math.floor(dateToSerial(new Date(2012, 2, 1))), 18600, null];
employees[149] = ["RJ26150", "KAVITA  jangid", "Health", "UDC", Math.floor(dateToSerial(new Date(2016, 9, 3))), 31200, 9828098280];
// the single highest-paid employee (INDEX/MATCH must have one answer)
employees[87] = ["RJ26088", " mahendra singh RATHORE", "Finance", "Accountant", Math.floor(dateToSerial(new Date(2006, 3, 12))), 47500, 9461100088];

// ---------- the sheet ----------
const HEADERS = ["Emp ID", "Employee Name", "Department", "Post", "Joining Date", "Basic Pay", "Mobile No",
  "Name (Proper)", "Joining Year", "DA", "Allowance", "Gross Salary", "Rank", "Emp Code"];
const LAST = EMPLOYEES + 1;
const col = (i) => String.fromCharCode(65 + i);
const plain = (value, formula = null, extra = {}) => ({ value, formula, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null, ...extra });
const ALLOWANCES = [["LDC", 2000], ["UDC", 2500], ["Junior Assistant", 3000], ["Senior Assistant", 3500], ["Accountant", 4000]];
const EXTRA = {
  S1: plain("Rates", null, { bold: true }), S2: plain("DA Rate"), T2: plain(0.55, null, { numberFormat: "Percentage", decimals: 0 }),
  S5: plain("Post", null, { bold: true }), T5: plain("Allowance", null, { bold: true }),
  ...Object.fromEntries(ALLOWANCES.flatMap(([post, amount], i) => [[`S${6 + i}`, plain(post)], [`T${6 + i}`, plain(amount)]])),
  P1: plain("Summary (use formulas)", null, { bold: true }), Q1: plain("Answer", null, { bold: true }),
  P2: plain("Gross of Education department"), P3: plain("Gross of LDCs in Revenue"), P4: plain("3rd highest Gross"), P5: plain("2nd lowest Gross"),
  P6: plain("Name of the highest paid employee"), P7: plain("Employees who joined in 2015 or later"), P8: plain("Employees without a mobile number"),
  P9: plain("Gross Salary of RJ26150"), P10: plain("Post of RJ26150"),
};
const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text, null, { bold: true }); });
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
  Q4: `=LARGE(${rng("L")},3)`,
  Q5: `=SMALL(${rng("L")},2)`,
  Q6: `=INDEX(${rng("H")},MATCH(MAX(${rng("L")}),${rng("L")},0))`,
  Q7: `=COUNTIF(${rng("I")},">=2015")`,
  Q8: `=COUNTBLANK(${rng("G")})`,
  Q9: `=VLOOKUP("RJ26150",A2:L${LAST},12,FALSE)`,
  Q10: `=VLOOKUP("RJ26150",A2:L${LAST},4,FALSE)`,
};

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
for (let r = 2; r <= LAST; r++) Object.assign(modelCells[`L${r}`], { numberFormat: "Accounting", currency: null, decimals: 2 });
const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check in plain JavaScript.
{
  const proper = (s) => s.trim().replace(/ +/g, " ").toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  const allowance = Object.fromEntries(ALLOWANCES);
  const rows = employees.map((e) => { const da = Math.round(e[5] * 0.55); const al = allowance[e[3]] ?? 0; return { e, da, al, gross: e[5] + da + al }; });
  const grosses = rows.map((x) => x.gross);
  rows.forEach(({ e, da, al, gross }, i) => {
    const r = i + 2, year = new Date(Date.UTC(1899, 11, 30) + e[4] * 86400000).getUTCFullYear();
    const want = { H: proper(e[1]), I: year, J: da, K: al, L: gross, M: 1 + grosses.filter((g) => g > gross).length, N: `${e[2].slice(0, 3).toUpperCase()}-${e[0].slice(-3)}` };
    for (const [c, v] of Object.entries(want)) if (value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${JSON.stringify(value(`${c}${r}`))} vs ${JSON.stringify(v)}`);
  });
  const sorted = [...grosses].sort((a, b) => b - a), top = rows.find((x) => x.gross === sorted[0]);
  if (sorted[0] === sorted[1]) throw new Error("highest gross is not unique");
  const want = { Q2: rows.filter((x) => x.e[2] === "Education").reduce((a, x) => a + x.gross, 0), Q3: rows.filter((x) => x.e[2] === "Revenue" && x.e[3] === "LDC").reduce((a, x) => a + x.gross, 0),
    Q4: sorted[2], Q5: [...grosses].sort((a, b) => a - b)[1], Q6: proper(top.e[1]), Q7: rows.filter((x) => value(`I${employees.indexOf(x.e) + 2}`) >= 2015).length,
    Q8: employees.filter((e) => e[6] === null).length, Q9: rows[149].gross, Q10: "UDC" };
  for (const [ref, v] of Object.entries(want)) if (value(ref) !== v) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want, "Peon/Driver", employees.filter((e) => !allowance[e[3]]).length);
}

// ---------- marking ----------
const cellCheck = (ref, equals, extra = {}) => ({ rule: "value", cell: ref, equals, formula: true, ...extra });
const columnChecks = (c, caseSensitive) => Array.from({ length: EMPLOYEES }, (_, i) => cellCheck(`${c}${i + 2}`, value(`${c}${i + 2}`), caseSensitive ? { caseSensitive: true } : {}));
const top10 = [10, "10"].flatMap((v) => [rng("L"), `L1:L${LAST}`].map((range) => ({ rule: "sheet", path: "conditionalFormats", includes: { range, type: "top", value: v, style: "greenDarkGreen" } })));

const QUESTIONS = [
  { marks: 2, text: "In column H (Name (Proper)) write every Employee Name in proper case without extra spaces, using the PROPER and TRIM functions (for example \"  rAMESH  kumar SHARMA \" becomes \"Ramesh Kumar Sharma\").",
    criteria: [{ column: "H", caseSensitive: true }],
    solution: "**TRIM** removes spaces at the start and end and leaves one space between words. **PROPER** makes the first letter of every word capital and the rest small. One function can go inside another.\n1. Click **H2** and type **=PROPER(TRIM(B2))** → Enter (\"  rAMESH  kumar SHARMA \" → \"Ramesh Kumar Sharma\").\n2. Double-click the fill handle of H2 to fill down to **H201**.\n\nAlso: **UPPER** makes all capitals, **LOWER** all small letters.\n\nChecked: the exact text (capital letters matter here) in every cell H2:H201." },
  { marks: 1, text: "In column I (Joining Year) find the year of joining from the Joining Date using the YEAR function.",
    criteria: [{ column: "I" }],
    solution: "A date in Excel is a number (days since 1 Jan 1900) shown in date format. **YEAR**, **MONTH** and **DAY** take out one part of it.\n1. Click **I2** and type **=YEAR(E2)** → Enter (16-07-2018 → 2018).\n2. Double-click the fill handle to fill down to **I201**.\n\nIf you see a date like 10-07-1905 instead of 2018, the cell has a date format: HOME → Number Format ▾ → **General**.\n\nChecked: the year in every cell I2:I201." },
  { marks: 2, text: "In column J (DA) find DA = Basic Pay × DA Rate given in cell T2, rounded to 0 decimal places with ROUND. Use an absolute reference ($T$2) so the formula can be filled down.",
    criteria: [{ column: "J" }],
    solution: "When a formula is filled down, every reference moves one row: F2 becomes F3, F4... A **$** sign stops it moving. **$T$2** always points to T2 (press **F4** after typing T2 to add the $ signs).\n1. Click **J2** and type **=ROUND(F2*$T$2,0)** → Enter (24500 × 55% = 13475).\n2. Double-click the fill handle to fill down to **J201**.\n\nWithout the $ signs J3 would use T3 (empty), so every DA below row 2 would be 0.\n\nChecked: the DA in every cell J2:J201." },
  { marks: 2, text: "In column K (Allowance) find the Allowance of every employee's Post from the table S6:T10 using VLOOKUP. Posts not in the table (Peon, Driver) must show 0: use IFERROR.",
    criteria: [{ column: "K" }],
    solution: "**=VLOOKUP(lookup_value, table, column_number, FALSE)** looks for the value in the first column of the table and returns the value from the given column. FALSE = exact match.\n1. Click **K2** and type **=IFERROR(VLOOKUP(D2,$S$6:$T$10,2,FALSE),0)** → Enter (LDC → 2000).\n2. Double-click the fill handle to fill down to **K201**.\n\nPeon and Driver are not in the table, so VLOOKUP gives **#N/A**; **IFERROR(value, 0)** shows 0 instead. The table needs $ signs so it does not move down when filled.\n\nChecked: every cell K2:K201." },
  { marks: 1, text: "In column L (Gross Salary) find Gross Salary = Basic Pay + DA + Allowance.",
    criteria: [{ column: "L" }],
    solution: "1. Click **L2** and type **=F2+J2+K2** (or =SUM(F2,J2,K2)) → Enter (24500 + 13475 + 2000 = 39975).\n2. Double-click the fill handle to fill down to **L201**.\n\nChecked: every cell L2:L201." },
  { marks: 2, text: "In column M (Rank) find the rank of every employee by Gross Salary (highest = 1) using the RANK function.",
    criteria: [{ column: "M" }],
    solution: "**=RANK(number, list, [order])** gives the position of a number in a list: order 0 or left out = highest gets 1.\n1. Click **M2** and type **=RANK(L2,$L$2:$L$201)** → Enter.\n2. Double-click the fill handle to fill down to **M201**.\n\nThe list must be absolute ($L$2:$L$201); otherwise it slides down and the ranks go wrong. Two equal salaries get the same rank.\n\nChecked: every cell M2:M201." },
  { marks: 2, text: "In column N (Emp Code) make a code of the first 3 letters of the Department in capital letters, a hyphen, and the last 3 characters of the Emp ID (for example Revenue, RJ26001 → \"REV-001\"). Use UPPER, LEFT, RIGHT and &.",
    criteria: [{ column: "N", caseSensitive: true }],
    solution: "**LEFT(text, n)** takes n characters from the left, **RIGHT(text, n)** from the right, **MID(text, start, n)** from the middle. **&** joins text (same as CONCATENATE).\n1. Click **N2** and type **=UPPER(LEFT(C2,3))&\"-\"&RIGHT(A2,3)** → Enter (REV-001).\n2. Double-click the fill handle to fill down to **N201**.\n\nSame result: =CONCATENATE(UPPER(LEFT(C2,3)),\"-\",RIGHT(A2,3)).\n\nChecked: the exact code (capital letters matter) in every cell N2:N201." },
  { marks: 2, text: "In Q2 find the total Gross Salary of the Education department using SUMIF, and in Q3 the total Gross Salary of LDCs of the Revenue department using SUMIFS.",
    criteria: [cellCheck("Q2", value("Q2")), cellCheck("Q3", value("Q3"))],
    solution: `**=SUMIF(range, criteria, sum_range)** adds the rows that meet one condition. **=SUMIFS(sum_range, range1, criteria1, range2, criteria2)** needs every condition; note the sum range comes first in SUMIFS.\n1. **Q2**: =SUMIF(C2:C201,"Education",L2:L201) → ${value("Q2")}.\n2. **Q3**: =SUMIFS(L2:L201,C2:C201,"Revenue",D2:D201,"LDC") → ${value("Q3")}.\n\nChecked: Q2 and Q3, both with formulas.` },
  { marks: 2, text: "In Q4 find the 3rd highest Gross Salary using LARGE, and in Q5 the 2nd lowest Gross Salary using SMALL.",
    criteria: [cellCheck("Q4", value("Q4")), cellCheck("Q5", value("Q5"))],
    solution: `**=LARGE(range, k)** gives the k-th highest value, **=SMALL(range, k)** the k-th lowest. LARGE(range,1) is the same as MAX, SMALL(range,1) as MIN.\n1. **Q4**: =LARGE(L2:L201,3) → ${value("Q4")}.\n2. **Q5**: =SMALL(L2:L201,2) → ${value("Q5")}.\n\nChecked: Q4 and Q5, both with formulas.` },
  { marks: 2, text: "In Q6 find the name of the highest paid employee using INDEX and MATCH (with MAX).",
    criteria: [{ rule: "anyOf", criteria: [cellCheck("Q6", value("Q6")), cellCheck("Q6", employees[87][1])] }],
    solution: `**MATCH(value, range, 0)** tells the position of a value in a range (0 = exact). **INDEX(range, position)** gives the value at that position. Together they look up in any direction, which VLOOKUP cannot (VLOOKUP only looks to the right).\n1. Click **Q6** and type **=INDEX(H2:H201,MATCH(MAX(L2:L201),L2:L201,0))** → Enter → ${value("Q6")}.\n\nMAX finds the highest gross, MATCH finds its row number in the list, INDEX takes the name from that row.\n\nChecked: Q6 with a formula (the name from column B also counts).` },
  { marks: 2, text: "In Q7 count the employees who joined in 2015 or later (use column I with COUNTIF), and in Q8 count the employees without a mobile number using COUNTBLANK.",
    criteria: [cellCheck("Q7", value("Q7")), cellCheck("Q8", value("Q8"))],
    solution: `1. **Q7**: =COUNTIF(I2:I201,">=2015") → ${value("Q7")}.\n2. **Q8**: =COUNTBLANK(G2:G201) → ${value("Q8")} (COUNTBLANK counts the empty cells).\n\nRemember: COUNT = cells with numbers, COUNTA = cells that are not empty, COUNTBLANK = empty cells.\n\nChecked: Q7 and Q8, both with formulas.` },
  { marks: 2, text: "Using VLOOKUP with the Emp ID \"RJ26150\", find in Q9 the Gross Salary and in Q10 the Post of that employee from the table A2:L201.",
    criteria: [cellCheck("Q9", value("Q9")), cellCheck("Q10", value("Q10"))],
    solution: `Count the columns of the table from its first column: A = 1, B = 2, C = 3, D = 4 ... L = 12.\n1. **Q9**: =VLOOKUP("RJ26150",A2:L201,12,FALSE) → ${value("Q9")}.\n2. **Q10**: =VLOOKUP("RJ26150",A2:L201,4,FALSE) → ${value("Q10")}.\n\nAlways write FALSE (exact match) when looking up an ID or a name; TRUE (approximate) needs a sorted list and can give a wrong row.\n\nChecked: Q9 and Q10, both with formulas.` },
  { marks: 1, text: "Format the Gross Salary range L2:L201 as Accounting Number Format with the ₹ symbol and 2 decimal places.",
    criteria: [{ rule: "cells", range: rng("L"), props: { numberFormat: ["Accounting", "Currency"], currency: [null, "₹"], decimals: [2] } }],
    solution: "1. Select **L2:L201** (click L2, then **Ctrl+Shift+↓**).\n2. HOME → **Accounting Number Format (₹)**. It shows 2 decimal places: ₹ 39,975.00.\n\n(Ctrl+1 → Number → **Currency**, Symbol ₹, Decimal places 2 also counts.)\n\nChecked: L2:L201 in Accounting or Currency format with ₹ and 2 decimals." },
  { marks: 1, text: "Freeze the top row of the sheet so the headings stay visible while scrolling.",
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }],
    solution: "1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n\n(Clicking A2 and choosing Freeze Panes does the same.)\n\nChecked: panes frozen below row 1." },
  { marks: 1, text: "With Conditional Formatting highlight the Top 10 Gross Salaries in L2:L201 with Green Fill with Dark Green Text.",
    criteria: [{ rule: "anyOf", criteria: top10 }],
    solution: "1. Select **L2:L201**.\n2. HOME → **Conditional Formatting ▾** → **Top/Bottom Rules** → **Top 10 Items...**\n3. Keep **10**, choose **Green Fill with Dark Green Text** → **OK**.\n\nChecked: a Top 10 rule with the green style on L2:L201." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sheet1", freeze: "A2", conditionalFormats: [{ range: rng("L"), type: "top", value: 10, style: "greenDarkGreen" }] };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet, operations: [], savedAt: "2026-11-08T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test5-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test5-model.json", JSON.stringify(model));
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column, c.caseSensitive) : [c]));
fs.writeFileSync("tests/fixtures/excel-test5-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

// ---------- SQL ----------
const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const templates = Object.fromEntries(Object.entries(ROW_FORMULAS).map(([c, f]) => [c, f("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: EMPLOYEES }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const fixedCells = { ...EXTRA, ...Object.fromEntries(HEADERS.map((text, i) => [`${col(i)}1`, initialCells[`${col(i)}1`]])) };
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 employees (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. **Maximum marks** and question-wise marks are shown with the questions.\n5. Complete each task directly in the spreadsheet using formulas, not by typing the answers.";

const sql = `-- English EXCEL EFFICIENCY TEST 5 (built by scripts/build-excel-test5.mjs; do not edit by hand): a salary sheet of
-- 200 employees -- $ references, VLOOKUP + IFERROR, RANK, PROPER/TRIM, UPPER/LEFT/RIGHT/&, YEAR, SUMIF/SUMIFS,
-- LARGE/SMALL, INDEX/MATCH, COUNTBLANK, Accounting, Freeze Top Row, Top 10.
-- 1) A value check may now say "caseSensitive": true (PROPER and UPPER answers must have the right capital letters).
-- 2) Creates the test as a DRAFT: 15 questions, 25 marks, hand-written checks, text solutions and a model answer that
--    scores 25/25. Needs migration 202611081400 (300 rows) first. Publish after deploying.
-- Safe to run twice.
begin;

do $mig$
declare def text;
begin
 def := pg_get_functiondef('public.excel_efficiency_criterion_matches(jsonb,jsonb)'::regprocedure);
 if position('caseSensitive' in def) = 0 then
  def := replace(def, $r$  return public.excel_efficiency_prop_matches(actual, p_c->'equals');$r$,
   $r$  if coalesce((p_c->>'caseSensitive')::boolean, false) then
   return jsonb_typeof(actual) = 'string' and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_c->'equals') = 'array' then p_c->'equals' else jsonb_build_array(p_c->'equals') end) e where e #>> '{}' = actual #>> '{}');
  end if;
  return public.excel_efficiency_prop_matches(actual, p_c->'equals');$r$);
  if position('caseSensitive' in def) = 0 then raise exception 'could not add caseSensitive to excel_efficiency_criterion_matches'; end if;
  execute def;
 end if;
end $mig$;

create or replace function pg_temp.excel_cell(v jsonb, f text default null, fmt text default 'General') returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', fmt, 'align', null) $f$;
create or replace function pg_temp.column_checks(vals jsonb, col text, case_sensitive boolean) returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', col || (r + 2), 'formula', true, 'equals', vals->col->r)
   || case when case_sensitive then '{"caseSensitive":true}'::jsonb else '{}'::jsonb end order by r)
 from generate_series(0, jsonb_array_length(vals->col) - 1) r $f$;

do $mig$
declare
 t_id uuid; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb;
 admin_id uuid := '1cbaa98b-7310-4d0b-b659-f2fabcbcf86d';
 employees jsonb := ${dollar(JSON.stringify(employees))}::jsonb;
 fixed jsonb := ${dollar(JSON.stringify(fixedCells))}::jsonb;
 templates jsonb := ${dollar(JSON.stringify(templates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 if exists (select 1 from public.excel_efficiency_tests where slug = 'efficiency-test-5') then raise notice 'EXCEL EFFICIENCY TEST 5 already exists'; return; end if;

 select fixed || jsonb_object_agg(chr(65 + i) || (r + 2), pg_temp.excel_cell(employees->r->i, null, case when i = 4 then 'ShortDate' else 'General' end)) into cells
 from generate_series(0, jsonb_array_length(employees) - 1) r, generate_series(0, 6) i where jsonb_typeof(employees->r->i) <> 'null';
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(templates) t, generate_series(0, ${EMPLOYEES - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 select model_cells || jsonb_object_agg('L' || r, (model_cells->('L' || r)) || '{"numberFormat":"Accounting","currency":null,"decimals":2}'::jsonb)
   into model_cells from generate_series(2, ${LAST}) r;
 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify(sheet))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-08T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_tests (slug, title, language, status, created_by, sequence, auto_publish_results)
 values ('efficiency-test-5', 'EFFICIENCY TEST 5', 'English', 'draft', admin_id, 5, true) returning id into t_id;
 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 1, 'EFFICIENCY TEST 5', 'English', 'Salary sheet of 200 employees: $ references, VLOOKUP, IFERROR, RANK, INDEX/MATCH, text and date functions',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9, working, admin_id, false, true, true, model) returning id into v_id;
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
join public.excel_efficiency_questions q on q.version_id = v.id where t.slug = 'efficiency-test-5' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611081500_excel_test5_lookup_text_date.sql", sql);

// ---------- practice .xlsx (real Excel 2013): dates, percentage and bold headings keep their look ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strings = [], stringIndex = new Map();
const shared = (text) => { if (!stringIndex.has(text)) { stringIndex.set(text, strings.length); strings.push(text); } return stringIndex.get(text); };
const styleOf = (c) => (c.bold ? 3 : c.numberFormat === "ShortDate" ? 1 : c.numberFormat === "Percentage" ? 2 : 0);
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
  "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><cols><col min="2" max="2" width="26" customWidth="1"/><col min="3" max="4" width="16" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/><col min="7" max="7" width="13" customWidth="1"/><col min="16" max="16" width="34" customWidth="1"/><col min="19" max="19" width="17" customWidth="1"/></cols><sheetData>${rowsXml.join("")}</sheetData></worksheet>`,
  "xl/sharedStrings.xml": "",
};
files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${NS} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join("")}</sst>`;
fs.mkdirSync("docs/excel-practice", { recursive: true });
fs.writeFileSync("docs/excel-practice/EXCEL-TEST-5-practice-200-employees.xlsx", zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));
console.log("sql bytes", sql.length, "questions", QUESTIONS.length, "marks", total);

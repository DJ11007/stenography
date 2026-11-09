// Builds supabase/migrations/202611081400_excel_test4_formulas.sql: English EXCEL EFFICIENCY TEST 4 (200 students,
// IF / nested IF / AND / OR / <> / COUNTA / COUNT / COUNTIF / COUNTIFS / AVERAGEIF / conditional formatting / filter).
// Every expected answer is worked out by the workspace's own formula engine (lib/excel-formula.ts), so the marking
// can never disagree with what a student's sheet shows. Also writes tests/fixtures/excel-test4-*.json and a practice
// .xlsx students can open in real Excel 2013.
//   node scripts/build-excel-test4.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";

// ---------- deterministic data ----------
let seed = 20261108;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const normal = () => { let s = 0; for (let i = 0; i < 6; i++) s += rand(); return (s - 3) / Math.sqrt(0.5); };

const BOYS = ["Aarav", "Rohit", "Mahendra", "Sunil", "Vikram", "Deepak", "Rakesh", "Manish", "Lokesh", "Hemant", "Naresh", "Kamlesh", "Ankit", "Sandeep", "Ramesh", "Jitendra", "Mukesh", "Pankaj", "Ashok", "Gopal", "Bhanu", "Harish", "Kuldeep", "Dinesh", "Yogesh", "Rajendra", "Shyam", "Vinod", "Tarun", "Pradeep"];
const GIRLS = ["Pooja", "Priya", "Sunita", "Kavita", "Neha", "Anjali", "Rekha", "Mamta", "Seema", "Kiran", "Sapna", "Monika", "Jyoti", "Payal", "Shalini", "Komal", "Manisha", "Pinki", "Suman", "Ritu", "Deepika", "Nisha", "Vandana", "Lalita", "Aarti"];
const SURNAMES = ["Sharma", "Meena", "Choudhary", "Saini", "Jat", "Gurjar", "Bairwa", "Rathore", "Shekhawat", "Agarwal", "Kumawat", "Yadav", "Prajapat", "Swami", "Mali", "Verma", "Joshi", "Soni", "Bishnoi", "Khandelwal", "Jangid", "Dadhich", "Regar", "Parihar"];
const DISTRICTS = ["Jaipur", "Jaipur", "Jaipur", "Jodhpur", "Jodhpur", "Ajmer", "Kota", "Kota", "Bikaner", "Udaipur", "Alwar", "Sikar", "Bharatpur", "Tonk"];
const CATEGORIES = ["GEN", "GEN", "OBC", "OBC", "OBC", "SC", "ST", "EWS", "MBC"];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));

const STUDENTS = 200;
const students = [];
for (let i = 0; i < STUDENTS; i++) {
  const girl = rand() < 0.42;
  const name = `${pick(girl ? GIRLS : BOYS)} ${pick(SURNAMES)}`;
  const ability = 55 + 15 * normal();
  const subject = (bias) => clamp(ability + bias + 11 * normal(), 8, 99);
  const english = rand() < 0.045 ? "AB" : subject(-6);
  students.push([1001 + i, name, girl ? "F" : "M", pick(DISTRICTS), pick(CATEGORIES), subject(4), english, subject(2), subject(-2), clamp(28 + 8 * normal(), 12, 52)]);
}
// a few memorable rows near the top, so the paper's worked example is real
students[0] = [1001, "Rajnish Sharma", "M", "Jaipur", "GEN", 78, 64, 91, 70, 38];
students[1] = [1002, "Pooja Meena", "F", "Jodhpur", "ST", 92, "AB", 66, 58, 27];
students[2] = [1003, "Kamlesh Saini", "M", "Kota", "OBC", 31, 40, 35, 29, 22];

// ---------- the sheet ----------
const HEADERS = ["Roll No", "Student Name", "Gender", "District", "Category", "Hindi", "English", "Computer", "Rajasthan GK", "Typing Speed (WPM)",
  "Total", "Percentage", "Result", "Grade", "Selection", "Scholarship", "Hostel"];
const SUMMARY = [
  ["S1", "Summary (use formulas)"], ["T1", "Answer"],
  ["S2", "Total students"], ["S3", "Students who appeared in English"], ["S4", "Students who passed"], ["S5", "Girl students"],
  ["S6", "Typing speed 35 WPM or more"], ["S7", "Computer marks below 40"], ["S8", "Students not from Jaipur"],
  ["S9", "Girls who passed"], ["S10", "OBC students from Kota"], ["S11", "Average Total of Jodhpur students"],
];
const LAST = STUDENTS + 1; // 201
const col = (i) => String.fromCharCode(65 + i);
const plain = (value, formula = null) => ({ value, formula, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null });

const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
students.forEach((row, r) => row.forEach((value, i) => { initialCells[`${col(i)}${r + 2}`] = plain(value); }));
for (const [ref, text] of SUMMARY) initialCells[ref] = plain(text);

const ROW_FORMULAS = {
  K: (r) => `=SUM(F${r}:I${r})`,
  L: (r) => `=K${r}/400*100`,
  M: (r) => `=IF(K${r}>=160,"PASS","FAIL")`,
  N: (r) => `=IF(L${r}>=75,"A",IF(L${r}>=60,"B",IF(L${r}>=40,"C","D")))`,
  O: (r) => `=IF(AND(K${r}>=160,J${r}>=25),"Selected","Not Selected")`,
  P: (r) => `=IF(OR(F${r}>=90,H${r}>=90),"Yes","No")`,
  Q: (r) => `=IF(D${r}<>"Jaipur","Hostel","Day Scholar")`,
};
const R = `2:`, rng = (c) => `${c}2:${c}${LAST}`;
const SUMMARY_FORMULAS = {
  T2: `=COUNTA(${rng("B")})`,
  T3: `=COUNT(${rng("G")})`,
  T4: `=COUNTIF(${rng("M")},"PASS")`,
  T5: `=COUNTIF(${rng("C")},"F")`,
  T6: `=COUNTIF(${rng("J")},">=35")`,
  T7: `=COUNTIF(${rng("H")},"<40")`,
  T8: `=COUNTIF(${rng("D")},"<>Jaipur")`,
  T9: `=COUNTIFS(${rng("C")},"F",${rng("M")},"PASS")`,
  T10: `=COUNTIFS(${rng("E")},"OBC",${rng("D")},"Kota")`,
  T11: `=ROUND(AVERAGEIF(${rng("D")},"Jodhpur",${rng("K")}),2)`,
};
void R;

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
// Q1: header row bold, yellow, wrapped
for (let i = 0; i < HEADERS.length; i++) Object.assign(modelCells[`${col(i)}1`], { bold: true, fillColor: "FFFF00", wrap: true });
const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check of the engine's answers (plain JavaScript, no spreadsheet code).
{
  const rows = students.map((s) => { const nums = [s[5], s[6], s[7], s[8]].filter((v) => typeof v === "number"); const total = nums.reduce((a, b) => a + b, 0); return { s, total, pct: total / 4 }; });
  rows.forEach(({ s, total, pct }, i) => {
    const r = i + 2, want = { K: total, L: pct, M: total >= 160 ? "PASS" : "FAIL", N: pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D", O: total >= 160 && s[9] >= 25 ? "Selected" : "Not Selected", P: s[5] >= 90 || s[7] >= 90 ? "Yes" : "No", Q: s[3] !== "Jaipur" ? "Hostel" : "Day Scholar" };
    for (const [c, v] of Object.entries(want)) if (typeof v === "number" ? Math.abs(value(`${c}${r}`) - v) > 1e-9 : value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${value(`${c}${r}`)} vs ${v}`);
  });
  const jodhpur = rows.filter((x) => x.s[3] === "Jodhpur");
  const want = { T2: 200, T3: students.filter((s) => typeof s[6] === "number").length, T4: rows.filter((x) => x.total >= 160).length, T5: students.filter((s) => s[2] === "F").length,
    T6: students.filter((s) => s[9] >= 35).length, T7: students.filter((s) => s[7] < 40).length, T8: students.filter((s) => s[3] !== "Jaipur").length,
    T9: rows.filter((x) => x.s[2] === "F" && x.total >= 160).length, T10: students.filter((s) => s[4] === "OBC" && s[3] === "Kota").length,
    T11: Math.round((jodhpur.reduce((a, x) => a + x.total, 0) / jodhpur.length) * 100) / 100 };
  for (const [ref, v] of Object.entries(want)) if (Math.abs(value(ref) - v) > 1e-9) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  console.log("summary", want);
}

// ---------- marking ----------
const cellCheck = (ref, equals) => ({ rule: "value", cell: ref, equals, formula: true });
const columnChecks = (c, map = (v) => v) => Array.from({ length: STUDENTS }, (_, i) => cellCheck(`${c}${i + 2}`, map(value(`${c}${i + 2}`))));
const conditional = [];
for (const range of [rng("M"), `M1:M${LAST}`]) for (const type of ["equalTo", "textContains"]) for (const text of ["FAIL", "Fail", "fail"]) conditional.push({ rule: "sheet", path: "conditionalFormats", includes: { range, type, value: text, style: "lightRedDarkRed" } });
const filterRanges = ["J", "K", "L", "M", "N", "O", "P", "Q"].map((c) => `A1:${c}${LAST}`);

const QUESTIONS = [
  { marks: 1, text: "Make the heading row A1:Q1 Bold, give it Yellow fill colour and apply Wrap Text.",
    criteria: [{ rule: "cells", range: "A1:Q1", props: { bold: [true], fillColor: ["FFFF00"], wrap: [true] } }],
    solution: "1. Select **A1:Q1** (click A1, hold Shift, click Q1).\n2. HOME → **Bold** (Ctrl+B).\n3. HOME → **Fill Color ▾** → Standard Colors → **Yellow**.\n4. HOME → **Wrap Text**.\n\nChecked: every heading cell A1 to Q1 is bold, yellow and wrapped." },
  { marks: 1, text: "In column K (Total) find the Total of Hindi, English, Computer and Rajasthan GK (F to I) for every student using the SUM function.",
    criteria: [{ column: "K" }],
    solution: "1. Click **K2** and type **=SUM(F2:I2)** → Enter (Rajnish Sharma: 78+64+91+70 = 303).\n2. Click K2 again and **double-click the fill handle** (small square at the bottom-right of the cell) to copy the formula down to **K201**.\n\nWhy SUM and not =F2+G2+H2+I2? Some students were absent in English (**AB**). The + sign gives **#VALUE!** when a cell has text, but SUM skips text, so Pooja Meena (row 3) gets 92+66+58 = 216.\n\nChecked: a formula in every cell K2:K201 with the right total." },
  { marks: 1, text: "In column L (Percentage) find the percentage of every student. Each subject is out of 100, so the maximum total is 400 (Percentage = Total ÷ 400 × 100).",
    criteria: [{ column: "L", alsoFraction: true }],
    solution: "1. Click **L2** and type **=K2/400*100** → Enter (303 ÷ 400 × 100 = 75.75).\n2. Double-click the fill handle of L2 to fill down to **L201**.\n\n(=K2/400 with the **Percent Style** button (%) also counts: it shows 75.75%.)\n\nChecked: every percentage in L2:L201." },
  { marks: 2, text: "In column M (Result) using IF function write \"PASS\" if the Total is 160 or more (>=160), otherwise write \"FAIL\".",
    criteria: [{ column: "M" }],
    solution: "IF checks a condition: **=IF(condition, value if TRUE, value if FALSE)**. Text answers go inside double quotes.\n1. Click **M2** and type **=IF(K2>=160,\"PASS\",\"FAIL\")** → Enter.\n2. Double-click the fill handle to fill down to **M201**.\n\nComparison signs in Excel: **>** greater than, **<** less than, **>=** greater than or equal, **<=** less than or equal, **=** equal, **<>** not equal.\n\nChecked: PASS/FAIL in every cell M2:M201 (capital or small letters both count)." },
  { marks: 2, text: "In column N (Grade) using nested IF give grade on Percentage: 75 or more = \"A\", 60 or more = \"B\", 40 or more = \"C\", below 40 = \"D\".",
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
  { marks: 2, text: "In cell T2 find the total number of students using COUNTA on Student Name (B2:B201), and in cell T3 find how many students appeared in English using COUNT on G2:G201.",
    criteria: [cellCheck("T2", value("T2")), cellCheck("T3", value("T3"))],
    solution: `**COUNTA** counts every cell that is not empty (text and numbers). **COUNT** counts only cells with numbers.\n1. **T2**: =COUNTA(B2:B201) → ${value("T2")}.\n2. **T3**: =COUNT(G2:G201) → ${value("T3")} (the ${200 - value("T3")} students marked AB are text, so COUNT leaves them out).\n\nAlso useful: **COUNTBLANK** counts empty cells.\n\nChecked: T2 and T3, both with formulas.` },
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
  { marks: 1, text: "Select M2:M201 and with Conditional Formatting highlight the cells equal to \"FAIL\" with Light Red Fill with Dark Red Text.",
    criteria: [{ rule: "anyOf", criteria: conditional }],
    solution: "1. Select **M2:M201** (click M2, then press **Ctrl+Shift+↓**).\n2. HOME → **Conditional Formatting ▾** → **Highlight Cells Rules** → **Equal To...**\n3. Type **FAIL**, keep **Light Red Fill with Dark Red Text** → **OK**.\n\n(Highlight Cells Rules → Text that Contains... with FAIL also counts.)\n\nChecked: the rule on M2:M201." },
  { marks: 1, text: "Apply Filter to the complete table A1:Q201.",
    criteria: [{ rule: "sheet", path: "filter", in: filterRanges }],
    solution: "1. Click any cell of the table, for example **A1**.\n2. DATA → **Filter** (or HOME → Sort & Filter ▾ → Filter, or **Ctrl+Shift+L**). Arrow buttons appear in the heading row.\n\nDo this after the formula columns are filled, so the filter covers A1:Q201.\n\nChecked: a filter on the table." },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sheet1", filter: `A1:Q${LAST}`, filterHidden: {}, conditionalFormats: [{ range: rng("M"), type: "equalTo", value: "FAIL", style: "lightRedDarkRed" }] };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet, operations: [], savedAt: "2026-11-08T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test4-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test4-model.json", JSON.stringify(model));

// ---------- SQL ----------
// {column: "K"} in a question = a formula with the model's value in every cell K2:K201 (L also accepts 0.7575 for 75.75%).
const expand = (criteria) => criteria.flatMap((c) => !c.column ? [c] : c.alsoFraction
  ? [{ rule: "anyOf", criteria: [{ rule: "allOf", criteria: columnChecks(c.column) }, { rule: "allOf", criteria: columnChecks(c.column, (v) => v / 100) }] }]
  : columnChecks(c.column));
fs.writeFileSync("tests/fixtures/excel-test4-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const templates = Object.fromEntries(Object.entries(ROW_FORMULAS).map(([c, f]) => [c, f("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: STUDENTS }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 200 students (rows 2 to 201). Fill a formula in row 2, then double-click the fill handle to copy it down to row 201.\n4. **Maximum marks** and question-wise marks are shown with the questions.\n5. Complete each task directly in the spreadsheet. Any method is fine (formula, drag and fill, Flash Fill or typing): the answer in the cells is what is checked.";

const sql = `-- English EXCEL EFFICIENCY TEST 4 (built by scripts/build-excel-test4.mjs; do not edit by hand).
-- 1) A sheet may now have up to 300 rows (was 200): this paper has 200 students + a heading row.
-- 2) Creates the test as a DRAFT: 15 questions, 25 marks, hand-written checks, text solutions and a model answer
--    that scores 25/25. Publish it from Admin -> Excel Efficiency after deploying the code that allows 300 rows.
-- Safe to run twice.
begin;

do $mig$
declare fn text; def text;
begin
 foreach fn in array array['public.assert_excel_efficiency_document_schema(jsonb)', 'public.assert_excel_efficiency_working_matter(jsonb)'] loop
  def := regexp_replace(pg_get_functiondef(fn::regprocedure), '\\m200\\M', '300', 'g');
  execute def;
 end loop;
end $mig$;

create or replace function pg_temp.excel_cell(v jsonb, f text default null) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) $f$;
-- A formula with the model's value in every cell of a column, rows 2-201 (divide 100: the percentage as a fraction).
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
 templates jsonb := ${dollar(JSON.stringify(templates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 if exists (select 1 from public.excel_efficiency_tests where slug = 'efficiency-test-4') then raise notice 'EXCEL EFFICIENCY TEST 4 already exists'; return; end if;

 select jsonb_object_agg(ref, cell) into cells from (
   select chr(65 + i) || '1' as ref, pg_temp.excel_cell(headers->i) as cell from generate_series(0, jsonb_array_length(headers) - 1) i
   union all select chr(65 + i) || (r + 2), pg_temp.excel_cell(students->r->i) from generate_series(0, jsonb_array_length(students) - 1) r, generate_series(0, 9) i
   union all select s->>0, pg_temp.excel_cell(s->1) from jsonb_array_elements(summary) s) x;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(templates) t, generate_series(0, ${STUDENTS - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 select model_cells || jsonb_object_agg(chr(65 + i) || '1', (model_cells->(chr(65 + i) || '1')) || '{"bold":true,"fillColor":"FFFF00","wrap":true}'::jsonb)
   into model_cells from generate_series(0, jsonb_array_length(headers) - 1) i;
 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify(sheet))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-08T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_tests (slug, title, language, status, created_by, sequence, auto_publish_results)
 values ('efficiency-test-4', 'EFFICIENCY TEST 4', 'English', 'draft', admin_id, 4, true) returning id into t_id;
 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 1, 'EFFICIENCY TEST 4', 'English', 'IF, nested IF, AND, OR, <>, COUNTA, COUNT, COUNTIF, COUNTIFS and AVERAGEIF on 200 students',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9, working, admin_id, false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 1 where id = t_id;

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
join public.excel_efficiency_questions q on q.version_id = v.id where t.slug = 'efficiency-test-4' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611081400_excel_test4_formulas.sql", sql);

// ---------- practice .xlsx (real Excel 2013) ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rowsXml = [], strings = [], stringIndex = new Map();
const shared = (text) => { if (!stringIndex.has(text)) { stringIndex.set(text, strings.length); strings.push(text); } return stringIndex.get(text); };
const byRow = {};
for (const [ref, c] of Object.entries(initialCells)) { const m = ref.match(/^([A-Z]+)(\d+)$/); (byRow[m[2]] ??= []).push([m[1], c.value]); }
for (const r of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
  const cellsXml = byRow[r].sort((a, b) => a[0].localeCompare(b[0])).map(([c, v]) => typeof v === "number" ? `<c r="${c}${r}"><v>${v}</v></c>` : `<c r="${c}${r}" t="s"><v>${shared(v)}</v></c>`).join("");
  rowsXml.push(`<row r="${r}">${cellsXml}</row>`);
}
const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="2" max="2" width="20" customWidth="1"/><col min="10" max="10" width="12" customWidth="1"/><col min="19" max="19" width="34" customWidth="1"/></cols><sheetData>${rowsXml.join("")}</sheetData></worksheet>`,
};
files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((t) => `<si><t>${esc(t)}</t></si>`).join("")}</sst>`;
fs.mkdirSync("docs/excel-practice", { recursive: true });
fs.writeFileSync("docs/excel-practice/EXCEL-TEST-4-practice-200-students.xlsx", zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));
console.log("sql bytes", sql.length, "questions", QUESTIONS.length, "marks", total);

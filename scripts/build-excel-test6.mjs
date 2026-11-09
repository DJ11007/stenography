// Builds supabase/migrations/202611091000_excel_test6_normal_shop_sheet.sql: English EXCEL EFFICIENCY TEST 6, a NORMAL
// level paper a student can finish in about 10 minutes: a book-shop sales sheet of 30 items, 15 questions, 25 marks.
// Basic formulas (multiply, percentage, subtract, IF, SUM/MAX/MIN/AVERAGE, COUNTA/COUNTIF/SUMIF) and everyday
// formatting (heading, Accounting, borders, centre, AutoFit, Freeze, rename + tab colour, conditional format, filter).
// Every expected answer comes from the workspace's own formula engine (lib/excel-formula.ts). Also writes
// tests/fixtures/excel-test6-*.json and docs/excel-practice/EXCEL-TEST-6-practice-30-items.xlsx.
//   node scripts/build-excel-test6.mjs
import fs from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";

// ---------- deterministic data ----------
const ITEMS = [
  ["Rough Note Book", "Stationery", 20, 40], ["Gel Pen Box", "Stationery", 10, 120], ["Geometry Box", "Stationery", 5, 150], ["Stapler", "Stationery", 4, 85],
  ["Highlighter Set", "Stationery", 6, 95], ["Drawing File", "Stationery", 12, 55], ["Marker Pen", "Stationery", 15, 30], ["Pencil Box", "Stationery", 8, 70],
  ["Calculator", "Stationery", 3, 350], ["Sticky Notes", "Stationery", 14, 45],
  ["Hindi Grammar", "Books", 6, 180], ["English Grammar", "Books", 7, 210], ["Rajasthan GK", "Books", 9, 260], ["Reasoning Book", "Books", 5, 340],
  ["Maths Formula Book", "Books", 8, 150], ["Computer Basics", "Books", 6, 275], ["Current Affairs 2026", "Books", 10, 190], ["Typing Guide", "Books", 12, 120],
  ["Previous Year Paper", "Books", 4, 420], ["Dictionary", "Books", 3, 480],
  ["School Bag", "Bags", 3, 650], ["Laptop Bag", "Bags", 2, 1200], ["Lunch Bag", "Bags", 6, 240], ["Travel Bag", "Bags", 2, 1850], ["Pouch", "Bags", 16, 60],
  ["Water Bottle", "Bags", 9, 180], ["Tiffin Box", "Bags", 7, 160], ["Umbrella", "Bags", 4, 325], ["Backpack", "Bags", 2, 980], ["Sling Bag", "Bags", 5, 450],
];
const items = ITEMS.map(([name, category, qty, rate], i) => [`S${101 + i}`, name, category, qty, rate]);
const ROWS = items.length, LAST = ROWS + 1;

// ---------- the sheet ----------
const HEADERS = ["Item No", "Item Name", "Category", "Qty", "Rate", "Amount", "Discount", "Net Amount", "Remark"];
const col = (i) => String.fromCharCode(65 + i);
const plain = (value, formula = null, extra = {}) => ({ value, formula, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null, ...extra });
const SUMMARY_LABELS = { K1: "Summary (use formulas)", L1: "Answer", K2: "Total Net Amount", K3: "Highest Net Amount", K4: "Lowest Net Amount", K5: "Average Net Amount",
  K6: "Number of items", K7: "Number of Books", K8: "Net Amount of Stationery" };
const EXTRA = Object.fromEntries(Object.entries(SUMMARY_LABELS).map(([ref, text]) => [ref, plain(text, null, ref === "K1" || ref === "L1" ? { bold: true } : {})]));
const initialCells = {};
HEADERS.forEach((text, i) => { initialCells[`${col(i)}1`] = plain(text); });
items.forEach((row, r) => row.forEach((value, i) => { initialCells[`${col(i)}${r + 2}`] = plain(value); }));
Object.assign(initialCells, EXTRA);

const ROW_FORMULAS = {
  F: (r) => `=D${r}*E${r}`,
  G: (r) => `=F${r}*10%`,
  H: (r) => `=F${r}-G${r}`,
  I: (r) => `=IF(H${r}>=1000,"High","Low")`,
};
const rng = (c) => `${c}2:${c}${LAST}`;
const SUMMARY_FORMULAS = {
  L2: `=SUM(${rng("H")})`,
  L3: `=MAX(${rng("H")})`,
  L4: `=MIN(${rng("H")})`,
  L5: `=AVERAGE(${rng("H")})`,
  L6: `=COUNTA(${rng("B")})`,
  L7: `=COUNTIF(${rng("C")},"Books")`,
  L8: `=SUMIF(${rng("C")},"Stationery",${rng("H")})`,
};

// What the finished (model) sheet looks like: heading, Accounting, borders, centred Qty.
const patches = {};
const patch = (ref, props) => { patches[ref] = { ...(patches[ref] ?? {}), ...props }; };
for (let i = 0; i < HEADERS.length; i++) patch(`${col(i)}1`, { bold: true, fillColor: "FFFF00", align: "center" });
for (let r = 2; r <= LAST; r++) for (const c of ["F", "G", "H"]) patch(`${c}${r}`, { numberFormat: "Accounting", currency: null, decimals: 2 });
for (let r = 1; r <= LAST; r++) for (let i = 0; i < HEADERS.length; i++) patch(`${col(i)}${r}`, { border: "trbl" });
for (let r = 2; r <= LAST; r++) patch(`D${r}`, { align: "center" });

const modelCells = structuredClone(initialCells);
for (let r = 2; r <= LAST; r++) for (const [c, f] of Object.entries(ROW_FORMULAS)) modelCells[`${c}${r}`] = plain(null, f(r));
for (const [ref, f] of Object.entries(SUMMARY_FORMULAS)) modelCells[ref] = plain(null, f);
for (const [ref, props] of Object.entries(patches)) Object.assign(modelCells[ref], props);
const computed = recomputeFormulas(modelCells);
const value = (ref) => computed[ref].value;
for (const ref of Object.keys(computed)) if (typeof computed[ref].value === "string" && computed[ref].value.startsWith("#")) throw new Error(`${ref} = ${computed[ref].value}`);

// Independent check in plain JavaScript.
{
  const rows = items.map((e) => { const amount = e[3] * e[4], discount = amount * 0.1, net = amount - discount; return { e, amount, discount, net }; });
  rows.forEach(({ amount, discount, net }, i) => {
    const r = i + 2, want = { F: amount, G: discount, H: net, I: net >= 1000 ? "High" : "Low" };
    for (const [c, v] of Object.entries(want)) if (typeof v === "number" ? Math.abs(value(`${c}${r}`) - v) > 1e-6 : value(`${c}${r}`) !== v) throw new Error(`${c}${r}: engine ${value(`${c}${r}`)} vs ${v}`);
  });
  const nets = rows.map((x) => x.net);
  const want = { L2: nets.reduce((a, b) => a + b, 0), L3: Math.max(...nets), L4: Math.min(...nets), L5: nets.reduce((a, b) => a + b, 0) / ROWS, L6: ROWS,
    L7: items.filter((e) => e[2] === "Books").length, L8: rows.filter((x) => x.e[2] === "Stationery").reduce((a, x) => a + x.net, 0) };
  for (const [ref, v] of Object.entries(want)) if (Math.abs(value(ref) - v) > 1e-6) throw new Error(`${ref}: engine ${value(ref)} vs ${v}`);
  if (nets.filter((n) => n === want.L3).length !== 1 || nets.filter((n) => n === want.L4).length !== 1) throw new Error("highest/lowest not unique");
  console.log("summary", want, "High", rows.filter((x) => x.net >= 1000).length, "Low", rows.filter((x) => x.net < 1000).length);
}

// ---------- marking ----------
const cellCheck = (ref, equals, extra = {}) => ({ rule: "value", cell: ref, equals, formula: true, ...extra });
const columnChecks = (c) => Array.from({ length: ROWS }, (_, i) => cellCheck(`${c}${i + 2}`, value(`${c}${i + 2}`)));
const conditional = [];
for (const range of [rng("H"), `H1:H${LAST}`]) for (const v of [1000, "1000"]) conditional.push({ rule: "sheet", path: "conditionalFormats", includes: { range, type: "greaterThan", value: v, style: "greenDarkGreen" } });
const filterRanges = [`A1:I${LAST}`];
const letters = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));
const money = (n) => (Math.round(n * 100) / 100).toString();

const QUESTIONS = [
  { marks: 1, text: "Make the heading row A1:I1 Bold, give it Yellow fill colour and Center alignment.",
    criteria: [{ rule: "cells", range: "A1:I1", props: { bold: [true], fillColor: ["FFFF00"], align: ["center"] } }],
    solution: "1. Select **A1:I1** (click A1, hold Shift, click I1).\n2. HOME → **Bold** (Ctrl+B).\n3. HOME → **Fill Color ▾** → Standard Colors → **Yellow**.\n4. HOME → **Center** (Ctrl+E).\n\nChecked: every heading cell A1 to I1 is bold, yellow and centred." },
  { marks: 2, text: "In column F (Amount) find Amount = Qty × Rate for every item.",
    criteria: [{ column: "F" }],
    solution: `Start every formula with **=** and click or type the cell names.\n1. Click **F2** and type **=D2*E2** → Enter (20 × 40 = ${value("F2")}).\n2. Click F2 again and **double-click the fill handle** (small square at the bottom-right of the cell) to copy the formula down to **F${LAST}**.\n\n(=PRODUCT(D2,E2) also works.)\n\nChecked: every cell F2:F${LAST} has a formula with the right amount.` },
  { marks: 2, text: "In column G (Discount) find the Discount = 10% of the Amount for every item.",
    criteria: [{ column: "G" }],
    solution: `10% means 10 out of 100, so the discount is Amount × 10%.\n1. Click **G2** and type **=F2*10%** (or **=F2*0.1** or **=F2*10/100**) → Enter (${value("F2")} × 10% = ${value("G2")}).\n2. Double-click the fill handle to fill down to **G${LAST}**.\n\nChecked: every cell G2:G${LAST} has a formula with the right discount.` },
  { marks: 2, text: "In column H (Net Amount) find Net Amount = Amount − Discount for every item.",
    criteria: [{ column: "H" }],
    solution: `1. Click **H2** and type **=F2-G2** → Enter (${value("F2")} − ${value("G2")} = ${value("H2")}).\n2. Double-click the fill handle to fill down to **H${LAST}**.\n\nChecked: every cell H2:H${LAST} has a formula with the right net amount.` },
  { marks: 2, text: "In column I (Remark) using the IF function write \"High\" if the Net Amount is 1000 or more (>=1000), otherwise write \"Low\".",
    criteria: [{ column: "I" }],
    solution: `IF checks a condition: **=IF(condition, value if TRUE, value if FALSE)**. Text goes inside double quotes.\n1. Click **I2** and type **=IF(H2>=1000,"High","Low")** → Enter (Rough Note Book, net ${value("H2")} → ${value("I2")}).\n2. Double-click the fill handle to fill down to **I${LAST}**.\n\nComparison signs: **>** greater than, **<** less than, **>=** greater than or equal to, **<=** less than or equal to, **=** equal to.\n\nChecked: every cell I2:I${LAST}.` },
  { marks: 2, text: `In cells L2, L3, L4 and L5 find the Total, the Highest, the Lowest and the Average of the Net Amount (H2:H${LAST}) using the SUM, MAX, MIN and AVERAGE functions.`,
    criteria: [cellCheck("L2", value("L2")), cellCheck("L3", value("L3")), cellCheck("L4", value("L4")), cellCheck("L5", value("L5"))],
    solution: `1. **L2**: =SUM(H2:H${LAST}) → ${money(value("L2"))}.\n2. **L3**: =MAX(H2:H${LAST}) → ${money(value("L3"))}.\n3. **L4**: =MIN(H2:H${LAST}) → ${money(value("L4"))}.\n4. **L5**: =AVERAGE(H2:H${LAST}) → ${money(value("L5"))}.\n\nTip: type the formula and select the range H2:H${LAST} with the mouse, or click H2 and press **Ctrl+Shift+↓** to select down to the last row.\n\nChecked: L2, L3, L4 and L5, all with formulas.` },
  { marks: 2, text: `In cell L6 count the number of items using COUNTA on Item Name (B2:B${LAST}), and in cell L7 count the Books (Category = "Books") using COUNTIF.`,
    criteria: [cellCheck("L6", value("L6")), cellCheck("L7", value("L7"))],
    solution: `**COUNTA** counts every cell that is not empty. **=COUNTIF(range, criteria)** counts the cells that meet one condition.\n1. **L6**: =COUNTA(B2:B${LAST}) → ${value("L6")}.\n2. **L7**: =COUNTIF(C2:C${LAST},"Books") → ${value("L7")}.\n\nChecked: L6 and L7, both with formulas.` },
  { marks: 2, text: "In cell L8 find the total Net Amount of the Stationery items using SUMIF (Category = \"Stationery\").",
    criteria: [cellCheck("L8", value("L8"))],
    solution: `**=SUMIF(range, criteria, sum_range)** adds only the rows that meet the condition.\n1. Click **L8** and type **=SUMIF(C2:C${LAST},"Stationery",H2:H${LAST})** → Enter → ${money(value("L8"))}.\n\nThe first range (C) is checked for "Stationery", the last range (H) is added up.\n\nChecked: L8 with a formula.` },
  { marks: 1, text: `Format the range F2:H${LAST} (Amount, Discount and Net Amount) as Accounting Number Format with the ₹ symbol and 2 decimal places.`,
    criteria: [{ rule: "cells", range: `F2:H${LAST}`, props: { numberFormat: ["Accounting", "Currency"], currency: [null, "₹"], decimals: [2] } }],
    solution: `1. Select **F2:H${LAST}** (click F2, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Accounting Number Format (₹)**. It shows 2 decimal places: ₹ ${money(value("F2"))}.\n\n(Ctrl+1 → Number → **Currency**, Symbol ₹, Decimal places 2 also counts.)\n\nChecked: F2:H${LAST} in Accounting or Currency format with ₹ and 2 decimals.` },
  { marks: 2, text: `Apply All Borders to the complete table A1:I${LAST} and Center alignment to the Qty column D2:D${LAST}.`,
    criteria: [{ rule: "cells", range: `A1:I${LAST}`, props: { border: ["trbl"] } }, { rule: "cells", range: `D2:D${LAST}`, props: { align: ["center"] } }],
    solution: `1. Select **A1:I${LAST}** (click A1, then **Ctrl+Shift+→** and **Ctrl+Shift+↓**).\n2. HOME → **Borders ▾** → **All Borders**.\n3. Select **D2:D${LAST}** and click HOME → **Center** (Ctrl+E).\n\nChecked: every cell A1:I${LAST} has borders on all four sides, and D2:D${LAST} is centred.` },
  { marks: 1, text: "Apply AutoFit Column Width to the columns A to I.",
    criteria: [{ rule: "sheet", path: "autoFitCols", includesAll: letters("A", "I") }],
    solution: "1. Select the columns **A to I** (click the column letter A, hold Shift, click I).\n2. HOME → **Format ▾** → **AutoFit Column Width**.\n\n(Double-clicking the line between two column letters does the same.)\n\nDo this after the ₹ format, so the numbers fit.\n\nChecked: AutoFit on the columns A to I." },
  { marks: 1, text: "Freeze the top row of the sheet so the headings stay visible while scrolling.",
    criteria: [{ rule: "sheet", path: "freeze", equals: "A2" }],
    solution: "1. VIEW → **Freeze Panes ▾** → **Freeze Top Row**.\n\n(Clicking A2 and choosing Freeze Panes does the same.)\n\nChecked: panes frozen below row 1." },
  { marks: 2, text: "Rename the sheet Sheet1 to \"Sales\" and give the sheet tab Red colour.",
    criteria: [{ rule: "sheet", path: "name", equals: "Sales" }, { rule: "sheet", path: "tabColor", equals: ["FF0000", "C00000"] }],
    solution: "1. **Right-click** the sheet tab **Sheet1** (bottom-left) → **Rename**, type **Sales** → Enter. (Double-clicking the tab also works.)\n2. **Right-click** the tab → **Tab Color** → **Red**.\n\nChecked: the sheet name is Sales and the tab colour is red." },
  { marks: 2, text: `With Conditional Formatting highlight the Net Amount cells H2:H${LAST} that are Greater Than 1000 with Green Fill with Dark Green Text.`,
    criteria: [{ rule: "anyOf", criteria: conditional }],
    solution: `1. Select **H2:H${LAST}** (click H2, then **Ctrl+Shift+↓**).\n2. HOME → **Conditional Formatting ▾** → **Highlight Cells Rules** → **Greater Than...**\n3. Type **1000**, choose **Green Fill with Dark Green Text** → **OK**.\n\nChecked: a Greater Than 1000 rule with the green style on H2:H${LAST}.` },
  { marks: 1, text: `Apply Filter to the table A1:I${LAST}.`,
    criteria: [{ rule: "sheet", path: "filter", in: filterRanges }],
    solution: `1. Click any cell of the table, for example **A1**.\n2. DATA → **Filter** (or HOME → Sort & Filter ▾ → Filter, or **Ctrl+Shift+L**). Arrow buttons appear in the heading row.\n\nDo this last, after the formula columns are filled, so the filter covers A1:I${LAST}.\n\nChecked: a filter on the table.` },
];
const total = QUESTIONS.reduce((a, q) => a + q.marks, 0);
if (total !== 25 || QUESTIONS.length !== 15) throw new Error(`total ${total}`);

// ---------- documents ----------
const workingMatter = { schemaVersion: 1, language: "English", rows: LAST, cols: 20, cells: initialCells };
const sheet = { name: "Sales", freeze: "A2", tabColor: "FF0000", filter: `A1:I${LAST}`, filterHidden: {}, autoFitCols: letters("A", "I"),
  conditionalFormats: [{ range: rng("H"), type: "greaterThan", value: 1000, style: "greenDarkGreen" }] };
const model = { schemaVersion: "3", rows: LAST, cols: 20, cells: computed, merges: [], sheet, operations: [], savedAt: "2026-11-09T00:00:00.000Z" };
fs.writeFileSync("tests/fixtures/excel-test6-initial.json", JSON.stringify(workingMatter));
fs.writeFileSync("tests/fixtures/excel-test6-model.json", JSON.stringify(model));
const expand = (criteria) => criteria.flatMap((c) => (c.column ? columnChecks(c.column) : [c]));
fs.writeFileSync("tests/fixtures/excel-test6-rules.json", JSON.stringify(QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, criteria: expand(q.criteria) }))));

// ---------- SQL ----------
const dollar = (text) => { if (text.includes("$q$")) throw new Error("quote"); return `$q$${text}$q$`; };
const questionsJson = QUESTIONS.map((q, i) => ({ n: i + 1, marks: q.marks, text: q.text, solution: q.solution, criteria: q.criteria }));
const templates = Object.fromEntries(Object.entries(ROW_FORMULAS).map(([c, f]) => [c, f("#")]));
const columnValues = Object.fromEntries(Object.keys(ROW_FORMULAS).map((c) => [c, Array.from({ length: ROWS }, (_, i) => value(`${c}${i + 2}`))]));
const summaryFormulas = Object.fromEntries(Object.entries(SUMMARY_FORMULAS).map(([ref, f]) => [ref, [f, value(ref)]]));
const fixedCells = { ...EXTRA, ...Object.fromEntries(HEADERS.map((text, i) => [`${col(i)}1`, initialCells[`${col(i)}1`]])) };
const instructions = "1. Carefully read the instructions and solve the questions accordingly.\n2. All questions are mandatory.\n3. The sheet has 30 items (rows 2 to 31). Fill a formula in row 2, then double-click the fill handle to copy it down to row 31.\n4. **Maximum marks** and question-wise marks are shown with the questions.\n5. This is a normal-level paper: you can finish it in about 10 minutes. Complete each task directly in the spreadsheet using formulas, not by typing the answers.";

const sql = `-- English EXCEL EFFICIENCY TEST 6 (built by scripts/build-excel-test6.mjs; do not edit by hand): a NORMAL-level book-shop
-- sales sheet of 30 items, solvable in about 10 minutes -- multiply, 10%, subtract, IF, SUM/MAX/MIN/AVERAGE,
-- COUNTA/COUNTIF/SUMIF, heading format, Accounting ₹, borders + centre, AutoFit, Freeze, rename + tab colour,
-- conditional format (Greater Than), Filter.
-- Creates the test as a DRAFT: 15 questions, 25 marks, hand-written checks, text solutions and a model answer that
-- scores 25/25. No new code is needed (30 rows, only existing marking rules). Publish it from Admin -> Excel Efficiency.
-- Safe to run twice.
begin;

create or replace function pg_temp.excel_cell(v jsonb, f text default null) returns jsonb language sql immutable as $f$
 select jsonb_build_object('value', v, 'formula', f, 'bold', false, 'italic', false, 'underline', false, 'fontColor', null, 'fillColor', null,
   'border', null, 'numberFormat', 'General', 'align', null) $f$;
create or replace function pg_temp.column_checks(vals jsonb, col text) returns jsonb language sql immutable as $f$
 select jsonb_agg(jsonb_build_object('rule', 'value', 'cell', col || (r + 2), 'formula', true, 'equals', vals->col->r) order by r)
 from generate_series(0, jsonb_array_length(vals->col) - 1) r $f$;

do $mig$
declare
 t_id uuid; v_id uuid; q_id uuid; item jsonb; c jsonb; crit jsonb;
 admin_id uuid := '1cbaa98b-7310-4d0b-b659-f2fabcbcf86d';
 items jsonb := ${dollar(JSON.stringify(items))}::jsonb;
 fixed jsonb := ${dollar(JSON.stringify(fixedCells))}::jsonb;
 templates jsonb := ${dollar(JSON.stringify(templates))}::jsonb;
 vals jsonb := ${dollar(JSON.stringify(columnValues))}::jsonb;
 summary_formulas jsonb := ${dollar(JSON.stringify(summaryFormulas))}::jsonb;
 patches jsonb := ${dollar(JSON.stringify(patches))}::jsonb;
 questions jsonb := ${dollar(JSON.stringify(questionsJson))}::jsonb;
 cells jsonb; model_cells jsonb; working jsonb; model jsonb;
begin
 if exists (select 1 from public.excel_efficiency_tests where slug = 'efficiency-test-6') then raise notice 'EXCEL EFFICIENCY TEST 6 already exists'; return; end if;

 select fixed || jsonb_object_agg(chr(65 + i) || (r + 2), pg_temp.excel_cell(items->r->i)) into cells
 from generate_series(0, jsonb_array_length(items) - 1) r, generate_series(0, 4) i;
 working := jsonb_build_object('schemaVersion', 1, 'language', 'English', 'rows', ${LAST}, 'cols', 20, 'cells', cells);
 perform public.assert_excel_efficiency_working_matter(working);

 select cells || jsonb_object_agg(ref, cell) into model_cells from (
   select t.key || (r + 2) as ref, pg_temp.excel_cell(vals->t.key->r, replace(t.value, '#', (r + 2)::text)) as cell from jsonb_each_text(templates) t, generate_series(0, ${ROWS - 1}) r
   union all select key, pg_temp.excel_cell(value->1, value->>0) from jsonb_each(summary_formulas)) x;
 select model_cells || jsonb_object_agg(key, (model_cells->key) || value) into model_cells from jsonb_each(patches);
 model := jsonb_build_object('schemaVersion', '3', 'rows', ${LAST}, 'cols', 20, 'cells', model_cells, 'merges', '[]'::jsonb,
   'sheet', ${dollar(JSON.stringify(sheet))}::jsonb, 'operations', '[]'::jsonb, 'savedAt', '2026-11-09T00:00:00.000Z');
 perform public.assert_excel_efficiency_document_schema(model);

 insert into public.excel_efficiency_tests (slug, title, language, status, created_by, sequence, auto_publish_results)
 values ('efficiency-test-6', 'EFFICIENCY TEST 6', 'English', 'draft', admin_id, 6, true) returning id into t_id;
 insert into public.excel_efficiency_versions (test_id, version_number, title, language, description, instructions_markdown, question_count, maximum_marks,
   duration_options, passing_marks, working_matter_snapshot, created_by, delivery_pdf, delivery_onscreen, student_question_toggle, model_answer_snapshot)
 values (t_id, 1, 'EFFICIENCY TEST 6', 'English', 'Normal level, about 10 minutes: book-shop sales sheet of 30 items -- basic formulas and everyday formatting',
   ${dollar(instructions)}, 15, 25, array[600, 900, 1200], 9, working, admin_id, false, true, true, model) returning id into v_id;
 update public.excel_efficiency_tests set current_version_id = v_id, current_version_number = 1 where id = t_id;

 for item in select value from jsonb_array_elements(questions) loop
  crit := '[]'::jsonb;
  for c in select value from jsonb_array_elements(item->'criteria') loop
   if c ? 'column' then crit := crit || pg_temp.column_checks(vals, c->>'column');
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
join public.excel_efficiency_questions q on q.version_id = v.id where t.slug = 'efficiency-test-6' order by q.question_number;

commit;
`;
fs.writeFileSync("supabase/migrations/202611091000_excel_test6_normal_shop_sheet.sql", sql);

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
  "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><cols><col min="2" max="2" width="26" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="11" max="11" width="28" customWidth="1"/></cols><sheetData>${rowsXml.join("")}</sheetData></worksheet>`,
  "xl/sharedStrings.xml": "",
};
files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${NS} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((t) => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join("")}</sst>`;
fs.mkdirSync("docs/excel-practice", { recursive: true });
fs.writeFileSync("docs/excel-practice/EXCEL-TEST-6-practice-30-items.xlsx", zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));
console.log("sql bytes", sql.length, "questions", QUESTIONS.length, "marks", total);

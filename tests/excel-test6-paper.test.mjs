import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { parseWorkingSheetXlsx } from "../lib/excel-sheet.ts";

// English EXCEL EFFICIENCY TEST 6 (scripts/build-excel-test6.mjs, migration 202611091000): a NORMAL-level book-shop
// sheet of 30 items a student can finish in about 10 minutes -- multiply, 10%, subtract, IF, SUM/MAX/MIN/AVERAGE,
// COUNTA/COUNTIF/SUMIF, heading format, Accounting ₹, borders + centre, AutoFit, Freeze, rename + tab colour,
// Greater Than conditional format, Filter. This repeats the hand-written rules with a JavaScript copy of
// excel_efficiency_criterion_matches.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const [model, matter, rules] = await Promise.all([read("excel-test6-model.json"), read("excel-test6-initial.json"), read("excel-test6-rules.json")]);
const start = { schemaVersion: "3", rows: matter.rows, cols: matter.cols, cells: matter.cells, merges: [], sheet: {}, operations: [], savedAt: "1970-01-01T00:00:00.000Z" };

const same = (actual, allowed) => [allowed].flat().some((v) => typeof v === "number" ? typeof actual === "number" && Math.abs(v - actual) < 0.001
  : typeof v === "string" ? typeof actual === "string" && v.toUpperCase() === actual.toUpperCase() : v === (actual ?? null));
const contains = (big, small) => Object.entries(small).every(([k, v]) => big?.[k] === v);
const cellsOf = (range) => {
  const [a, b = a] = range.split(":");
  const out = [];
  for (let r = +a.slice(1); r <= +b.slice(1); r++) for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push(String.fromCharCode(c) + r);
  return out;
};
function matches(doc, c) {
  if (c.rule === "anyOf") return c.criteria.some((x) => matches(doc, x));
  if (c.rule === "value") { const cell = doc.cells[c.cell] ?? {}; return same(cell.value, c.equals); }
  if (c.rule === "cells") return cellsOf(c.range).every((ref) => Object.entries(c.props).every(([k, v]) => same(doc.cells[ref]?.[k] ?? null, v)));
  if (c.rule === "sheet") {
    const actual = doc.sheet?.[c.path];
    if ("equals" in c) return same(actual, c.equals);
    if (c.in) return c.in.includes(actual);
    if (c.includesAll) return Array.isArray(actual) && c.includesAll.every((x) => actual.includes(x));
    if (c.includes) return Array.isArray(actual) && actual.some((item) => contains(item, c.includes));
  }
  throw new Error(`criterion ${c.rule} not copied here`);
}
const marks = (doc) => rules.map((q) => (q.criteria.every((c) => matches(doc, c)) ? q.marks : 0));
const total = (list) => list.reduce((a, b) => a + b, 0);
const solved = (change) => { const doc = structuredClone(model); change(doc.cells, doc); doc.cells = recomputeFormulas(doc.cells); return marks(doc); };

test("15 questions, 25 marks: the model answer gets every mark, the untouched sheet none", () => {
  assert.equal(rules.length, 15);
  assert.equal(total(rules.map((q) => q.marks)), 25);
  assert.deepEqual(marks(model), rules.map((q) => q.marks));
  assert.equal(total(marks(start)), 0);
});

test("the sheet is small enough for 10 minutes: 30 items, a handful of formula columns", () => {
  assert.equal(matter.rows, 31);
  assert.equal(matter.cells.B2.value, "Rough Note Book");
  assert.equal(matter.cells.K1.value, "Summary (use formulas)");
  assert.equal(model.cells.F2.value, 800);
  assert.equal(model.cells.G2.value, 80);
  assert.equal(model.cells.H2.value, 720);
  assert.equal(model.cells.I2.value, "Low");
  // the ten summary answers the paper asks for
  assert.deepEqual(["L2", "L3", "L4", "L6", "L7"].map((ref) => model.cells[ref].value), [37449, 3330, 306, 30, 10]);
  assert.equal(model.cells.L5.value, 1248.3);
  assert.equal(model.cells.L8.value, 6309);
});

test("other correct ways of writing a formula keep the marks", () => {
  const ways = solved((cells) => {
    for (let r = 2; r <= 31; r++) {
      cells[`F${r}`].formula = `=PRODUCT(D${r},E${r})`;
      cells[`G${r}`].formula = `=F${r}*0.1`;
      cells[`H${r}`].formula = `=F${r}-G${r}`;
      cells[`I${r}`].formula = `=IF(H${r}>1000-0.0001,"High","Low")`;
    }
    cells.L2.formula = "=SUM(H2:H31)";
    cells.L6.formula = "=COUNTA(A2:A31)";
    cells.L7.formula = "=COUNTIF(C2:C31,\"books\")";
  });
  assert.equal(total(ways), 25);
});

test("the answer counts however it was made (Flash Fill, typed, pasted values); a wrong answer or range loses the marks", () => {
  // every formula replaced by its plain value, as Flash Fill / typing / Paste Values leave it
  const asValues = solved((cells) => { for (const cell of Object.values(cells)) cell.formula = null; });
  assert.equal(total(asValues), 25);
  // a typed number for Discount (no formula) is fine when it is the right number...
  assert.equal(solved((cells) => { for (let r = 2; r <= 31; r++) cells[`G${r}`].formula = null; })[2], 2);
  // ...and wrong when it is not
  assert.equal(solved((cells) => { for (let r = 2; r <= 31; r++) { cells[`G${r}`].formula = null; cells[`G${r}`].value = 1; } })[2], 0);
  // Net Amount = Amount + Discount
  assert.equal(solved((cells) => { for (let r = 2; r <= 31; r++) cells[`H${r}`].formula = `=F${r}+G${r}`; })[3], 0);
  // an IF with the wrong limit (500 instead of 1000)
  assert.equal(solved((cells) => { for (let r = 2; r <= 31; r++) cells[`I${r}`].formula = `=IF(H${r}>=500,"High","Low")`; })[4], 0);
  // SUM over only 29 rows
  assert.equal(solved((cells) => { cells.L2.formula = "=SUM(H2:H30)"; })[5], 0);
  // SUMIF with the wrong category
  assert.equal(solved((cells) => { cells.L8.formula = "=SUMIF(C2:C31,\"Bags\",H2:H31)"; })[7], 0);
});

test("formatting questions: ₹ Accounting or Currency, All Borders on the whole table, AutoFit A to I, tab colour, Greater Than 1000", () => {
  let doc = structuredClone(model);
  for (let r = 2; r <= 31; r++) for (const c of ["F", "G", "H"]) Object.assign(doc.cells[`${c}${r}`], { numberFormat: "Currency", currency: "₹", decimals: 2 });
  assert.equal(marks(doc)[8], 1);
  doc.cells.G9.decimals = 0;
  assert.equal(marks(doc)[8], 0);

  doc = structuredClone(model);
  doc.cells.I31.border = null;
  assert.equal(marks(doc)[9], 0);

  doc = structuredClone(model);
  doc.sheet.autoFitCols = ["A", "B", "C", "D", "E", "F", "G", "H"];
  assert.equal(marks(doc)[10], 0);

  doc = structuredClone(model);
  doc.sheet.tabColor = "0000FF";
  assert.equal(marks(doc)[12], 0);
  doc.sheet.tabColor = "FF0000";
  doc.sheet.name = "sales";
  assert.equal(marks(doc)[12], 2);
  doc.sheet.name = "Sheet1";
  assert.equal(marks(doc)[12], 0);

  doc = structuredClone(model);
  doc.sheet.conditionalFormats = [{ range: "H2:H31", type: "greaterThan", value: "1000", style: "greenDarkGreen" }];
  assert.equal(marks(doc)[13], 2);
  doc.sheet.conditionalFormats = [{ range: "H2:H31", type: "greaterThan", value: 1000, style: "lightRedDarkRed" }];
  assert.equal(marks(doc)[13], 0);
  doc.sheet.conditionalFormats = [{ range: "H2:H31", type: "greaterThan", value: 500, style: "greenDarkGreen" }];
  assert.equal(marks(doc)[13], 0);

  doc = structuredClone(model);
  doc.sheet.filter = "A1:H31";
  assert.equal(marks(doc)[14], 0);
});

test("every question has a written solution in the migration and none uses an image", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611091000_excel_test6_normal_shop_sheet.sql", import.meta.url), "utf8");
  assert.match(sql, /'efficiency-test-6'/);
  assert.match(sql, /'draft'/);
  assert.doesNotMatch(sql, /solution_image/);
  const questionsJson = sql.match(/questions jsonb := \$q\$(.*?)\$q\$::jsonb;/s)[1];
  const questions = JSON.parse(questionsJson);
  assert.equal(questions.length, 15);
  for (const q of questions) assert.ok(q.solution.length > 60, `question ${q.n} has a solution`);
});

test("the practice .xlsx opens with the same cells as the test sheet", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../docs/excel-practice/EXCEL-TEST-6-practice-30-items.xlsx", import.meta.url)));
  const sheet = parseWorkingSheetXlsx(bytes, "English");
  assert.deepEqual(Object.keys(matter.cells).filter((ref) => sheet.cells[ref]?.value !== matter.cells[ref].value), []);
});

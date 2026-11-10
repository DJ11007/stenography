import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";

// English EXCEL EFFICIENCY TEST 4, VERSION 2 (scripts/build-excel-test4-v2.mjs, migration 202611101400): the easier
// replacement paper -- SUM/Percentage/IF/COUNTA/COUNT plus 8 easy formatting questions, 15 questions, 25 marks, on
// a trimmed A-M sheet (Grade/Selection/Scholarship/Hostel moved to TEST 8). Version 1 (with its 16 real attempts)
// is untouched by this version 2 migration -- see tests/excel-test4-paper.test.mjs for that one.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const [model, matter, rules] = await Promise.all([read("excel-test4-v2-model.json"), read("excel-test4-v2-initial.json"), read("excel-test4-v2-rules.json")]);
const start = { schemaVersion: "3", rows: matter.rows, cols: matter.cols, cells: matter.cells, merges: [], sheet: {}, operations: [], savedAt: "1970-01-01T00:00:00.000Z" };

const same = (actual, allowed) => [allowed].flat().some((v) => typeof v === "number" ? typeof actual === "number" && Math.abs(v - actual) < 0.001
  : typeof v === "string" ? typeof actual === "string" && v.toUpperCase() === actual.toUpperCase() : v === (actual ?? null));
const contains = (big, small) => Object.entries(small).every(([k, v]) => big?.[k] === v);
const cellsOf = (range) => { const [a, b = a] = range.split(":"); const out = []; for (let r = +a.slice(1); r <= +b.slice(1); r++) for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push(String.fromCharCode(c) + r); return out; };
function matches(doc, c) {
  if (c.rule === "anyOf") return c.criteria.some((x) => matches(doc, x));
  if (c.rule === "allOf") return c.criteria.every((x) => matches(doc, x));
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

test("the sheet is trimmed to A-M (Grade/Selection/Scholarship/Hostel moved to TEST 8), same 200 students as TEST 4", () => {
  assert.equal(matter.rows, 201);
  assert.equal(Object.keys(matter.cells).some((ref) => /^[N-Q]/.test(ref) && +ref.slice(1) <= 201), false, "no N/O/P/Q columns in the starting sheet");
  assert.equal(matter.cells.B2.value, "Rajnish Sharma");
  assert.equal(matter.cells.A3.value, 1002);
  assert.equal(model.cells.K2.value, 303);
  assert.equal(model.cells.L2.value, 75.75);
  assert.equal(model.cells.M2.value, "PASS");
});

test("other correct ways earn the marks too; a wrong answer or a half-filled column does not", () => {
  const ways = solved((cells) => { for (let r = 2; r <= 201; r++) cells[`L${r}`].formula = `=K${r}/400`; });
  assert.equal(total(ways), 25);
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`K${r}`].formula = `=F${r}+G${r}+H${r}+I${r}`; })[1], 0);
  assert.equal(solved((cells) => { for (let r = 102; r <= 201; r++) delete cells[`M${r}`]; })[3], 0);
});

test("formatting questions: percentage format, all borders, AutoFit + center, freeze + rename, dark blue heading, italic/center, tab colour + bold, number format + center", () => {
  let doc = structuredClone(model);
  doc.cells.L2.decimals = 0;
  assert.equal(marks(doc)[7], 0);

  doc = structuredClone(model);
  doc.cells.M201.border = null;
  assert.equal(marks(doc)[8], 0);

  doc = structuredClone(model);
  doc.sheet.autoFitCols = ["A", "B"];
  assert.equal(marks(doc)[9], 0);
  doc.sheet.autoFitCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  doc.cells.C2.align = "left";
  assert.equal(marks(doc)[9], 0);

  doc = structuredClone(model);
  doc.sheet.freeze = null;
  assert.equal(marks(doc)[10], 0);
  doc.sheet.freeze = "A2";
  doc.sheet.name = "Sheet1";
  assert.equal(marks(doc)[10], 0);

  doc = structuredClone(model);
  doc.cells.A1.fontColor = "FF0000";
  assert.equal(marks(doc)[11], 0);
  doc.cells.A1.fontColor = "1F3864";
  doc.cells.A1.fontSize = 11;
  assert.equal(marks(doc)[11], 0);

  doc = structuredClone(model);
  doc.cells.E201.italic = false;
  assert.equal(marks(doc)[12], 0);

  doc = structuredClone(model);
  doc.sheet.tabColor = "FF0000";
  assert.equal(marks(doc)[13], 0);
  doc.sheet.tabColor = "0070C0";
  doc.cells.K2.bold = false;
  assert.equal(marks(doc)[13], 0);

  doc = structuredClone(model);
  doc.cells.J2.decimals = 2;
  assert.equal(marks(doc)[14], 0);
});

test("every question has a written solution in the migration, and version 1 (with its real attempts) is untouched by this migration", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611101400_excel_test4_v2_easier.sql", import.meta.url), "utf8");
  assert.match(sql, /48dd8076-8223-4887-a83e-4cdec34561fd/);
  assert.match(sql, /next_version/);
  assert.doesNotMatch(sql, /delete from public\.excel_efficiency_(questions|versions)/);
  assert.doesNotMatch(sql, /update public\.excel_efficiency_questions/);
  const questionsJson = sql.match(/questions jsonb := \$q\$(.*?)\$q\$::jsonb;/s)[1];
  const questions = JSON.parse(questionsJson);
  assert.equal(questions.length, 15);
  for (const q of questions) assert.ok(q.solution.length > 60, `question ${q.n} has a solution`);
});

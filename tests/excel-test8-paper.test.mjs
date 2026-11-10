import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";
import { parseWorkingSheetXlsx } from "../lib/excel-sheet.ts";

// English EXCEL EFFICIENCY TEST 8 (scripts/build-excel-test8.mjs, migration 202611101500): the harder half of
// EXCEL EFFICIENCY TEST 4 version 1 (nested IF Grade, IF+AND Selection, IF+OR Scholarship, IF+<> Hostel,
// COUNTIF/COUNTIFS/AVERAGEIF) reused word-for-word, plus 7 new easy formatting questions. Total/Percentage/Result
// (K/L/M) are given/pre-filled in the starting sheet. Same 200-student data as TEST 4.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const [model, matter, rules] = await Promise.all([read("excel-test8-model.json"), read("excel-test8-initial.json"), read("excel-test8-rules.json")]);
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

test("Total/Percentage/Result are given (pre-filled, grey) in the starting sheet; Grade/Selection/Scholarship/Hostel are blank", () => {
  assert.equal(matter.rows, 201);
  assert.equal(matter.cells.K2.formula, "=SUM(F2:I2)");
  assert.equal(matter.cells.K2.fillColor, "D9D9D9");
  assert.equal(matter.cells.L2.formula, "=K2/400*100");
  assert.equal(matter.cells.M2.formula, '=IF(K2>=160,"PASS","FAIL")');
  assert.equal(recomputeFormulas(matter.cells).K2.value, 303, "the app computes the given value from the formula on load");
  for (const c of ["N", "O", "P", "Q"]) assert.equal(matter.cells[`${c}2`], undefined, `${c}2 is blank (not in the starting sheet) -- the student fills it in`);
  assert.equal(matter.cells.T4, undefined);
  assert.equal(matter.cells.S4.value, "Students who passed");
});

test("other correct ways earn the marks too; a wrong answer or the nested IF in the wrong order loses them", () => {
  const ways = solved((cells) => { for (let r = 2; r <= 201; r++) cells[`Q${r}`].formula = `=IF(D${r}="Jaipur","Day Scholar","Hostel")`; cells.T6.formula = '=COUNTIF(J2:J201,">=35")'; });
  assert.equal(total(ways), 25);
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`N${r}`].formula = `=IF(L${r}>=40,"C",IF(L${r}>=60,"B",IF(L${r}>=75,"A","D")))`; })[1], 0);
  assert.equal(solved((cells) => { cells.T11.formula = '=AVERAGEIF(D2:D201,"Jodhpur",K2:K201)'; })[8], 0);
});

test("formatting questions: all borders, AutoFit, freeze + filter, center Gender, tab colour + rename, percentage format", () => {
  let doc = structuredClone(model);
  doc.cells.Q201.border = null;
  assert.equal(marks(doc)[9], 0);

  doc = structuredClone(model);
  doc.sheet.autoFitCols = ["A"];
  assert.equal(marks(doc)[10], 0);

  doc = structuredClone(model);
  doc.sheet.freeze = null;
  assert.equal(marks(doc)[11], 0);
  doc.sheet.freeze = "A2";
  doc.sheet.filter = "A1:A201";
  assert.equal(marks(doc)[11], 0);

  doc = structuredClone(model);
  doc.cells.C201.align = "left";
  assert.equal(marks(doc)[12], 0);

  doc = structuredClone(model);
  doc.sheet.tabColor = "FF0000";
  assert.equal(marks(doc)[13], 0);
  doc.sheet.tabColor = "00B050";
  doc.sheet.name = "Sheet1";
  assert.equal(marks(doc)[13], 0);

  doc = structuredClone(model);
  doc.cells.L201.decimals = 0;
  assert.equal(marks(doc)[14], 0);
});

test("every question has a written solution in the migration and the test is created as a draft", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611101500_excel_test8_recruitment_logic.sql", import.meta.url), "utf8");
  assert.match(sql, /'efficiency-test-8'/);
  assert.match(sql, /'draft'/);
  assert.doesNotMatch(sql, /solution_image/);
  const questionsJson = sql.match(/questions jsonb := \$q\$(.*?)\$q\$::jsonb;/s)[1];
  const questions = JSON.parse(questionsJson);
  assert.equal(questions.length, 15);
  for (const q of questions) assert.ok(q.solution.length > 60, `question ${q.n} has a solution`);
});

test("the practice .xlsx opens with the same cells as the test sheet (K/L/M show their given value, not blank)", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../docs/excel-practice/EXCEL-TEST-8-practice-200-students.xlsx", import.meta.url)));
  const sheet = parseWorkingSheetXlsx(bytes, "English");
  const given = (ref) => /^[KLM][0-9]+$/.test(ref) && +ref.slice(1) >= 2;
  const mismatched = Object.keys(matter.cells).filter((ref) => !given(ref) && sheet.cells[ref]?.value !== matter.cells[ref].value);
  assert.deepEqual(mismatched, []);
  assert.equal(sheet.cells.K2.value, 303);
  assert.equal(sheet.cells.L2.value, 75.75);
  assert.equal(sheet.cells.M2.value, "PASS");
});

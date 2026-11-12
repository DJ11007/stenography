import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";

// English EXCEL EFFICIENCY TEST 9 (scripts/build-excel-test9.mjs, migration 202611121600): the harder half of
// TEST 5's split -- VLOOKUP+IFERROR Allowance, RANK, UPPER/LEFT/RIGHT/& Emp Code, SUMIF/SUMIFS, INDEX/MATCH,
// double VLOOKUP, plus 9 easy formatting questions, 15 questions, 25 marks, on the full A-N sheet. Columns
// H/I/J/L are given/pre-filled -- L specifically as a given FORMULA (=F+J+K) that recomputes once the student
// fills in K (Allowance) themselves. A brand-new test; does not touch TEST 5 in any version.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const [model, matter, rules] = await Promise.all([read("excel-test9-model.json"), read("excel-test9-initial.json"), read("excel-test9-rules.json")]);
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

test("the full A-N sheet, same 200 employees as TEST 5; H/I/J/L are given, L given as a live formula", () => {
  assert.equal(matter.rows, 201);
  assert.equal(matter.cells.B2.value, "  rAMESH  kumar SHARMA ");
  assert.equal(matter.cells.A3.value, "RJ26002");
  for (const col of ["H", "I", "J", "L"]) {
    assert.equal(matter.cells[`${col}2`].fillColor, "D9D9D9", `${col} is given/pre-filled`);
    assert.ok(matter.cells[`${col}2`].formula, `${col} keeps its formula`);
  }
  assert.equal(matter.cells.L2.formula, "=F2+J2+K2");
  assert.equal(Object.keys(matter.cells).some((ref) => /^K\d+$/.test(ref) && +ref.slice(1) <= 201 && +ref.slice(1) >= 2), false, "K (Allowance) is not given");
  assert.equal(model.cells.K2.value, 2000);
  assert.equal(model.cells.M2.value, 115);
  assert.equal(model.cells.N2.value, "REV-001");

  // L recomputes once the student fills K themselves, since L's own given formula references K.
  const filled = structuredClone(matter.cells);
  filled.K2 = { ...filled.K2, value: null, formula: "=IFERROR(VLOOKUP(D2,$S$6:$T$10,2,FALSE),0)" };
  const recomputed = recomputeFormulas(filled);
  assert.equal(recomputed.L2.value, 39975);
});

test("other correct ways earn the marks too; a wrong answer or a half-filled column does not", () => {
  const ways = solved((cells) => { for (let r = 2; r <= 201; r++) cells[`M${r}`].formula = `=RANK(L${r},$L$2:$L$201,0)`; });
  assert.equal(total(ways), 25);
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`K${r}`].formula = `=0`; })[0], 0);
  assert.equal(solved((cells) => { for (let r = 102; r <= 201; r++) delete cells[`N${r}`]; })[2], 0);
});

test("formatting questions: yellow heading, borders, autofit, freeze + filter, center dept, green tab + rename, accounting format, italic post, comma + center", () => {
  let doc = structuredClone(model);
  doc.cells.A1.fillColor = null;
  assert.equal(marks(doc)[6], 0);

  doc = structuredClone(model);
  doc.cells.N201.border = null;
  assert.equal(marks(doc)[7], 0);

  doc = structuredClone(model);
  doc.sheet.autoFitCols = ["A", "B"];
  assert.equal(marks(doc)[8], 0);

  doc = structuredClone(model);
  doc.sheet.freeze = null;
  assert.equal(marks(doc)[9], 0);
  doc.sheet.freeze = "A2";
  doc.sheet.filter = null;
  assert.equal(marks(doc)[9], 0);

  doc = structuredClone(model);
  doc.cells.C2.align = "left";
  assert.equal(marks(doc)[10], 0);

  doc = structuredClone(model);
  doc.sheet.tabColor = "FF0000";
  assert.equal(marks(doc)[11], 0);
  doc.sheet.tabColor = "00B050";
  doc.sheet.name = "Sheet1";
  assert.equal(marks(doc)[11], 0);

  doc = structuredClone(model);
  doc.cells.L2.numberFormat = "General";
  assert.equal(marks(doc)[12], 0);

  doc = structuredClone(model);
  doc.cells.D201.italic = false;
  assert.equal(marks(doc)[13], 0);

  doc = structuredClone(model);
  doc.cells.F2.decimals = 2;
  assert.equal(marks(doc)[14], 0);
});

test("every question has a written solution in the migration, and this is a brand-new test (no TEST 5 row is touched)", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611121600_excel_test9_split.sql", import.meta.url), "utf8");
  assert.match(sql, /efficiency-test-9/);
  assert.doesNotMatch(sql, /update public\.excel_efficiency_tests set.*89d14ede-4263-4510-b42f-1d7469e27ca6/);
  assert.doesNotMatch(sql, /delete from public\.excel_efficiency_(questions|versions|tests)/);
  assert.doesNotMatch(sql, /update public\.excel_efficiency_questions/);
  const questionsJson = sql.match(/questions jsonb := \$q\$(.*?)\$q\$::jsonb;/s)[1];
  const questions = JSON.parse(questionsJson);
  assert.equal(questions.length, 15);
  for (const q of questions) assert.ok(q.solution.length > 60, `question ${q.n} has a solution`);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recomputeFormulas } from "../lib/excel-sheet-model.ts";

// English EXCEL EFFICIENCY TEST 4 (scripts/build-excel-test4.mjs, migration 202611081400): 200 students, IF / nested IF /
// AND / OR / <> / COUNTA / COUNT / COUNTIF / COUNTIFS / AVERAGEIF. The live database's marking gave the model answer
// 25/25 and the untouched sheet 0 (dry run, 8 Nov 2026); this checks the same rules with a JavaScript copy of
// excel_efficiency_criterion_matches for the criterion kinds the paper uses.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const [model, matter, rules] = await Promise.all([read("excel-test4-model.json"), read("excel-test4-initial.json"), read("excel-test4-rules.json")]);
const start = { schemaVersion: "3", rows: matter.rows, cols: matter.cols, cells: matter.cells, merges: [], sheet: {}, operations: [], savedAt: "1970-01-01T00:00:00.000Z" };
const clone = (value) => structuredClone(value);

const same = (actual, allowed) => [allowed].flat().some((v) => typeof v === "number" ? typeof actual === "number" && Math.abs(v - actual) < 0.001
  : typeof v === "string" ? typeof actual === "string" && v.toUpperCase() === actual.toUpperCase() : v === actual);
const contains = (big, small) => Object.entries(small).every(([k, v]) => big?.[k] === v);
const cellsOf = (range) => { const [a, b = a] = range.split(":"); const out = []; for (let r = +a.slice(1); r <= +b.slice(1); r++) for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push(String.fromCharCode(c) + r); return out; };
function matches(doc, c) {
  if (c.rule === "anyOf") return c.criteria.some((x) => matches(doc, x));
  if (c.rule === "allOf") return c.criteria.every((x) => matches(doc, x));
  if (c.rule === "value") { const cell = doc.cells[c.cell] ?? {}; return same(cell.value, c.equals); }
  if (c.rule === "cells") return cellsOf(c.range).every((ref) => Object.entries(c.props).every(([k, v]) => same(doc.cells[ref]?.[k] ?? (k === "wrap" || k === "bold" ? false : null), v)));
  if (c.rule === "sheet") {
    const actual = doc.sheet?.[c.path];
    if (c.in) return same(actual, c.in);
    if (c.includes) return Array.isArray(actual) && actual.some((item) => contains(item, c.includes));
  }
  throw new Error(`criterion ${c.rule} not copied here`);
}
const marks = (doc) => rules.map((q) => (q.criteria.every((c) => matches(doc, c)) ? q.marks : 0));
const total = (list) => list.reduce((a, b) => a + b, 0);

test("15 questions, 25 marks: the model answer gets every mark, the untouched sheet none", () => {
  assert.equal(rules.length, 15);
  assert.equal(total(rules.map((q) => q.marks)), 25);
  assert.deepEqual(marks(model), rules.map((q) => q.marks));
  assert.equal(total(marks(start)), 0);
});

test("200 students in rows 2-201, some absent (AB) in English only; the summary labels sit in S2:S11 beside empty answer cells", () => {
  assert.equal(matter.rows, 201);
  assert.equal(matter.cells.B201.value.length > 3, true);
  const english = Array.from({ length: 200 }, (_, i) => matter.cells[`G${i + 2}`].value);
  assert.ok(english.filter((v) => v === "AB").length >= 5);
  for (const col of "FHIJ") assert.ok(Array.from({ length: 200 }, (_, i) => matter.cells[`${col}${i + 2}`].value).every((v) => typeof v === "number"), `${col} has numbers only`);
  for (let r = 2; r <= 11; r++) { assert.ok(matter.cells[`S${r}`].value); assert.equal(matter.cells[`T${r}`], undefined); }
});

test("other correct ways earn the marks too (even typed values); a wrong answer, a wrong range or a half-filled column do not", () => {
  const solved = (change) => { const doc = clone(model); change(doc.cells, doc); doc.cells = recomputeFormulas(doc.cells); return marks(doc); };
  // Percentage as a fraction (=K2/400 with % style), grade with IFS, hostel with = instead of <>
  const ways = solved((cells) => { for (let r = 2; r <= 201; r++) { cells[`L${r}`].formula = `=K${r}/400`; cells[`N${r}`].formula = `=IFS(L${r}>=0.75,"A",L${r}>=0.6,"B",L${r}>=0.4,"C",L${r}<0.4,"D")`; cells[`Q${r}`].formula = `=IF(D${r}="Jaipur","Day Scholar","Hostel")`; } cells.T4.formula = '=COUNTIF(K2:K201,">=160")'; });
  assert.equal(total(ways), 25);
  // =F2+G2+H2+I2 gives #VALUE! for the AB rows
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`K${r}`].formula = `=F${r}+G${r}+H${r}+I${r}`; })[1], 0);
  // the right answer typed instead of a formula counts (the answer is checked, not the method); a wrong one does not
  assert.equal(solved((cells) => { cells.T2 = { ...cells.T2, formula: null, value: 200 }; })[8], 2);
  assert.equal(solved((cells) => { cells.T2 = { ...cells.T2, formula: null, value: 199 }; })[8], 0);
  // AVERAGEIF without ROUND
  assert.equal(solved((cells) => { cells.T11.formula = '=AVERAGEIF(D2:D201,"Jodhpur",K2:K201)'; })[12], 0);
  // only the first 100 rows filled
  assert.equal(solved((cells) => { for (let r = 102; r <= 201; r++) delete cells[`M${r}`]; })[3], 0);
  // the nested IF in the wrong order gives B to students who should get A
  assert.equal(solved((cells) => { for (let r = 2; r <= 201; r++) cells[`N${r}`].formula = `=IF(L${r}>=40,"C",IF(L${r}>=60,"B",IF(L${r}>=75,"A","D")))`; })[4], 0);
});

test("conditional formatting may use Equal To or Text that Contains, and the filter may cover the data before the formula columns", () => {
  const doc = clone(model);
  doc.sheet.conditionalFormats = [{ range: "M2:M201", type: "textContains", value: "fail", style: "lightRedDarkRed" }];
  doc.sheet.filter = "A1:J201";
  assert.deepEqual(marks(doc).slice(13), [1, 1]);
  doc.sheet.conditionalFormats = [{ range: "M2:M201", type: "equalTo", value: "FAIL", style: "yellowDarkYellow" }];
  doc.sheet.filter = "A1:A201";
  assert.deepEqual(marks(doc).slice(13), [0, 0]);
});

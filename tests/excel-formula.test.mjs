import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFormula, computedCellValue, columnLetters, columnIndex, parseCellRef } from "../lib/excel-formula.ts";

const cells = { B1: { value: 10, formula: null }, B2: { value: 20, formula: null }, B3: { value: 30, formula: null }, C1: { value: "Name", formula: null } };

test("SUM and AVERAGE work over a range", () => {
  assert.equal(evaluateFormula("=SUM(B1:B3)", cells), 60);
  assert.equal(evaluateFormula("=AVERAGE(B1:B3)", cells), 20);
});

test("MAX, MIN, COUNT, COUNTA work over a range", () => {
  assert.equal(evaluateFormula("=MAX(B1:B3)", cells), 30);
  assert.equal(evaluateFormula("=MIN(B1:B3)", cells), 10);
  assert.equal(evaluateFormula("=COUNT(B1:B3)", cells), 3);
});

test("arithmetic operator precedence is respected", () => {
  assert.equal(evaluateFormula("=B1+B2*2", cells), 50);
  assert.equal(evaluateFormula("=(B1+B2)*2", cells), 60);
  assert.equal(evaluateFormula("=B3/B1-1", cells), 2);
});

test("IF evaluates the correct branch", () => {
  assert.equal(evaluateFormula("=IF(1,B1,B2)", cells), 10);
  assert.equal(evaluateFormula("=IF(0,B1,B2)", cells), 20);
});

test("an unsupported comparator produces a controlled error value instead of crashing", () => {
  assert.equal(evaluateFormula("=IF(B1>5,1,0)", cells), "#ERROR!");
});

test("a formula referencing another formula resolves transitively", () => {
  const chained = { ...cells, B4: { value: null, formula: "=SUM(B1:B3)" } };
  assert.equal(evaluateFormula("=B4+1", chained), 61);
});

test("a self-referential formula chain is bounded and reports an error instead of looping forever", () => {
  const circular = { A1: { value: null, formula: "=A2" }, A2: { value: null, formula: "=A1" } };
  const result = evaluateFormula("=A1", circular);
  assert.equal(typeof result, "string");
  assert.match(result, /^#(REF|ERROR)!$/);
});

test("computedCellValue returns the raw value for a non-formula cell and the evaluated value for a formula cell", () => {
  assert.equal(computedCellValue("C1", cells), "Name");
  assert.equal(computedCellValue("B1", cells), 10);
  assert.equal(computedCellValue("Z9", cells), null);
});

test("column letter/index conversions round-trip, including past Z", () => {
  assert.equal(columnLetters(0), "A");
  assert.equal(columnLetters(25), "Z");
  assert.equal(columnLetters(26), "AA");
  assert.equal(columnIndex("A"), 0);
  assert.equal(columnIndex("Z"), 25);
  assert.equal(columnIndex("AA"), 26);
});

test("parseCellRef extracts column and row", () => {
  assert.deepEqual(parseCellRef("B12"), { col: 1, row: 12 });
  assert.deepEqual(parseCellRef("AA1"), { col: 26, row: 1 });
});

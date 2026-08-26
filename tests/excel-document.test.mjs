import test from "node:test";
import assert from "node:assert/strict";
import { validateExcelDocument, validateExcelOperations } from "../lib/excel-document.ts";

const cell = (overrides = {}) => ({ value: null, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: "left", ...overrides });
const doc = (overrides = {}) => ({ schemaVersion: "2", rows: 5, cols: 3, cells: { A1: cell({ value: "Item" }), B1: cell({ value: 10, numberFormat: "Number", align: "right" }) }, operations: [], savedAt: new Date().toISOString(), ...overrides });

test("accepts a well-formed sheet document", () => {
  const value = doc();
  assert.equal(validateExcelDocument(value), value);
});

test("rejects unknown top-level fields, bad row/col bounds, and an invalid cell reference", () => {
  assert.throws(() => validateExcelDocument({ ...doc(), extra: true }));
  assert.throws(() => validateExcelDocument(doc({ rows: 0 })));
  assert.throws(() => validateExcelDocument(doc({ cols: 27 })));
  assert.throws(() => validateExcelDocument(doc({ cells: { AAA1: cell() } })));
});

test("rejects an unsafe formula string but accepts a bounded, safe one", () => {
  assert.throws(() => validateExcelDocument(doc({ cells: { B4: cell({ formula: "=SYSTEM('rm -rf')" }) } })));
  const value = doc({ cells: { B4: cell({ value: 60, formula: "=SUM(B1:B3)" }) } });
  assert.equal(validateExcelDocument(value), value);
});

test("rejects an invalid color, number format, or alignment", () => {
  assert.throws(() => validateExcelDocument(doc({ cells: { A1: cell({ fillColor: "not-a-color" }) } })));
  assert.throws(() => validateExcelDocument(doc({ cells: { A1: cell({ numberFormat: "Scientific" }) } })));
  assert.throws(() => validateExcelDocument(doc({ cells: { A1: cell({ align: "justify" }) } })));
});

test("validateExcelOperations accepts known commands and rejects unrecognized ones", () => {
  const value = doc({ operations: ["bold", "sortAscending"] });
  assert.equal(validateExcelOperations(value), value);
  assert.throws(() => validateExcelOperations(doc({ operations: ["deleteEverything"] })));
});

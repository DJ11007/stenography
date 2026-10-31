import assert from "node:assert/strict";
import test from "node:test";
import { autoFillDownLastRow } from "../lib/excel-autofill.ts";

// Double-clicking the fill handle of I4 (Percentage) when H (Average) and J (Max) beside it are still empty: it
// fills down as far as the nearest column further left that has data (G, Total), instead of doing nothing.
const cell = (value) => ({ value, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: null, align: null });
const cells = {};
for (let row = 4; row <= 15; row++) { cells[`F${row}`] = cell(40 + row); cells[`G${row}`] = cell(200 + row); }
cells.I4 = { ...cell(0.498), formula: "=G4/500" };

test("the column right next to the selection is used first", () => {
  assert.equal(autoFillDownLastRow(cells, { r1: 4, c1: 7, r2: 4, c2: 7 }), 15, "H4 (next to G) fills to row 15");
});
test("with both neighbours empty, the nearest column further left that has data decides", () => {
  assert.equal(autoFillDownLastRow(cells, { r1: 4, c1: 8, r2: 4, c2: 8 }), 15, "I4 fills to row 15 from column G");
});
test("no data anywhere beside: nothing is filled", () => {
  assert.equal(autoFillDownLastRow({ A1: cell(1) }, { r1: 1, c1: 0, r2: 1, c2: 0 }), null);
});

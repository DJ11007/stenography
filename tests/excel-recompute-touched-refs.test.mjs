import assert from "node:assert/strict";
import test from "node:test";
import { recomputeFormulas, EMPTY_CELL } from "../lib/excel-sheet-model.ts";

// Performance fix: recomputeFormulas(cells, names, touchedRefs) only re-evaluates formulas that could actually be
// affected by the given touchedRefs (directly, or transitively through another formula cell), instead of every
// formula cell in the sheet. Every test here checks that the touched-refs path gives EXACTLY the same result as
// the full recompute (no touchedRefs) -- speed is worthless if it's wrong.

const cell = (value, extra = {}) => ({ ...EMPTY_CELL, value, ...extra });
const formula = (text, extra = {}) => ({ ...EMPTY_CELL, value: null, formula: text, ...extra });

test("typing a brand-new formula directly into a cell computes that cell's own value, not just its dependents' (regression: a student's SUM formula showed blank)", () => {
  const cells = { F2: cell(80), G2: cell(64), H2: cell(91), I2: cell(70), K2: formula("=SUM(F2:I2)", { value: null }) };
  const touched = recomputeFormulas(cells, undefined, ["K2"]);
  assert.equal(touched.K2.value, 305, "K2 is itself the touched ref -- its own formula must still be evaluated, not just cells that read K2");
  assert.deepEqual(touched, recomputeFormulas(cells));
});

test("a chain of formulas (F -> J -> K -> L) all update when only the root cell is touched", () => {
  const cells = { F2: cell(10), G2: cell(5), H2: cell(2), J2: formula("=SUM(F2:H2)"), K2: formula("=J2*2"), L2: formula("=IF(K2>=30,\"big\",\"small\")") };
  const full = recomputeFormulas(cells);
  assert.equal(full.J2.value, 17); assert.equal(full.K2.value, 34); assert.equal(full.L2.value, "big");
  const touched = recomputeFormulas(cells, undefined, ["F2"]);
  assert.deepEqual(touched, full);
});

test("a range-based formula (SUMPRODUCT) recomputes when a cell inside its range changes, even far from the edited row", () => {
  const cells = {};
  for (let r = 2; r <= 50; r++) { cells[`F${r}`] = cell(r); cells[`I${r}`] = cell(1); }
  cells.Y1 = formula("=SUMPRODUCT(F2:F50,I2:I50)");
  const full = recomputeFormulas(cells);
  const edited = { ...cells, F25: cell(999) };
  const touchedResult = recomputeFormulas(edited, undefined, ["F25"]);
  const fullResult = recomputeFormulas(edited);
  assert.deepEqual(touchedResult, fullResult);
  assert.notEqual(touchedResult.Y1.value, full.Y1.value);
});

test("a formula that does not read the touched cell at all is left untouched (same object, not just same value)", () => {
  const cells = { A1: cell(1), B1: formula("=A1*2"), Z1: cell(100), Z2: formula("=Z1*3") };
  const touched = recomputeFormulas(cells, undefined, ["A1"]);
  assert.equal(touched.Z2, cells.Z2, "an unrelated formula cell should be passed through unchanged, not recomputed");
});

test("HLOOKUP against a lookup table recomputes when the table itself (not the lookup column) is edited", () => {
  const cells = { D2: cell("Jaipur"), R1: cell("Jaipur"), S1: cell("Jodhpur"), R2: cell("Zone A"), S2: cell("Zone B"), P2: formula("=HLOOKUP(D2,$R$1:$S$2,2,FALSE)") };
  const full = recomputeFormulas(cells);
  assert.equal(full.P2.value, "Zone A");
  const edited = { ...cells, R2: cell("Zone X") };
  const touched = recomputeFormulas(edited, undefined, ["R2"]);
  const fullAfter = recomputeFormulas(edited);
  assert.deepEqual(touched, fullAfter);
  assert.equal(touched.P2.value, "Zone X");
});

test("a sheet containing NOW()/TODAY() anywhere falls back to a full recompute even when touchedRefs is given", () => {
  const cells = { A1: cell(1), B1: formula("=A1*2"), C1: formula("=TODAY()"), D1: formula("=YEAR(C1)") };
  const touched = recomputeFormulas(cells, undefined, ["A1"]);
  const full = recomputeFormulas(cells);
  assert.deepEqual(touched, full);
});

test("editing a middle cell in a chain only recomputes what depends on it, not what it depends on", () => {
  const cells = { A1: cell(2), B1: formula("=A1+1"), C1: formula("=B1+1"), D1: cell(1000) };
  const touched = recomputeFormulas(cells, undefined, ["B1"]);
  assert.equal(touched.A1, cells.A1, "A1 does not depend on B1 and must be passed through unchanged");
  assert.equal(touched.C1.value, 4);
});

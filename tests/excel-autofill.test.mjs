import assert from "node:assert/strict";
import test from "node:test";
import { autoFill, autoFillDownLastRow, fillDirectionFor, fillExtension } from "../lib/excel-autofill.ts";
import { EMPTY_CELL, MAX_ROWS } from "../lib/excel-sheet-model.ts";

// The Excel fill handle (drag the corner of the selection, or double-click it): AutoFill as Excel does it.

const cell = (value, extra = {}) => ({ ...EMPTY_CELL, value, ...extra });
const formula = (text, extra = {}) => ({ ...EMPTY_CELL, value: 0, formula: text, ...extra });
const rect = (r1, c1, r2, c2) => ({ r1, c1, r2, c2 });
const values = (cells, refs) => refs.map((ref) => cells[ref]?.value ?? null);

test("a formula filled down moves its relative references, not the absolute ones", () => {
  const cells = { C2: formula("=A2*B2"), D2: formula("=A2*$F$1+SUM(A$2:B2)") };
  const out = autoFill(cells, rect(2, 2, 2, 3), "down", 3);
  assert.deepEqual(["C3", "C4", "C5"].map((ref) => out[ref].formula), ["=A3*B3", "=A4*B4", "=A5*B5"]);
  assert.deepEqual(["D3", "D5"].map((ref) => out[ref].formula), ["=A3*$F$1+SUM(A$2:B3)", "=A5*$F$1+SUM(A$2:B5)"]);
  assert.equal(out.C6, undefined, "only the cells asked for");
});

test("a formula filled right moves its columns", () => {
  const out = autoFill({ B1: formula("=B2+1") }, rect(1, 1, 1, 1), "right", 2);
  assert.deepEqual(["C1", "D1"].map((ref) => out[ref].formula), ["=C2+1", "=D2+1"]);
});

test("two or more numbers continue as a series; one number is copied", () => {
  assert.deepEqual(values(autoFill({ A1: cell(1), A2: cell(2) }, rect(1, 0, 2, 0), "down", 3), ["A3", "A4", "A5"]), [3, 4, 5]);
  assert.deepEqual(values(autoFill({ A1: cell(10), A2: cell(20), A3: cell(30) }, rect(1, 0, 3, 0), "down", 2), ["A4", "A5"]), [40, 50]);
  assert.deepEqual(values(autoFill({ A1: cell(5), A2: cell(7) }, rect(1, 0, 2, 0), "up", 2), []), []);
  assert.deepEqual(values(autoFill({ A3: cell(5), A4: cell(7) }, rect(3, 0, 4, 0), "up", 2), ["A2", "A1"]), [3, 1], "upward counts back");
  assert.deepEqual(values(autoFill({ A1: cell(0.1), A2: cell(0.2) }, rect(1, 0, 2, 0), "down", 1), ["A3"]), [0.3], "no floating-point tail");
  assert.deepEqual(values(autoFill({ A1: cell(7) }, rect(1, 0, 1, 0), "down", 3), ["A2", "A3", "A4"]), [7, 7, 7]);
});

test("text with a number at the end counts on, keeping leading zeros", () => {
  assert.deepEqual(values(autoFill({ A1: cell("Item 1") }, rect(1, 0, 1, 0), "down", 2), ["A2", "A3"]), ["Item 2", "Item 3"]);
  assert.deepEqual(values(autoFill({ A1: cell("Q1"), A2: cell("Q3") }, rect(1, 0, 2, 0), "down", 2), ["A3", "A4"]), ["Q5", "Q7"]);
  assert.deepEqual(values(autoFill({ A1: cell("001") }, rect(1, 0, 1, 0), "down", 2), ["A2", "A3"]), ["002", "003"]);
});

test("day and month names go on and start again, in the case they were typed", () => {
  assert.deepEqual(values(autoFill({ A1: cell("Mon") }, rect(1, 0, 1, 0), "down", 2), ["A2", "A3"]), ["Tue", "Wed"]);
  assert.deepEqual(values(autoFill({ A1: cell("Friday") }, rect(1, 0, 1, 0), "down", 3), ["A2", "A3", "A4"]), ["Saturday", "Sunday", "Monday"]);
  assert.deepEqual(values(autoFill({ A1: cell("jan") }, rect(1, 0, 1, 0), "down", 1), ["A2"]), ["feb"]);
  assert.deepEqual(values(autoFill({ A1: cell("JANUARY") }, rect(1, 0, 1, 0), "down", 1), ["A2"]), ["FEBRUARY"]);
  assert.deepEqual(values(autoFill({ A1: cell("December") }, rect(1, 0, 1, 0), "down", 1), ["A2"]), ["January"]);
  assert.deepEqual(values(autoFill({ A1: cell("Mon"), A2: cell("Wed") }, rect(1, 0, 2, 0), "down", 2), ["A3", "A4"]), ["Fri", "Sun"], "every second day");
});

test("anything else repeats in order, with the formatting of the cells it repeats", () => {
  const cells = { A1: cell("North", { bold: true }), A2: cell("South", { fillColor: "FFFF00" }) };
  const out = autoFill(cells, rect(1, 0, 2, 0), "down", 3);
  assert.deepEqual(values(out, ["A3", "A4", "A5"]), ["North", "South", "North"]);
  assert.equal(out.A3.bold, true);
  assert.equal(out.A4.fillColor, "FFFF00");
  assert.equal(out.A3.formula, null);
});

test("each column of a wider selection is filled on its own", () => {
  const cells = { A1: cell(1), A2: cell(2), B1: cell("x"), B2: cell("y"), C1: cell(10), C2: formula("=A2+1") };
  const out = autoFill(cells, rect(1, 0, 2, 1), "down", 2);
  assert.deepEqual(values(out, ["A3", "A4", "B3", "B4"]), [3, 4, "x", "y"]);
  assert.equal(autoFill({ A1: cell(1), B1: cell(2) }, rect(1, 0, 1, 1), "right", 2).D1.value, 4);
});

test("a formula mixed with plain cells is copied cell by cell, never turned into a series", () => {
  const out = autoFill({ A1: cell(1), A2: formula("=A1+1") }, rect(1, 0, 2, 0), "down", 2);
  assert.equal(out.A3.value, 1);
  assert.equal(out.A4.formula, "=A3+1");
});

test("the way a drag goes, and what it adds", () => {
  const selection = rect(2, 1, 2, 1);
  assert.equal(fillDirectionFor(selection, { row: 9, col: 1 }), "down");
  assert.equal(fillDirectionFor(selection, { row: 2, col: 4 }), "right");
  assert.equal(fillDirectionFor(selection, { row: 1, col: 1 }), "up");
  assert.equal(fillDirectionFor(selection, { row: 5, col: 2 }), "down", "the longer way wins");
  assert.equal(fillDirectionFor(selection, { row: 2, col: 1 }), null, "inside the selection nothing is filled");
  assert.deepEqual(fillExtension(selection, "down", 3), rect(3, 1, 5, 1));
  assert.deepEqual(fillExtension(selection, "left", 1), rect(2, 0, 2, 0));
  assert.equal(fillExtension(rect(1, 0, 1, 0), "up", 3), null, "no row above row 1");
  assert.equal(fillExtension(rect(MAX_ROWS, 0, MAX_ROWS, 0), "down", 3), null);
});

test("double-clicking the handle fills down as far as the data next to it goes", () => {
  const cells = { A1: cell("Name"), A2: cell("Rajnish"), A3: cell("Ajay"), A4: cell("Vijay"), A5: cell("Ravi"), B1: cell("Total"), B2: formula("=1") };
  assert.equal(autoFillDownLastRow(cells, rect(2, 1, 2, 1)), 5, "the column on the left has data to row 5");
  assert.equal(autoFillDownLastRow({ ...cells, A4: cell(null) }, rect(2, 1, 2, 1)), 3, "it stops at the first empty cell");
  assert.equal(autoFillDownLastRow({ B2: formula("=1") }, rect(2, 1, 2, 1)), null, "nothing beside it");
  assert.equal(autoFillDownLastRow({ B2: cell(1), C2: cell(1), C3: cell(1), C4: cell(1) }, rect(2, 1, 2, 1)), 4, "or the column on the right");
});

test("the sheet shows the fill handle on the selection's corner, drags it with a preview, and records one undo step", async () => {
  const { readFile } = await import("node:fs/promises");
  const editor = await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /from "@\/lib\/excel-autofill"/);
  assert.match(editor, /data-fill-handle/);
  assert.match(editor, /onMouseDown=\{\(event\) => \{ event\.stopPropagation\(\); event\.preventDefault\(\); focusGrid\(\); setFillDrag\(/);
  assert.match(editor, /autoFillDownLastRow\(cells, selection\)/);
  assert.match(editor, /change\("autoFill", \{ cells: autoFill\(cells, source, direction, count\) \}\)/);
  assert.match(editor, /fillPreview && rectContains\(fillPreview, row, col\)/);
  assert.match(editor, /!submitted && !isEditing/, "no handle once submitted or while typing in the cell");
  const document = await readFile(new URL("../lib/excel-document.ts", import.meta.url), "utf8");
  assert.match(document, /"fillRight", "autoFill"/, "the recorded command is one the sheet accepts");
});

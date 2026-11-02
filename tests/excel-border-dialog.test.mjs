import assert from "node:assert/strict";
import test from "node:test";
import { applyBorder, applyBorderLines, borderCss, borderDiagonals, readBorderLines } from "../lib/excel-sheet-model.ts";

const rect = { r1: 1, c1: 0, r2: 2, c2: 1 };
const borders = (cells) => Object.fromEntries(Object.entries(cells).map(([ref, cell]) => [ref, cell.border]));
const thin = { style: "thin", color: null };

test("the menu's borders save exactly what they always did, so marking rules written for them still match", () => {
  assert.deepEqual(borders(applyBorder({}, rect, "thickBox")), { A1: "TL", B1: "TR", A2: "BL", B2: "RB" });
  assert.deepEqual(borders(applyBorder({}, rect, "topDoubleBottom")), { A1: "t", B1: "t", A2: "b=", B2: "b=" });
  assert.deepEqual(borderCss("tb="), { borderTop: "1px solid #000", borderBottom: "3px double #000" });
  assert.deepEqual(borderCss("TL"), { borderTop: "2px solid #000", borderLeft: "2px solid #000" });
});

test("Format Cells Outline + Inside in thin black is the same as All Borders", () => {
  const lines = { top: thin, bottom: thin, left: thin, right: thin, insideH: thin, insideV: thin };
  assert.deepEqual(applyBorderLines({}, rect, lines), applyBorder({}, rect, "all"));
});

test("line styles, colours and diagonals are kept, read back, and drawn", () => {
  const cells = applyBorderLines({}, rect, { top: { style: "dashed", color: "FF0000" }, insideH: thin, diagUp: { style: "thick", color: null } });
  assert.deepEqual(borders(cells), { A1: "t-@FF0000bu!", B1: "t-@FF0000bu!", A2: "tu!", B2: "tu!" });
  const read = readBorderLines(cells, rect);
  assert.deepEqual(read.top, { style: "dashed", color: "FF0000" });
  assert.deepEqual(read.insideH, thin);
  assert.equal(read.bottom, null);
  assert.equal(borderCss(cells.A1.border).borderTop, "1px dashed #FF0000");
  assert.equal(borderDiagonals(cells.A1.border).length, 1);
});

test("only the lines given change; a line that differs across the selection is left out when read", () => {
  const start = applyBorder({}, rect, "all");
  const cells = applyBorderLines(start, rect, { top: null });
  assert.equal(cells.A1.border, "rbl");
  assert.equal(cells.A2.border, start.A2.border);
  const mixed = applyBorderLines({}, { r1: 1, c1: 0, r2: 1, c2: 0 }, { top: thin });
  assert.equal("top" in readBorderLines(mixed, rect), false);
});

test("a saved border never passes 50 characters: the colours give way first", () => {
  const red = (style) => ({ style, color: "FF0000" });
  const cells = applyBorderLines({}, { r1: 1, c1: 0, r2: 1, c2: 0 }, { top: red("dashed"), bottom: red("dotted"), left: red("hair"), right: red("dashDot"), diagUp: red("thin"), diagDown: red("medium") });
  assert.ok(cells.A1.border.length <= 50);
});

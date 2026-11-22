import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataEdge, lastUsedCell, nextInRange } from "../lib/excel-sheet-model.ts";

const editor = readFileSync(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8");
const cell = (value) => ({ value, formula: null, bold: false, italic: false, underline: false, fontColor: null, fillColor: null, border: null, numberFormat: "General", align: null });
// A1:A4 filled, A5:A6 empty, A7:A8 filled; B1 bold but empty (counts for Ctrl+End, not for Ctrl+Arrow).
const cells = { A1: cell("Name"), A2: cell(1), A3: cell(2), A4: cell(3), A7: cell(4), A8: cell(5), B10: { ...cell(null), bold: true } };

test("Ctrl+Arrow jumps as Excel does: end of the block, next filled cell, or the sheet's edge", () => {
  assert.deepEqual(dataEdge(cells, 1, 0, 1, 0), { row: 4, col: 0 });   // inside a block: its last cell
  assert.deepEqual(dataEdge(cells, 4, 0, 1, 0), { row: 7, col: 0 });   // at a block's end: the next filled cell
  assert.deepEqual(dataEdge(cells, 8, 0, 1, 0), { row: 500, col: 0 }); // nothing below: the last row
  assert.deepEqual(dataEdge(cells, 7, 0, -1, 0), { row: 4, col: 0 });
  assert.deepEqual(dataEdge(cells, 1, 0, -1, 0), { row: 1, col: 0 });  // already at the edge
  assert.deepEqual(dataEdge(cells, 1, 0, 0, 1, 500, 25), { row: 1, col: 25 });
});

test("Ctrl+End: the last used row and column, formatting included", () => {
  assert.deepEqual(lastUsedCell(cells), { row: 10, col: 1 });
  assert.deepEqual(lastUsedCell({}), { row: 1, col: 0 });
});

test("Enter / Tab inside a selection walk its cells and wrap", () => {
  const rect = { r1: 1, c1: 0, r2: 2, c2: 1 }; // A1:B2
  assert.deepEqual(nextInRange(rect, { row: 1, col: 0 }, false, false), { row: 2, col: 0 }); // Enter: down
  assert.deepEqual(nextInRange(rect, { row: 2, col: 0 }, false, false), { row: 1, col: 1 }); // then next column
  assert.deepEqual(nextInRange(rect, { row: 2, col: 1 }, false, false), { row: 1, col: 0 }); // back to the start
  assert.deepEqual(nextInRange(rect, { row: 1, col: 0 }, true, false), { row: 1, col: 1 });  // Tab: right
  assert.deepEqual(nextInRange(rect, { row: 1, col: 0 }, true, true), { row: 2, col: 1 });   // Shift+Tab wraps back
});

test("the sheet has Excel's selection keys", () => {
  for (const pattern of [
    /if \(ctrl \|\| endMode\) \{ setEndMode\(false\); const from = extend \? focus : cursor; const at = dataEdge\(/, // Ctrl+(Shift+)Arrow, End+Arrow
    /key === "F8" && !event\.shiftKey/,                       // Extend Selection
    /else selectKeepingCursor\(\{ r1: selection\.r1, c1: 0, r2: selection\.r2, c2: displayCols - 1 \}\)/, // Shift+Space
    /else if \(ctrl\) selectKeepingCursor\(\{ r1: 1, c1: selection\.c1, r2: displayRows, c2: selection\.c2 \}\)/, // Ctrl+Space
    /else if \(k === "a"\) selectAllStep\(\)/,               // Ctrl+A: region, then sheet
    /key === "Backspace" && event\.shiftKey && !ctrl/,       // Shift+Backspace
    /if \(ctrl && key === "\."\)/,                            // Ctrl+.
    /key === "End" && ctrl/, /key === "PageDown" \|\| key === "PageUp"/, /key === "Home"/,
    /if \(!moveInSelection\(false, event\.shiftKey\)\) moveBy/, // Enter inside a selection
    /commitEdit\(event\.ctrlKey \|\| event\.metaKey \? "fill" : event\.shiftKey \? "up" : "down"\)/, // Ctrl+Enter, Shift+Enter
    /onMouseEnter=\{\(\) => \{ if \(headerDrag\.current === "col"\)/, // drag over column letters
    /onMouseEnter=\{\(\) => \{ if \(headerDrag\.current === "row"\)/, // drag over row numbers
  ]) assert.match(editor, pattern);
  // The active cell is its own state (typing goes there), not the moving end of the selection.
  assert.match(editor, /const activeRef = refAt\(cursor\.row, cursor\.col\);/);
  // Ctrl+Enter's fill is not undone by the editor's blur committing the one cell again.
  assert.match(editor, /cancelled\.current = true; setEditing\(null\); focusGrid\(\); cancelled\.current = false;\r?\n\s+return;/);
});

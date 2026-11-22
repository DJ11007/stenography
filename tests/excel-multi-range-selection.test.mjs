import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8");

// 22 Nov 2026: Ctrl+click / Ctrl+drag (and Shift+F8, Add to Selection) select several ranges, as in Excel 2013.
test("Ctrl+click, Ctrl+drag, Ctrl+click on column letters / row numbers and Shift+F8 add a range", () => {
  assert.match(editor, /if \(\(event\.ctrlKey \|\| event\.metaKey \|\| addMode\) && !event\.shiftKey && event\.button === 0\) \{ addArea\(\{ row, col \}\); return; \}/);
  assert.match(editor, /addArea\(\{ row: 1, col \}, \{ row: displayRows, col \}\)/);
  assert.match(editor, /addArea\(\{ row, col: 0 \}, \{ row, col: displayCols - 1 \}\)/);
  assert.match(editor, /key === "F8" && event\.shiftKey && !ctrl\) \{ event\.preventDefault\(\); setAddMode/);
  assert.match(editor, /<span>Add to Selection<\/span>/);
  // A plain new selection drops the added ranges.
  assert.match(editor, /if \(!addingArea\.current\) setExtraAreas/);
});

test("formatting, borders, Format Cells, Clear, Merge, Ctrl+Enter, sizes and Hide act on every range", () => {
  assert.match(editor, /for \(const ref of rect \? rectRefs\(rect\) : areaRefs\(\)\) next\[ref\]/);
  assert.match(editor, /const clearContents = \(\) => \{ const refs = areaRefs\(\)/);
  assert.match(editor, /cells: areas\.reduce\(\(next, rect\) => applyBorder\(next, rect, style\), cells\)/);
  assert.match(editor, /for \(const rect of areas\) \{\r?\n\s+for \(const ref of rectRefs\(rect\)\) next\[ref\] = \{ \.\.\.cellOf\(next, ref\), \.\.\.result\.patch \};/);
  assert.match(editor, /const ranges = areas\.filter\(\(rect\) => rect\.r1 !== rect\.r2 \|\| rect\.c1 !== rect\.c2\);/);
  assert.match(editor, /for \(const ref of areaRefs\(\)\) \{/); // Ctrl+Enter
  assert.ok((editor.match(/for \(const row of selectedRows\(\)\)/g) ?? []).length >= 3);
  assert.ok((editor.match(/for \(const col of selectedCols\(\)\)/g) ?? []).length >= 3);
});

test("Copy, Paste, Sort, Filter, Fill, Insert / Delete refuse with Excel's message", () => {
  assert.match(editor, /This action won't work on multiple selections\./);
  assert.match(editor, /setNotice\("This command cannot be used on multiple selections\."\)/);
  for (const head of ["const paste = () => {", "const sortRows = (", "const toggleFilter = () => {", "const fillRange = (", "const shiftCells = (", "const fillSeries = (", "const textToColumns = ("]) {
    const at = editor.indexOf(head);
    assert.ok(at >= 0 && editor.slice(at, at + 200).includes("if (!singleArea()) return;"), head);
  }
});

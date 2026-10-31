import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// As in Excel: AutoSum (Sum / Average / Count Numbers / Max / Min) puts the formula in the cell in edit mode with
// its guessed range selected (=SUM(B4:F4)) instead of applying it; Enter applies it. While a formula is typed,
// clicking / dragging cells puts their reference in (point mode), the references are outlined, and Enter closes
// brackets left open.
const read = async () => (await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("AutoSum opens the formula for editing with its range selected, it does not apply it", async () => {
  const source = await read();
  assert.match(source, /pendingEditSelection\.current = range \? \[inside, inside \+ range\.length\] : \[inside, inside\];/);
  assert.match(source, /beginEdit\(range \? `=\$\{fn\}\(\$\{range\}\)` : `=\$\{fn\}\(\)`\);/);
  assert.doesNotMatch(source, /change\(`formula:\$\{fn\}`, \{ cells: \{ \.\.\.cells, \[activeCellRef\]: \{ \.\.\.active, \.\.\.parseEntry\(formula\) \} \} \}\);/);
});

test("clicking or dragging cells while a formula is typed puts their reference in", async () => {
  const source = await read();
  assert.match(source, /const at = pointTarget\(\);\n\s+if \(at\) \{ event\.preventDefault\(\); pointing\.current = \{ row, col \}; putReference\(\{ row, col \}, \{ row, col \}, at\); return; \}/);
  assert.match(source, /if \(pointing\.current && lastPointed\.current\) \{ putReference\(pointing\.current, \{ row, col \}, \[lastPointed\.current\.start, lastPointed\.current\.end\]\); return; \}/);
  assert.ok(source.includes(String.raw`return /[=(,+\-*/^&<>:;]\s*$/.test(text.slice(0, start)) ? [start, start] : null;`), "a reference may go after = ( , or an operator");
  assert.match(source, /<FormulaReferences store=\{editText\} live=\{Boolean\(editing\)\} tableRef=\{tableRef\} \/>/);
  assert.match(source, /const text = closeBrackets\(editText\.get\(\)\);/);
});

test("clicking into the Name Box selects its text even after the browser places the caret", async () => {
  const source = await read();
  assert.match(source, /event\.preventDefault\(\); event\.currentTarget\.select\(\); delete event\.currentTarget\.dataset\.selectAll;/);
});

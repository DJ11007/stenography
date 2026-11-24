import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorSource = () => readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");

// Real reported problem: when a document grows past the first page, a table or a paragraph could end up outside the
// margins (the bottom margin, the grey gap and the next sheet's top margin). Found by laying out hundreds of random
// documents (paragraphs, lists, tables, 10-36 pt text, line spacing) and measuring every line against each sheet's margins.
// The page flow is display-only (paginatePages), so the pins below are on its source; the layout itself is checked in the browser.

test("a table whose first row does not fit at the bottom of a sheet starts the next sheet, so a table taller than a page is split from its top", async () => {
  const source = await editorSource();
  const loop = source.slice(source.indexOf("for (const block of blocks) {"), source.indexOf("const last = blocks.at(-1);"));
  assert.match(loop, /const firstRow = \(block as HTMLTableElement\)\.rows\[0\]/);
  assert.match(loop, /if \(rowBottom > sheet \* step \+ bodyBottom \+ 0\.5 && rowBottom - rowTop <= usable\) moveTo\(block, \(tableRect\.top - top\(\)\) \/ zoom, \(sheet \+ 1\) \* step \+ bodyTop\);/);
  assert.ok(loop.indexOf("const firstRow") < loop.indexOf("paginateTableRows(block as HTMLTableElement"), "the table is moved before its rows are split");
});

test("a paragraph taller than a sheet that starts near the bottom of one starts the next sheet and is split from there", async () => {
  const source = await editorSource();
  const loop = source.slice(source.indexOf("for (const block of blocks) {"), source.indexOf("const last = blocks.at(-1);"));
  assert.match(loop, /const splittable = block\.tagName === "P" \|\| block\.tagName === "LI";/);
  assert.match(loop, /if \(blockBottom - blockTop > usable\) \{[\s\S]*?if \(splittable && blockTop > sheetTextTop \+ 0\.5\) \{ moveTo\(block, blockTop, \(sheet \+ 1\) \* step \+ bodyTop\); splitBetweenSheets\(block, \{ top, zoom, step, bodyTop, bodyBottom \}\); \}[\s\S]*?continue;/);
});

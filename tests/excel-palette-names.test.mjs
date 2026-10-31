import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Excel's Font Color / Fill Color palettes show each swatch's name as Excel 2013 (and the Word workspace) does,
// in Office 2013's order, with Excel's own colour values kept so saved sheets and marking rules still match.
test("Excel theme swatches are named like Word's, in Office 2013 order, with the same colour values as before", async () => {
  const source = (await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(source, /import \{ THEME_GRID \} from "@\/lib\/word-colors";/);
  assert.match(source, /\["FFFFFF", "000000", "E7E6E6", "44546A", "5B9BD5", "ED7D31", "A5A5A5", "FFC000", "4472C4", "70AD47"\]/);
  assert.match(source, /THEME_HEX\.map\(\(row, r\) => row\.map\(\(hex, c\) => \(\{ hex, name: THEME_GRID\[r\]\[c\]\.name \}\)\)\)/);
  assert.match(source, /aria-label=\{`\$\{name\} \(#\$\{hex\}\)`\} title=\{name\}/);
  const hexes = [...source.matchAll(/^  \[("[0-9A-F]{6}"(, )?){10}\],?$/gm)].map((m) => m[0]).join("").match(/[0-9A-F]{6}/g);
  assert.equal(new Set(hexes).size >= 59, true);
});

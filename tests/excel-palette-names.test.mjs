import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Excel's Font Color / Fill Color palettes show each swatch's name as Excel 2013 (and the Word workspace) does,
// in Office 2013's order, with Excel's own colour values kept so saved sheets and marking rules still match.
test("Excel theme swatches are named like Word's, in Office 2013 order, with the same colour values as before", async () => {
  const source = (await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/rich-sheet-editor.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  // The palette lives in excel-colors.ts, shared by the ribbon and the Format Cells Border tab.
  const palette = (await readFile(new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/excel-colors.ts", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  assert.match(source, /import \{ STANDARD_COLORS, THEME_COLORS \} from "\.\/excel-colors";/);
  assert.match(palette, /import \{ THEME_GRID \} from "@\/lib\/word-colors";/);
  assert.match(palette, /\["FFFFFF", "000000", "E7E6E6", "44546A", "5B9BD5", "ED7D31", "A5A5A5", "FFC000", "4472C4", "70AD47"\]/);
  assert.match(palette, /const named = row\.map\(\(hex, c\) => \(\{ hex, name: THEME_GRID\[r\]\[c\]\.name \}\)\);/);
  // the admin's extra column, Red, Accent 2 with its tints and shades, comes right after Blue, Accent 1
  const { THEME_COLORS } = await import("../app/typing/excel-efficiency/[language]/[testId]/workspace/excel-colors.ts").catch(() => ({ THEME_COLORS: null }));
  assert.match(palette, /return \[\.\.\.named\.slice\(0, 5\), RED_ACCENT\[r\], \.\.\.named\.slice\(5\)\];/);
  assert.match(palette, /\{ hex: "C0504D", name: "Red, Accent 2" \}/);
  if (THEME_COLORS) assert.deepEqual(THEME_COLORS.map((row) => row[5].name), ["Red, Accent 2", "Red, Accent 2, Lighter 80%", "Red, Accent 2, Lighter 60%", "Red, Accent 2, Lighter 40%", "Red, Accent 2, Darker 25%", "Red, Accent 2, Darker 50%"]);
  assert.match(source, /aria-label=\{`\$\{name\} \(#\$\{hex\}\)`\} title=\{name\}/);
  // The shade rows keep Excel's values (e.g. DEEBF6 under Blue, Accent 1), not Word's computed ones (DEEBF7).
  assert.match(palette, /\["F2F2F2", "7F7F7F", "D0CECE", "D6DCE4", "DEEBF6", "FBE5D5", "EDEDED", "FFF2CC", "D9E2F3", "E2EFD9"\]/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dir = new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/", import.meta.url);
const editor = readFileSync(new URL("rich-sheet-editor.tsx", dir), "utf8");
const view = readFileSync(new URL("excel-header-footer-view.tsx", dir), "utf8");

// 22 Nov 2026: Insert > Header & Footer works as in Excel 2013 -- the sheet turns to Page Layout view with three
// header boxes typed on the page, and the HEADER & FOOTER TOOLS > DESIGN tab -- instead of a dialog box.
test("Insert > Header & Footer opens the header on the page, not a dialog", () => {
  assert.match(editor, /label="Header & Footer" icon=\{<Icon name="headerFooter" big \/>\} onClick=\{\(\) => openHeaderFooter\("header"\)\}/);
  assert.match(editor, /HEADER &amp; FOOTER TOOLS/);
  assert.match(editor, /tab === "DESIGN" && hfTarget/);
  for (const label of ["Go to Header", "Go to Footer", "Different First Page", "Different Odd & Even Pages", "Scale with Document", "Align with Page Margins", "Picture", "Format Picture"]) assert.ok(editor.includes(`"${label}"`), label);
});

test("the DESIGN tab's elements insert Excel's codes", () => {
  for (const [code, label] of [["&[Page]", "Page Number"], ["&[Pages]", "Number of Pages"], ["&[Date]", "Current Date"], ["&[Time]", "Current Time"], ["&[Path]&[File]", "File Path"], ["&[File]", "File Name"], ["&[Tab]", "Sheet Name"]]) {
    assert.ok(view.includes(`{ code: "${code}", label: "${label}"`), label);
  }
  assert.ok(view.includes(`{ label: "Page 1 of ?", value: { center: "Page &[Page] of &[Pages]" } }`));
});

test("the boxes save to sheet.header / sheet.footer as the dialog did, so marking is unchanged", () => {
  assert.match(editor, /change\(usedPage \? "pageNumber" : "header", \{ sheet: \{ \.\.\.sheet, header, footer \} \}\); record\("header"\);/);
  assert.match(editor, /onCommit=\{\(\) => saveHeaderFooter\(hfValues\.header, hfValues\.footer\)\}/);
  // Clicking a cell leaves the header and the DESIGN tab goes.
  assert.match(editor, /onMouseDown=\{\(\) => \{ if \(hfTarget\) leaveHeaderFooter\(\);/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { borderOnSheet, formatPageBorder, pageBorderApply, parsePageBorder } from "../lib/word-page-border.ts";
import { pageBorderSides, wordTargetValue } from "../lib/word-document-diff.ts";

const editor = readFileSync(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");
const dialogs = readFileSync(new URL("../components/word-efficiency/word-2013-dialogs.tsx", import.meta.url), "utf8");

// 22 Nov 2026: Borders and Shading > Page Border > Apply to, as in Word 2013: Whole document, This section,
// This section - First page only, This section - All except first page.
test("Apply to is saved before the sides and read back", () => {
  const cases = [
    [{ section: null, part: "all" }, "1px solid #000000 measure:text sides:top,bottom", "whole"],
    [{ section: 1, part: "first" }, "1px solid #000000 measure:text apply:s1-first sides:top,bottom", "s1-first"],
    [{ section: 2, part: "all" }, "1px solid #000000 measure:text apply:s2 sides:top,bottom", "s2"],
    [{ section: 1, part: "rest" }, "1px solid #000000 measure:text apply:s1-rest sides:top,bottom", "s1-rest"],
  ];
  for (const [apply, saved, value] of cases) {
    const text = formatPageBorder("1px solid #000000", ["top", "bottom"], { measure: "text" }, apply);
    assert.equal(text, saved);
    const parsed = parsePageBorder(text);
    assert.equal(parsed.css, "1px solid #000000");
    assert.deepEqual(parsed.apply, apply);
    assert.equal(pageBorderApply(text), value);
    assert.equal(pageBorderSides(text), "bottom,top"); // sides stay last, so the server's sides check is unchanged
  }
  // A border saved before Apply to existed is the whole document; no border has no Apply to.
  assert.equal(pageBorderApply("2px double #0070C0"), "whole");
  assert.equal(pageBorderApply(""), null);
  assert.equal(wordTargetValue({ pageLayout: { border: "1px solid #000000 apply:s2" } }, "pageLayout.borderApply"), "s2");
});

test("which sheets get the border", () => {
  const whole = { section: null, part: "all" }, s1first = { section: 1, part: "first" }, s1rest = { section: 1, part: "rest" }, s2 = { section: 2, part: "all" };
  // sheet: [section, first page of its section]
  const sheets = [[1, true], [1, false], [2, true], [2, false]];
  assert.deepEqual(sheets.map(([s, f]) => borderOnSheet(whole, s, f)), [true, true, true, true]);
  assert.deepEqual(sheets.map(([s, f]) => borderOnSheet(s1first, s, f)), [true, false, false, false]);
  assert.deepEqual(sheets.map(([s, f]) => borderOnSheet(s1rest, s, f)), [false, true, false, false]);
  assert.deepEqual(sheets.map(([s, f]) => borderOnSheet(s2, s, f)), [false, false, true, true]);
});

test("the dialog offers Word's four choices and the editor uses the cursor's section", () => {
  for (const option of ["Whole document", "This section", "This section - First page only", "This section - All except first page"]) assert.ok(dialogs.includes(`>${option}</option>`), option);
  assert.match(editor, /borderSection\.current=sectionOfBlock\(currentBlock\(\)\)/);
  assert.match(editor, /formatPageBorder\(css,sides,values\.pageOptions,apply\)/);
  assert.match(editor, /if \(!borderOnSheet\(apply, section, sectionStarts\.includes\(sheet\)\)\) continue;/);
});

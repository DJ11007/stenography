import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Word Model Answer page gives the admin every tool, not the test's student tool list", async () => {
  const editor = await read("app/admin/word-efficiency-tests/[testId]/model-answer/model-answer-editor.tsx");
  assert.match(editor, /capabilities=\{null\}/);
  assert.doesNotMatch(editor, /capabilities=\{capabilities\}/);
  const page = await read("app/admin/word-efficiency-tests/[testId]/model-answer/page.tsx");
  assert.doesNotMatch(page, /editor_capabilities/);
});

test("inside a header or footer the ruler shows the centre and right tab stops", async () => {
  const ruler = await read("components/word-efficiency/word-window-chrome.tsx");
  assert.match(ruler, /tabStops = false/);
  assert.match(ruler, /Centre tab stop/);
  assert.match(ruler, /Right tab stop/);
  assert.match(ruler, /marginLeft \+ textWidth \/ 2/);
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /tabStops=\{Boolean\(insideHeaderFooter\)\}/);
  const css = await read("app/globals.css");
  assert.match(css, /\.word-ruler-tabstop path/);
});

test("a page border is placed by Word's Page Border > Options: Measure from, per-side distances, and it follows the margins when measured from the text", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  const draw = editor.slice(editor.indexOf("function drawSheetBorders"), editor.indexOf("// Words only underline, as in Word"));
  assert.match(draw, /parsePageBorder\(pageBorderText\(page\)\)\?\.options \?\? defaultBorderOptions\("page"\)/);
  assert.match(draw, /pageBorderRect\(options, \{ pageWidth, sheetHeight, marginTop, marginRight, marginBottom, marginLeft,/);
  for (const side of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) assert.match(draw, new RegExp(`px\\(computed\\.${side}\\)`));
  assert.doesNotMatch(draw, /inset = 32|const gap = 4/);
  // what the dialog saves and what a loaded border is read from
  assert.match(editor, /formatPageBorder\(css,sides,values\.pageOptions\)/);
  assert.match(editor, /pageOptions:parsedBorder\?\.options\?\?defaultBorderOptions\("page"\)/);
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /function PageBorderOptionsDialog2013/);
  assert.match(dialogs, /title="Border and Shading Options"/);
  assert.match(dialogs, /<option value="page">Edge of page<\/option><option value="text">Text<\/option>/);
  assert.match(dialogs, /Surround <u>h<\/u>eader/);
  assert.match(dialogs, /Surround <u>f<\/u>ooter/);
  assert.match(dialogs, /setPageOptionsOpen\(true\)/);
  assert.doesNotMatch(dialogs, /distance from the text is fixed in this exam editor/);
});

test("the vertical ruler shows every page: top and bottom margin grey, the numbers starting again on each page, the gap between pages left empty", async () => {
  const ruler = await read("components/word-efficiency/word-window-chrome.tsx");
  const body = ruler.slice(ruler.indexOf("export function WordVerticalRuler"));
  assert.match(body, /sheets = 1, sheetHeight, step/);
  assert.match(body, /for \(let sheet = 0; sheet < count; sheet\+\+\)/);
  assert.match(body, /const origin = sheet \* pitch;/);
  assert.match(body, /y=\{origin\} width=\{14\} height=\{pageHeight\} className="word-ruler-margin"/);
  assert.match(body, /y=\{origin \+ marginTop\}/);
  assert.match(body, /const local = marginTop \+ k \* eighth, y = origin \+ local;/);
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /<WordVerticalRuler height=\{metrics\.height\} marginTop=\{metrics\.marginTop\} marginBottom=\{metrics\.marginBottom\} sheets=\{metrics\.sheets\} sheetHeight=\{metrics\.sheetHeight\} step=\{metrics\.step\}\/>/);
  assert.match(editor, /sheets=Math\.max\(1,Number\(el\.dataset\.pageCount\)\|\|1\)/);
});

test("a table row moved to the next page lets the page's own white and grey show through, so no light line is left along the gap", async () => {
  const css = await read("app/globals.css");
  const rule = css.slice(css.indexOf("tr[data-page-push] > td, .word-document-page tr[data-page-push] > th {"), css.indexOf("/* The paper (white, the grey gap, white) behind a moved row"));
  assert.match(rule, /var\(--page-paper-fill, transparent\) 0 var\(--page-push-white\), var\(--page-gap-fill, transparent\) var\(--page-push-white\) var\(--page-push-gap\), var\(--page-paper-fill, transparent\) var\(--page-push-gap\) var\(--page-push-mt\)/);
  assert.doesNotMatch(rule, /#d4d4d4|#fff /);
  assert.match(css, /td\[style\*="background"\], \.word-document-page tr\[data-page-push\] > th\[style\*="background"\] \{ --page-paper-fill: #fff; --page-gap-fill: #d4d4d4; \}/);
});

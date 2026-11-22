import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");

// Hindi Word Test 5 Q7 (22 Nov 2026): the footer page number is a locked field (contenteditable=false); the browser's
// Bold skipped it, so "select the page number, Bold" did nothing and the saved run stayed bold: false.
test("Bold / Italic / colour / font / highlight also format a selected field (page number)", () => {
  assert.match(editor, /const formatSelectedFields=\(name:string,value\?:string\)=>\{/);
  assert.match(editor, /querySelectorAll<HTMLElement>\("\[data-field\]\[contenteditable='false'\]"\)\]\.filter\(field=>range\.intersectsNode\(field\)\)/);
  assert.match(editor, /if\(name==="bold"\)\{const on=!fields\.every\(field=>Number\(shown\(field\)\.fontWeight\)>=600\);for\(const field of fields\)field\.style\.fontWeight=on\?"700":"400"\}/);
  assert.match(editor, /document\.execCommand\(name,false,safeValue\);formatSelectedFields\(name,safeValue\);/);
});

test("Ctrl+B and Ctrl+I go through the editor's own Bold / Italic (so fields are formatted too)", () => {
  assert.match(editor, /key==="b"\|\|key==="i"\)\)\{event\.preventDefault\(\);runRef\.current\(key==="b"\?"bold":"italic"\);return\}/);
});

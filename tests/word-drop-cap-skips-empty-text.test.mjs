import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor = readFileSync(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");

// Hindi Word Test 5 (22 Nov 2026): after Character Spacing, paragraph 1 began with an empty text piece; Drop Cap took
// that first (empty) text node, said "Place the cursor in a paragraph with text" and did nothing.
test("Drop Cap takes the first text that has letters, not an empty text piece at the paragraph's start", () => {
  const applyDropCap = editor.slice(editor.indexOf("const applyDropCap="), editor.indexOf("const applyDropCap=") + 2500);
  assert.match(applyDropCap, /const first=textNodes\(block\)\.find\(node=>\(node\.textContent\?\?""\)\.trim\(\)\)/);
  assert.doesNotMatch(applyDropCap, /const first=textNodes\(block\)\[0\]/);
});

// "In margin" is placed as in Word: the capital starts at the page's left edge (back by the page's left margin), in
// both the editor and a reopened document -- not a fixed 0.5 in per line, which pushed a whole word off the page.
test("Drop Cap In margin starts at the page's left edge, when applied and when a document is reopened", () => {
  assert.match(editor, /function placeCapInMargin\([^)]*\)\{cap\.style\.float="left";cap\.style\.marginLeft="calc\(-1 \* var\(--word-margin-left, 1in\)\)"/);
  assert.match(editor, /if\(mode==="margin"\)\{cap\.dataset\.dropCapMargin="true";placeCapInMargin\(block,cap,distanceValue\)\}/);
  assert.match(editor, /if\(cap\.margin\)\{big\.dataset\.dropCapMargin="true";placeCapInMargin\(item,big,cap\.distance\)\}/);
  assert.doesNotMatch(editor, /\*0\.5\+distanceValue\}in|cap\.lines\*0\.5\+cap\.distance/);
});

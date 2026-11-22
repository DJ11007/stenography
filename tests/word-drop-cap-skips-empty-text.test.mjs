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

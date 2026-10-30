import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";

// Real reported problem (Hindi Test, Q5 "border on the second paragraph, only on the left and the bottom"): Home >
// Borders > Left Border and then Bottom Border left only the bottom border (each click replaced the one before),
// and the Borders and Shading dialog saved nothing gradable for a border on some sides. Word adds each side, and
// clicking a side again takes it off. The sides are saved as attrs.border "bottom,left" (top, right, bottom, left
// order); one side is the same word as before, all four stay "all".

const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const run = (overrides = {}) => ({ text: "Hello", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null, ...overrides });
const pageLayout = { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null };
const doc = (blocks) => ({ schemaVersion: "2", blocks, pageLayout, operations: [], savedAt: new Date().toISOString() });
const paragraph = (attrs = {}) => ({ id: "block-0", type: "paragraph", alignment: "left", runs: [run()], attrs: { lineNumbers: false, dropCap: false, ...attrs } });

test("a paragraph border on some sides is a valid saved document", () => {
  for (const border of ["bottom", "left", "bottom,left", "top,right,bottom", "all"]) assert.doesNotThrow(() => validateWordEditorDocument(doc([paragraph({ border })])), border);
});

test("the Borders drop-down adds and takes off each side by itself", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const BORDER_SIDES=\["top","right","bottom","left"\]as const;/);
  assert.match(editor, /const setBlockBorderSides=\(block:HTMLElement,sides:string\[\]\)=>/);
  assert.match(editor, /if\(\(BORDER_SIDES as readonly string\[\]\)\.includes\(value\)\)\{const current=currentBorderSides\(block\);setBlockBorderSides\(block,current\.includes\(value as"top"\)\?current\.filter\(side=>side!==value\):\[\.\.\.current,value\]\);continue\}/);
  // a border kept after a reload, in the document or from the dialog
  assert.match(editor, /else if\(kind\.includes\(","\)&&borderSidesOf\(kind\)\)for\(const side of borderSidesOf\(kind\)!\)html\.style\.setProperty\(`border-\$\{side\}`,BORDER_CSS\)/);
  assert.match(editor, /if\(isBorderSideKind\(block\.attrs\.border\)\)html\.dataset\.borderKind=block\.attrs\.border/);
  assert.match(editor, /const chosen=BORDER_SIDES\.filter\(side=>values\.edges\[side\]\|\|\(side==="top"&&values\.edges\.insideH&&index>0\)\);if\(chosen\.length>0&&chosen\.length<4\)block\.dataset\.borderKind=chosen\.join\(","\)/);
});

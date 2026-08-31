import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Undo and Redo are real, reachable ribbon commands with Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) keyboard shortcuts", async () => {
  const capabilities = await read("lib/word-editor-capabilities.ts");
  assert.match(capabilities, /option\("undo","Undo","↶"\)/);
  assert.match(capabilities, /option\("redo","Redo","↷"\)/);
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /key==="z"\){event\.preventDefault\(\);runRef\.current\("undo"\);return}/);
  assert.match(editor, /key==="y"\|\|\(event\.shiftKey&&key==="z"\)\)\){event\.preventDefault\(\);runRef\.current\("redo"\)}/);
  assert.match(editor, /useEffect\(\(\)=>{runRef\.current=run}\);/);
});

test("a real Font dialog exists with small caps, all caps, and hidden alongside the existing formatting options", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /function FontDialogForm/);
  assert.match(editor, /Small caps/);
  assert.match(editor, /All caps/);
  assert.match(editor, />Hidden</);
  assert.match(editor, /dialog\.kind==="font"&&<FontDialogForm dialog=\{dialog\} onSubmit=\{onFont\}\/>/);
  assert.match(editor, /fontDialog:\(\)=>{/);
});

test("the paragraph spacing dialog offers a Special indent (first line / hanging) choice with an amount field", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /Special indent/);
  assert.match(editor, /<option value="firstLine">First line<\/option>/);
  assert.match(editor, /<option value="hanging">Hanging<\/option>/);
});

test("inserting a table offers an AutoFit behavior choice (fixed / to contents / to window)", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /AutoFit behavior/);
  assert.match(editor, /Fixed column width/);
  assert.match(editor, /AutoFit to contents/);
  assert.match(editor, /AutoFit to window/);
});

test("Page Number opens a real position + alignment dialog instead of an unconditional insert", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /function PageNumberForm/);
  assert.match(editor, /pageNumber:\(\)=>setDialog\(\{kind:"pageNumber",position:insideHeaderFooter==="header"\?"top":"bottom",alignment:"center",style:"plain",format:"1",startAt:"1"\}\)/);
  assert.match(editor, /dialog\.kind==="pageNumber"&&<PageNumberForm dialog=\{dialog\} onSubmit=\{onPageNumber\} onRemove=\{onRemovePageNumbers\}\/>/);
});

test("the font dialog, paragraph special indent, table AutoFit, and page-number position are all gradable via lib/word-document-diff.ts", async () => {
  const diff = await read("lib/word-document-diff.ts");
  assert.match(diff, /"smallCaps", "allCaps", "hidden"/);
  assert.match(diff, /"specialIndentMode", "specialIndentAmount"/);
  assert.match(diff, /TABLE_ATTR_FIELDS = \["tableLayout"\]/);
});

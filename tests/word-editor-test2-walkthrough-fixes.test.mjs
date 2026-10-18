import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Found by attempting EFFICIENCY TEST 2 through the editor like a student (2026-10-18).
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("Enter in a ribbon number box (Indent, Spacing, Header from Top, table sizes) never also presses Enter in the document", async () => {
  // It split the paragraph the cursor was in, moving every later paragraph one place down.
  for (const file of ["components/word-efficiency/word-page-layout.tsx", "components/word-efficiency/word-table-tools.tsx", "components/word-efficiency/word-header-footer-tools.tsx"]) {
    const source = await read(file);
    assert.match(source, /if \(event\.key === "Enter"\) \{ event\.preventDefault\(\); commit\(/, file);
    assert.doesNotMatch(source, /if \(event\.key === "Enter"\) commit\(/, file);
  }
});

test("bullets and numbering keep a paragraph's spacing, indent, alignment, shading and border, and turning them off gives a real paragraph back", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const carried=listCommand\?selectedBlocks\(\)\.filter\(block=>block\.tagName==="P"\|\|block\.tagName==="LI"\)/);
  assert.match(editor, /const item=\(paragraph\.toList\?items:paragraphs\)\.find\(target=>blockKey\(target\)===paragraph\.text\);/);
  assert.match(editor, /if\(listCommand&&editor\.current\)wrapLooseText\(editor\.current\);/);
});

test("Ctrl+E / Ctrl+L / Ctrl+R / Ctrl+J align the paragraph, as in Word", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const alignKey=\(\{e:"alignCenter",l:"alignLeft",r:"alignRight",j:"justify"\}as Record<string,string>\)\[key\];/);
});

test("Undo / Redo restore whole document states (the browser's own undo scrambled paragraphs after list, border or page-setup changes)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /undo:\(\)=>stepHistory\(-1\),redo:\(\)=>stepHistory\(1\)/);
  assert.match(editor, /const changed=\(\)=>\{if\(submitted\)return;applyParagraphDefaults\(\);if\(!historyTimer\.current\)historyTimer\.current=setTimeout\(recordHistory,0\);/);
  // after an undo the next ribbon command must act where the cursor now is, not on the replaced content
  assert.match(editor, /restoreState\(page,log\.states\[target\],caret\);\{const restored=getSelection\(\);savedRange\.current=/);
});

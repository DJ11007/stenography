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

// Found by the user's own attempt on the real exam page (2026-10-18), whose timer re-renders
// the editor every second -- something the local harness never did.
test("reading the current paragraph/cell never moves the selection (re-renders stole focus from dialog boxes and threw the header cursor back)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const selectedBlocks=\(\)=>\{const range=editorRange\(\);/);
  assert.match(editor, /const cursorCell=\(\)=>\{const node=editorRange\(\)\?\.startContainer;/);
  assert.match(editor, /const restoreSelection=\(\)=>\{const selection=getSelection\(\);if\(selection\?\.rangeCount&&editor\.current\?\.contains\(selection\.anchorNode\)\)return;/);
});

test("Enter in a Word dialog presses OK and Esc presses Cancel", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /\(event\.key === "Enter" \? pick\("OK"\) : pick\("Cancel"\) \?\? null\)\?\.click\(\)/);
});

test("empty text pieces are not saved as runs (a header's first run was \"\" so its text was not graded)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const textRuns=type==="table"\?runs:runs\.filter\(run=>run\.text!==""\);/);
});

test("the page grows a whole sheet at a time instead of leaving text (the table) below a fixed A5/A4 page", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const sheet=`\$\{Math\.round\(pages\*pageHeight\)\}px`;if\(el\.style\.minHeight!==sheet\)el\.style\.minHeight=sheet;/);
  const css = await read("app/globals.css");
  assert.match(css, /\.word-document-page table\[data-block-type="table"\] \{ max-width: 100%; \}/);
});

test("marks per part (a)(b)(c): a question's score is the sum of its part rules, shown on the result page", async () => {
  const migration = await read("supabase/migrations/202610181500_word_efficiency_part_marks.sql");
  assert.match(migration, /add column if not exists part_label text/);
  assert.match(migration, /create unique index if not exists word_efficiency_grading_rules_version_question_part_key/);
  assert.match(migration, /public\.word_efficiency_score_question\(p_document,attempt_record\.version_id,score_row\.question_id,score_row\.maximum_marks,model_document\)/);
  const result = await read("app/typing/word-efficiency/results/[attemptId]/page.tsx");
  assert.match(result, /question\.partScores\.map\(part=><li key=\{part\.label\}/);
});

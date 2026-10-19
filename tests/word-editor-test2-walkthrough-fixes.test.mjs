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
  assert.match(editor, /const changed=\(\)=>\{if\(submitted\)return;paginationDirty\.current=true;applyParagraphDefaults\(\);if\(!historyTimer\.current\)historyTimer\.current=setTimeout\(recordHistory,0\);/);
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
  assert.match(editor, /function paginatePages\(page: HTMLElement, sheetHeight: number, zoom: number\) \{/);
  assert.match(editor, /block\.dataset\.pagePush = "true"; block\.style\.setProperty\("--page-push-mt", `\$\{margin\}px`\);/);
  const pageCss = await read("app/globals.css");
  assert.match(pageCss, /\.word-document-page \[data-page-push\] \{ margin-top: var\(--page-push-mt\) !important; \}/);
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

// Second real attempt (2026-10-18 evening).
test("Words only underline leaves the spaces: the span's own line is hidden and one line per word is drawn beside the page", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /function drawWordsOnlyUnderlines\(page: HTMLElement\) \{/);
  assert.ok(editor.includes("for (const word of node.data.matchAll(/\\S+/g)) {"));
  const css = await read("app/globals.css");
  assert.match(css, /\.word-document-page \[data-underline-style="words-only"\], \.word-document-page \[data-underline-words-only="true"\] \{ text-decoration-line: none !important; \}/);
});

test("Find and Replace: Format > Font is Word's Font dialog (Find Font / Replace Font), and the Replace with format is applied by Replace / Replace All", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /<FontDialog2013 title=\{fontPanel === "font" \? "Find Font" : "Replace Font"\}/);
  assert.match(dialogs, /const formatTarget = \(\) => \(tab === "replace" && focused\.current === "replace" \? "replace" : "find"\);/);
  const editor = await read(EDITOR);
  assert.match(editor, /if\(replacementText===""\)\{applyReplaceFormat\(range,format\);return\}/);
  assert.match(editor, /replaceMatch\(item\.range,item\.text,replaceFormat\)/);
});

test("Home > Borders has Word's full menu; Borders and Shading... works on paragraphs (and on the table when in one)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(tableCell\(\)\)\{if\(value==="borders-shading"\)onTableTool\("bordersDialog"\);else onTableTool\("borders",value\);return\}/);
  assert.match(editor, /if\(value==="borders-shading"\)\{setDialog\(\{kind:"paragraphBorders",initial:paragraphBorderValues\(\)\}\);return\}/);
  assert.match(editor, /"insertCells","paragraphBorders"\]\)/);
});

// Third real attempt (2026-10-19).
test("a page border can be on some sides only (bottom and right), saved as \"<css> sides:...\" and drawn on every sheet", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /function setPageBorder\(page: HTMLElement, text: string\) \{/);
  assert.match(editor, /border:pageBorderText\(editor\)/);
  assert.match(editor, /if\(text\("border"\)\)setPageBorder\(editor,text\("border"\)\);/);
  assert.match(editor, /function drawSheetBorders\(page: HTMLElement, sheets: number, sheetHeight: number, step: number, zoom: number\) \{/);
  assert.match(editor, /pageBorders:\(\)=>setDialog\(\{kind:"paragraphBorders",initial:paragraphBorderValues\(\),tab:"page"\}\)/);
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /pageEdge\("bottom", ln\("M3 17h14"\), "Bottom Border"\)/);
});

test("Find and Replace keeps every match highlighted while open, refreshed after each Replace", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /const result = onHighlightAll\(query, options, scope\); setHighlightOn\(true\); setMatchCount\(result\);/);
  assert.match(dialogs, /setMessage\(onReplaceAll\(query, replacement, options, scope, replaceFormat\)\); setRefresh\(value => value \+ 1\);/);
});

// Own full attempt of Test 2 (2026-10-19, 25/25): what still got in a student's way.
test("Replace All with only formatting keeps Find and Replace open (the font step closed every dialog)", async () => {
  const editor = await read(EDITOR);
  const body = editor.slice(editor.indexOf("const applyFontValues="), editor.indexOf("const applyFontValues=") + 6000);
  assert.doesNotMatch(body.slice(0, body.indexOf("\n };")), /setDialog\(null\)/);
});

test("the Font dialog on a selected row/column formats each cell once (it ran once per cell inside a per-cell loop)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /onFont=\{applyFontDialog\}/);
});

test("a short selection goes into Find what and the whole document is searched, as in Word", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /query:selectionIsQuery\?selected:query,selectionIsQuery,/);
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /useEffect\(\(\) => \{ if \(selectedAll\.current\) \{ selectedAll\.current = false; return; \} setMessage\(""\); \}, \[query, options, scope, tab\]\);/);
});

test("dialog drop-downs (colour palette, Format menu) are not cut short with needless scrollbars", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /menu\.scrollHeight \+ menu\.offsetHeight - menu\.clientHeight/);
  assert.match(dialogs, /Math\.min\(height, window\.innerHeight - top - 8\)/);
});

// User's attempt 2026-10-19: typed 0.8 / 0.5 / 1 (the paper's inches) and got 0.8 cm, 0.5 cm, 1 cm.
test("margins, gutter and indents are shown and typed in inches, as in Word for English (US): a plain 0.8 is 0.8\"", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /if \(dimension === "inches"\) return amount \* \(unit \? TO_CM\[unit\] : 2\.54\);/);
  assert.match(dialogs, /value=\{values\[key\]\} onChange=\{value => set\(\{ \[key\]: Math\.max\(0, value \?\? 0\) \}\)\} dimension="inches"/);
  assert.match(dialogs, /value=\{rightCm\} dimension="inches"/);
  const ribbon = await read("components/word-efficiency/word-page-layout.tsx");
  assert.match(ribbon, /<Spin label="Indent right" unit="in"/);
});

// User's attempt 2026-10-19: Find ^$ (Any Letter) > Find In > Current Selection, then Highlight + Font Color.
test("after Find In selects every match, formatting applies to ALL of them (it reached only the first)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const findSelection=useRef<\{index:number;length:number\}\[\]\|null>\(null\);/);
  assert.match(editor, /if\(!cells\.length&&findSelection\.current\?\.length&&editor\.current\)\{const spans=findSelection\.current;for\(let i=spans\.length-1;i>=0;i--\)/);
  assert.match(editor, /findSelection\.current=spans;/);
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /useEffect\(\(\) => \(\) => onClearHighlight\(true\), \[\]\);/);
  assert.match(dialogs, /if \(picked !== scope\) selectedAll\.current = true;/);
});

test("grading also accepts formatting applied to the words only (spaces/punctuation left plain)", async () => {
  const migration = await read("supabase/migrations/202610191200_word_efficiency_words_only_runs.sql");
  assert.match(migration, /continue when coalesce\(run->>'text', ''\) !~ '\[\[:alnum:\]\]';/);
  assert.match(migration, /earned:=round\(greatest\(/);
});

// Own attempt 2026-10-19 (25/25): Undo seemed to do nothing after a ribbon change.
test("Undo history leaves out the page layout (push margins, sheet height), so Undo steps real edits, not invisible re-layouts", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /for\(const block of clone\.querySelectorAll<HTMLElement>\("\[data-page-push\]"\)\)\{block\.removeAttribute\("data-page-push"\);block\.style\.removeProperty\("--page-push-mt"\);/);
  assert.match(editor, /clone\.style\.removeProperty\("min-height"\);return\{html:clone\.innerHTML/);
});

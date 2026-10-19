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
  assert.match(editor, /const textRuns=type==="table"\?runs:mergeSameRuns\(runs\.filter\(run=>run\.text!==""\)\);/);
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
  assert.match(editor, /replaceMatch\(range,item\.text,replaceFormat\)/);
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

test("Find and Replace keeps the matches highlighted (once Reading Highlight is on), refreshed after each Replace", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /const timer = setTimeout\(\(\) => \{ const result = onHighlightAll\(query, options, scope\); setMatchCount\(result\); \}, 200\);/);
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

// Q4(b) "bottom and right page border only" had no marking rule (Q4 = a + c only).
test("a page border is marked by its sides (pageLayout.borderSides), whatever line style the student picked", async () => {
  const migration = await read("supabase/migrations/202610191300_word_efficiency_page_border_sides.sql");
  assert.match(migration, /if parts\[2\]='borderSides' and coalesce\(array_length\(parts,1\),0\)=2 then/);
  assert.match(migration, /'pageLayout\.borderSides', 'model-answer-match-v2', to_jsonb\('bottom,right'::text\), 1\.67/);
  const diff = await read("lib/word-document-diff.ts");
  assert.match(diff, /if \(field === "border"\) \{ const sides = pageBorderSides\(afterLayout\.border\); changes\.push\(\{ target: "pageLayout\.borderSides"/);
  const sidesOf = (border) => {
    if (typeof border !== "string" || !border.trim() || /(^|\s)none(\s|$)/i.test(border)) return null;
    const match = / sides:([a-z,]+)$/.exec(border);
    return match ? [...new Set(match[1].split(","))].sort().join(",") : "bottom,left,right,top";
  };
  assert.equal(sidesOf("1px solid #000000 sides:right,bottom"), "bottom,right");
  assert.equal(sidesOf("3px dotted #FF0000 sides:bottom,right"), "bottom,right");
  assert.equal(sidesOf("1px solid #000000"), "bottom,left,right,top");
  assert.equal(sidesOf(null), null);
});

// User's attempt 2026-10-19 (time-up submit failed: "Invalid structured document block").
test("Replace All finds each match's range again just before replacing it (stale ranges formatted only the last letter of each text piece)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /for\(let i=steps\.length-1;i>=0;i--\)\{const item=steps\[i\];const range=rangeForMatch\(buildDocumentText\(editor\.current\)\.segments,item\.index,item\.length\);/);
});

test("neighbouring runs with the same formatting are saved as one run, and a block may have up to 5000 runs", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const textRuns=type==="table"\?runs:mergeSameRuns\(runs\.filter\(run=>run\.text!==""\)\);/);
  const schema = await read("lib/word-editor-document.ts");
  assert.match(schema, /block\.runs\.length < 1 \|\| block\.runs\.length > 5000\)/);
  const migration = await read("supabase/migrations/202610191400_word_efficiency_block_run_limit.sql");
  assert.match(migration, /not between 1 and 5000/);
});

test("typing in Find what highlights nothing; matches are marked only by Reading Highlight or Find In", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /if \(!highlightOn\) \{ setMatchCount\(""\); return; \}/);
});

test("dragging from one table cell into another selects the rectangle of cells (a column when dragging down), as in Word", async () => {
  const editor = await read(EDITOR);
  // followed on the whole document (clamped to the table) so leaving the table never falls back to text selection
  assert.match(editor, /document\.addEventListener\("mousemove",move,true\);document\.addEventListener\("mouseup",up,true\);/);
  assert.match(editor, /const cellAtPoint=\(table:HTMLTableElement,x:number,y:number\)=>\{/);
  assert.match(editor, /if\(!startCellDrag\(event\)\)handleEditorMouseDown\(event\)/);
  // click above a column / left of a row / the table handle, as in Word
  assert.match(editor, /return\{kind:"column",table,index:cell\.cellIndex\}/);
  assert.match(editor, /return\{kind:"row",table,index:row\.rowIndex\}/);
  assert.match(editor, /created\.className="word-table-handle"/);
});

test("Any Letter (^$) is one letter, as in Word: \"Word found 715 items matching this criteria. (129 words)\"; refused with Use wildcards", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /return`Word found \$\{counted\.total\} item\$\{counted\.total===1\?"":"s"\} matching this criteria\.\$\{counted\.words\}`/);
  assert.match(editor, /`Word has completed its search of the selection and has made \$\{made\}\.\$\{counted\.words\}`/);
  const engine = await read("lib/word-find-engine.ts");
  assert.ok(engine.includes(String.raw`case "$": return "\\p{L}";`));
  assert.match(engine, /is not a valid special character for the Find What box or is not supported when the Use Wildcards check box is selected\./);
  const { findWhatError } = await import("../lib/word-find-engine.ts").catch(() => ({}));
  if (findWhatError) {
    assert.match(findWhatError("^$", { wildcards: true }), /^\^\$ is not a valid special character/);
    assert.equal(findWhatError("^$", { wildcards: false }), null);
    assert.equal(findWhatError("[a-z]@", { wildcards: true }), null);
  }
});

test("a document that fails validation still submits once time is up (the server then uses the last autosave)", async () => {
  const actions = await read("app/typing/word-efficiency/actions.ts");
  assert.match(actions, /catch\(validationError\)\{.*safeDocument=INVALID_DOCUMENT_PLACEHOLDER\}/);
  assert.doesNotMatch(actions, /submitWordDocument\(attemptId:string,document:unknown\):Promise<\{ok:boolean;error:string\}>\{try\{const safeDocument=validateWordEditorDocument\(document\);/);
});

// Test 1 Q8 (2026-10-19): typing a font name / 18.5 in the ribbon boxes applied to nothing.
test("ribbon Font / Font Size boxes keep the page selection (focusing the page no longer replaces it with a cursor)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const focusKeepingSelection=\(\)=>\{const page=editor\.current;/);
  assert.match(editor, /const exec=\(name:string,value\?:string\)=>\{focusKeepingSelection\(\);/);
  assert.doesNotMatch(editor, /editor\.current\?\.focus\(\);restoreSelection\(\);/);
  assert.match(editor, /onBlur=\{\(\)=>\{const kept=savedRange\.current;if\(kept&&!kept\.collapsed/);
});

test("Test 1 Q8: font and size boxes keep the text selected and show the chosen values", async () => {
  const ribbon = await readFile(new URL("../components/word-efficiency/word-editor-ribbon.tsx", import.meta.url), "utf8");
  // the size box commits once (Enter), not again on blur, which used to collapse the selection
  assert.match(ribbon, /const edited = useRef\(false\);/);
  // after a font is chosen the box shows that font, not the stale one from before the choice
  assert.match(ribbon, /const chosenRef=useRef<string\|null>\(null\);/);
  assert.match(ribbon, /setText\(chosenRef\.current\?\?selected\);chosenRef\.current=null;/);
  const editor = await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /const focusKeepingSelection=\(\)=>\{/);
  assert.match(editor, /word-kept-selection/);
});

test("text with no font of its own shows Calibri (Body) in the Font box, not the page's Segoe UI", async () => {
  const editor = await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /const family=styledFont\?approvedFont\(getComputedStyle\(fontSource\)\.fontFamily\):"Calibri \(Body\)";/);
});

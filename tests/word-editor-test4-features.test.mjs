import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";

// Word 2013 features EFFICIENCY TEST 4 needs that the editor did not have.
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const run = { text: "Hello", bold: false, italic: false, underline: false, underlineStyle: null, underlineColor: null, underlineThickness: null, underlineWordsOnly: false, strike: false, doubleStrike: false, superscript: false, subscript: false, smallCaps: false, allCaps: false, hidden: false, outline: false, emboss: false, fontFamily: null, fontSize: null, color: null, highlight: null, charScale: null, charSpacing: null, charPosition: null, kerningEnabled: false, kerningMin: null, href: null, bookmark: null, field: null };
const doc = (layout) => ({ schemaVersion: "2", blocks: [{ id: "block-0", type: "paragraph", alignment: "left", runs: [run], attrs: {} }], pageLayout: { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null, ...layout }, operations: [], savedAt: "2026-10-20T00:00:00.000Z" });

test("Custom Watermark settings are saved and checked: a red, not semitransparent Kruti Dev watermark (Test 4 Q4b)", () => {
  assert.doesNotThrow(() => validateWordEditorDocument(doc({})), "a document without the new fields is still valid");
  assert.doesNotThrow(() => validateWordEditorDocument(doc({ watermark: "le`f) Dyklsl", watermarkFont: "Kruti Dev 010", watermarkSize: "auto", watermarkColor: "FF0000", watermarkSemitransparent: "false", watermarkLayout: "diagonal" })));
  assert.doesNotThrow(() => validateWordEditorDocument(doc({ watermark: "DRAFT", watermarkFont: "Calibri", watermarkSize: "72", watermarkColor: "C0C0C0", watermarkSemitransparent: "true", watermarkLayout: "horizontal" })));
  assert.throws(() => validateWordEditorDocument(doc({ watermark: "X", watermarkColor: "red" })), /watermark color/);
  assert.throws(() => validateWordEditorDocument(doc({ watermark: "X", watermarkLayout: "sideways" })), /watermark layout/);
  assert.throws(() => validateWordEditorDocument(doc({ watermark: "X", watermarkSemitransparent: "maybe" })), /watermark transparency/);
});

test("DESIGN > Watermark is Word's gallery with Custom Watermark… and Remove Watermark; the watermark is drawn on every page", async () => {
  const [ribbon, dialogs, editor] = await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"), read("components/word-efficiency/word-2013-dialogs.tsx"), read(EDITOR)]);
  assert.match(ribbon, /if\(option\.id==="watermark"\)return <GalleryMenu option=\{option\} preview=\{preview\} items=\{WATERMARK_ITEMS\}/);
  assert.match(ribbon, /const WATERMARK_ACTIONS=\[\{id:"custom",label:"Custom Watermark…"\},\{id:"remove",label:"Remove Watermark"\}\];/);
  assert.match(dialogs, /<Window13 title="Printed Watermark" width=\{430\}>/);
  assert.match(dialogs, /S<u>e<\/u>mitransparent/);
  assert.match(editor, /watermarkAction:"watermark"/, "the gallery actions are allowed wherever Watermark is");
  assert.match(editor, /<WatermarkLayer editor=\{editor\}\/>/);
  assert.match(editor, /mixBlendMode:"multiply"/, "drawn behind the text, as Word does");
  assert.match(editor, /watermarkSemitransparent:editor\.dataset\.watermarkSemitransparent==="false"\?"false":"true"/);
});

test("a header/footer in Word's left/centre/right positions saves as tab characters and reloads into the same positions (Test 4 Q3b/c)", async () => {
  const { Window } = await import("happy-dom");
  const { headerFooterZone, restoreHeaderFooterTabs } = await import("../lib/word-header-footer-tabs.ts");
  const document = new Window().document;
  // Saved runs: page number on the left, "SAMRADHI CLASSES" on the right ("\t\t" = two positions on).
  document.body.innerHTML = `<div id="page"><p>Body</p><footer data-block-type="footer"><span data-field="page-number|current|left">1</span><span style="font-size:30pt">\t\tSAMRADHI CLASSES</span></footer></div>`;
  const page = document.getElementById("page");
  restoreHeaderFooterTabs(page);
  const footer = page.querySelector("footer");
  const zones = [...footer.children];
  assert.equal(zones.length, 3);
  assert.deepEqual(zones.map(zone => zone.textContent), ["1", "", "SAMRADHI CLASSES"]);
  assert.equal(zones[2].style.textAlign, "right");
  assert.equal(zones[2].firstElementChild.style.fontSize, "30pt", "the text keeps its formatting");
  assert.equal(zones[0].firstElementChild.getAttribute("data-field"), "page-number|current|left", "a field is never split");
  // Saving walks the same positions back: the right-hand text is in position 2.
  assert.equal(headerFooterZone(zones[2].firstChild.firstChild ?? zones[2].firstChild, footer), 2);
  assert.equal(headerFooterZone(zones[0].firstChild, footer), 0);
  // A plain footer without tabs is left alone.
  document.body.innerHTML = `<div id="page2"><footer data-block-type="footer"><span>Plain</span></footer></div>`;
  restoreHeaderFooterTabs(document.getElementById("page2"));
  assert.equal(document.querySelector("#page2 footer").innerHTML, "<span>Plain</span>");
});

test("saving a header/footer writes a tab before text in a later position", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const zone=zoned\?headerFooterZone\(own,element\):0;const tabs=zone>zoneAt\?"\\t"\.repeat\(zone-zoneAt\):"";/);
  assert.match(editor, /runs\.push\(\{text:\(tabs\+\(node\.textContent\?\?""\)\)\.slice\(0,200000\),/);
  assert.match(editor, /restoreHeaderFooterTabs\(editor\)\}/);
});

test("typing over or deleting a selected [Type here] placeholder changes only that placeholder (the right-hand box used to merge into the middle one)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const deleting=event\.inputType==="deleteContentForward"\|\|event\.inputType==="deleteContentBackward";/);
  assert.match(editor, /const text=document\.createTextNode\(deleting\?"":event\.data\?\?""\);holder\.replaceWith\(text\);/);
  assert.match(editor, /root\.addEventListener\("beforeinput",onBeforeInput\)/);
});

test("Multilevel List: Word's library styles with a level (1-9) per item, saved and checked (Test 4 Q4c)", async () => {
  const listDoc = (attrs) => ({ ...doc({}), blocks: [{ id: "block-0", type: "list-item", alignment: "left", runs: [run], attrs }] });
  assert.doesNotThrow(() => validateWordEditorDocument(listDoc({ listStyle: "multilevel-decimal", listLevel: "2" })));
  assert.doesNotThrow(() => validateWordEditorDocument(listDoc({ listStyle: "multilevel-bullet", listLevel: "9" })));
  assert.throws(() => validateWordEditorDocument(listDoc({ listStyle: "multilevel-decimal", listLevel: "10" })), /list level/);
  assert.throws(() => validateWordEditorDocument(listDoc({ listStyle: "multilevel-zigzag", listLevel: "1" })), /list style/);
  const [ribbon, editor, css, structure] = await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"), read(EDITOR), read("app/globals.css"), read("lib/word-editor-structure.ts")]);
  assert.match(ribbon, /const MULTILEVEL_ITEMS=\[\{value:"none",label:"None",swatch:""\},\{value:"multilevel-decimal",label:"1\.  1\.1\.  1\.1\.1\."/);
  // Tab / Increase Indent go a level down, Shift+Tab / Decrease Indent a level up.
  assert.match(editor, /const changeListLevel=\(delta:number\)=>\{/);
  assert.match(editor, /\(changeListLevel\(event\.shiftKey\?-1:1\)\|\|tableTab\(event\.shiftKey\)\|\|headerFooterTab\(event\.shiftKey\)\)/);
  assert.match(editor, /if\(id==="increaseIndent"\|\|id==="decreaseIndent"\)\{if\(changeListLevel\(id==="increaseIndent"\?1:-1\)\)return false;/);
  assert.match(editor, /if\(String\(attrs\.listStyle\)\.startsWith\("multilevel-"\)\)\{const level=\(element as HTMLElement\)\.dataset\.listLevel\?\?"";attrs\.listLevel=/);
  // 1. / 1.1. / 1.1.1.: each level shows every higher level's number.
  assert.match(css, /ol\[data-list-style="multilevel-decimal"\] > li\[data-list-level="3"\]::marker \{ content: counter\(wl1\) "\." counter\(wl2\) "\." counter\(wl3\) "\. "; \}/);
  assert.match(css, /li\[data-list-level="1"\], ol\[data-list-style\^="multilevel-"\] > li:not\(\[data-list-level\]\) \{ counter-increment: wl1; counter-set: wl2 0/);
  assert.match(structure, /export const MULTILEVEL_LIST_STYLES=\["multilevel-decimal","multilevel-paren","multilevel-outline","multilevel-bullet"\] as const;/);
});

test("font names are quoted in CSS, so Kruti Dev 010 (a name with digits) is not ignored by the browser", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /function cssFontFamily\(name:string\)\{const trimmed=name\.trim\(\);return \/\^\["'\]\/\.test\(trimmed\)\|\|trimmed\.includes\(","\)\?trimmed:`"\$\{trimmed\.replace/);
  assert.match(editor, /fontFamily:run\.fontFamily\?cssFontFamily\(run\.fontFamily\):undefined,/, "the starting document");
  assert.match(editor, /if\(run\.fontFamily\)span\.style\.fontFamily=cssFontFamily\(run\.fontFamily\);/, "a reloaded document");
  assert.match(editor, /fontFamily:values\.fontFamily\?cssFontFamily\(values\.fontFamily\):undefined/, "the Font dialog");
  assert.doesNotMatch(editor, /fontFamily:run\.fontFamily\?\?undefined/);
});

test("Text Effects on the ribbon is Word 2013's menu: 15-effect gallery, Outline colours, the other effect rows (it used to apply double strikethrough) (Test 4 Q1b)", async () => {
  const [ribbon, editor] = await Promise.all([read("components/word-efficiency/word-editor-ribbon.tsx"), read(EDITOR)]);
  assert.match(ribbon, /if\(option\.id==="textEffects"\)return <TextEffectsMenu preview=\{preview\} onPick=\{value=>onValueCommand\?\.\("textEffects",value\)\}\/>;/);
  assert.equal((ribbon.match(/\{label:"(Gradient )?Fill - [^"]+",fill:"[0-9A-F]{6}"(,outline:"[0-9A-F]{6}")?\}/g) ?? []).length, 15, "Word's 3 x 5 gallery");
  assert.match(ribbon, /const TEXT_EFFECT_ROWS=\["Shadow","Reflection","Glow","Number Styles","Ligatures","Stylistic Sets"\];/);
  assert.match(ribbon, /<WordPalette noneLabel="No Outline" close=\{close\} onPick=\{hex=>\{if\(!preview\)onPick\(hex\?`outline:\$\{hex\.toUpperCase\(\)\}`:"outline:none"\)\}\}\/>/);
  assert.match(editor, /if\(id==="textEffects"\)\{if\(value\.startsWith\("fill:"\)\)applyOutline\("none",value\.slice\(5\)\);else applyOutline\(value\.replace\(\/\^outline:\/,""\)\);return\}/);
  assert.match(editor, /color\?\{outline:"true",outlineFill:fill\}:\{outline:"false"\}/);
  assert.doesNotMatch(editor, /applyDoubleStrike/);
  // No Outline inside outlined text: the nearest data-outline decides.
  assert.match(editor, /outlineNode=\(parent\.closest\("\[data-outline\]"\)as HTMLElement\|null\)\?\.dataset\.outline==="true"/);
});

test("Tab in a table goes to the next cell, and in the last cell adds a row, as in Word (Test 4 Q5a)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const tableTab=\(back:boolean\)=>\{/);
  assert.match(editor, /if\(!target\)\{if\(back\)return true;const row=cell\.parentElement as HTMLTableRowElement;if\(!insertRow\(table,row\.rowIndex,"below"\)\)return true;target=table\.rows\[row\.rowIndex\+1\]\?\.cells\[0\];changed\(\)\}/);
});

test("a first-line / hanging indent is saved with the answer (it was shown on the page but never saved) (Test 4 Q2a)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(\(block\.type==="paragraph"\|\|block\.type==="list-item"\)&&source\.specialIndentMode\)\{attrs\.specialIndentMode=source\.specialIndentMode;attrs\.specialIndentAmount=source\.specialIndentAmount\?\?null\}/);
});

test("header/footer text in a position stays on one line, and Replace names the underline style as Word does", async () => {
  const [css, dialogs] = await Promise.all([read("app/globals.css"), read("components/word-efficiency/word-2013-dialogs.tsx")]);
  assert.match(css, /footer\[data-block-type="footer"\] > span\[style\*="33%"\] \{ white-space: nowrap;/);
  assert.match(dialogs, /"dot-dash": "Dot dash underline"/);
  assert.match(dialogs, /\$\{UNDERLINE_DESCRIPTIONS\[font\.underlineStyle\] \?\? "Underline"\}/);
});

test("pages: a table is split between rows at a page break, as in Word, and pages are split again once a late font (Kruti Dev 010) loads", async () => {
  const [editor, css] = await Promise.all([read(EDITOR), read("app/globals.css")]);
  assert.match(editor, /if \(block\.tagName === "TABLE" && paginateTableRows\(block as HTMLTableElement, \{ top, zoom, step, sheetHeight, padTop, padBottom, usable \}\)\) continue;/);
  assert.match(editor, /if \(index === 0\) return false;/, "a table whose first row does not fit moves whole, like a paragraph");
  assert.match(editor, /const target = \(number \+ 1\) \* sheet\.step \+ sheet\.padTop, push = target - rowTop;/);
  assert.match(editor, /Read before the row is marked: getComputedStyle is live/);
  assert.match(editor, /void fonts\.ready\.then\(redo\);fonts\.addEventListener\("loadingdone",redo\);/);
  assert.match(css, /\.word-document-page tr\[data-page-push\] > td, \.word-document-page tr\[data-page-push\] > th \{\n  padding-top: calc\(var\(--page-push-mt\) \+ var\(--page-push-pad, 0px\)\) !important;/);
  assert.match(css, /#fff 0 var\(--page-push-white\), #d4d4d4 var\(--page-push-white\) var\(--page-push-gap\), #fff var\(--page-push-gap\) var\(--page-push-mt\)/, "the paper, the grey gap and the next sheet's margin");
});

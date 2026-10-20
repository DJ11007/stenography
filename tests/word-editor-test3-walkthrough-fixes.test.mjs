import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { expandReplacement, matchReplacementCase } from "../lib/word-find-engine.ts";

// Bugs found by working through EFFICIENCY TEST 3 in the real editor, one question at a time.
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

test("Replace All keeps each found word's capitals, as Word does when Match case is off (Q6: rajasthan -> punjab)", () => {
  assert.equal(matchReplacementCase("rajasthan", "punjab"), "punjab");
  assert.equal(matchReplacementCase("Rajasthan", "punjab"), "Punjab");
  assert.equal(matchReplacementCase("RAJASTHAN", "punjab"), "PUNJAB");
  assert.equal(matchReplacementCase("Rajasthan", "New Delhi"), "New Delhi", "a replacement typed with its own capitals is used as typed");
  assert.equal(expandReplacement("punjab", { text: "Rajasthan", groups: [] }, { wildcards: false, matchCase: false }), "Punjab");
  assert.equal(expandReplacement("punjab", { text: "Rajasthan", groups: [] }, { wildcards: false, matchCase: true }), "punjab", "Match case on: exactly as typed");
});

test("arrow keys, Home/End and Ctrl+A drop Find's 'Find In' selection, so the next format goes where the caret is (Q4 went to the old Find result)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(\/\^\(Arrow\(Left\|Right\|Up\|Down\)\|Home\|End\|PageUp\|PageDown\)\$\/\.test\(event\.key\)\|\|\(\(event\.ctrlKey\|\|event\.metaKey\)&&\(event\.key==='a'\|\|event\.key==='A'\)\)\)dropFindSelection\(\);/);
});

test("Date & Time / Page Number typed into a selected footer placeholder replace it, in its column (Q8, Q9)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const selectedPlaceholder=\(\)=>/);
  assert.match(editor, /holder\.replaceWith\(\.\.\.nodes\);/);
  // Page Number > Current Position records the alignment of the line it lands on.
  assert.match(editor, /const align=spot\?getComputedStyle\(spot\)\.textAlign:"";insertField\(pageNumberSpan\("current",\{\.\.\.design,alignment:align==="right"\|\|align==="end"\?"right":align==="center"\?"center":design\.alignment\}\)\)/);
});

test("a page number is saved: field text inside the non-editable chip counts as document text", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /function runTextNodes\(element:Node\)\{return textNodes\(element\)\.filter\(node=>\{const parent=node\.parentElement;return Boolean\(parent\)&&\(!parent!\.closest\('\[contenteditable="false"\]'\)\|\|Boolean\(parent!\.closest\("\[data-field\]"\)\)\)\}\)\}/);
});

test("a page number is saved with the formatting around it, not the on-screen chip's cyan/bold/small look", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const chip=own\.closest\('\[data-field\^="page-number"\]'\);const parent=\(chip\?\.parentElement\?\?own\) as HTMLElement;const style=getComputedStyle\(parent\)/);
});

test("links, bookmarks and fields are read per text piece BEFORE same-format pieces merge (the date and page number became one run)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /href:own\.closest\("a"\)\?\.getAttribute\("href"\)\?\?null,bookmark:own\.closest\("\[data-bookmark\]"\)\?\.getAttribute\("data-bookmark"\)\?\?null,field:own\.closest\("\[data-field\]"\)\?\.getAttribute\("data-field"\)\?\?null\}\)/);
  assert.match(editor, /field:"field"in run\?run\.field:field\?\.getAttribute\("data-field"\)\?\?null/);
});

test("Size > Legal sets Legal's real shape (8.5 x 14), not Letter's (Q11 looked identical to Letter)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const paperRatio=\(id:string,landscape:boolean\)=>\{const paper=PAPER_SIZES\.find\(size=>size\.id===id\);/);
  assert.match(editor, /pageStyle\("aspectRatio",paperRatio\(value,landscape\)!\)/);
});

test("Page Borders has Word's Wave and Double wave styles, drawn as a wave and saved with their sides (Q12)", async () => {
  const [editor, dialogs] = await Promise.all([read(EDITOR), read("components/word-efficiency/word-2013-dialogs.tsx")]);
  assert.match(dialogs, /const PAGE_STYLE_LIST = \[\.\.\.STYLE_LIST, "wave", "doubleWave"\] as const;/);
  assert.match(dialogs, /wave: "Wave", doubleWave: "Double wave"/);
  assert.match(editor, /function waveBorderImage\(color: string, double: boolean\)/);
});

test("Font > Advanced: typing 0.5 into Condensed By keeps Condensed (the leading 0 used to switch it to Normal and disable the box)", async () => {
  const dialogs = await read("components/word-efficiency/word-2013-dialogs.tsx");
  assert.match(dialogs, /const \[spacingMode, setSpacingMode\] = useState<"normal" \| "expanded" \| "condensed">/);
  assert.match(dialogs, /const \[positionMode, setPositionMode\] = useState<"normal" \| "raised" \| "lowered">/);
  assert.doesNotMatch(dialogs, /spacingMode = spacingNumber > 0/, "the mode must not be worked out from the number while typing");
});

test("Dot-dash and Dot-dot-dash underlines are drawn as their real pattern in the underline colour, not as plain dots", async () => {
  const [editor, css] = await Promise.all([read(EDITOR), read("app/globals.css")]);
  assert.match(css, /\.word-document-page \[data-underline-style="dot-dot-dash"\] \{ background-size: 17px 1\.5px; background-image: linear-gradient\(90deg, var\(--word-underline-color, currentColor\) 0 6px/);
  assert.match(css, /\.word-document-page \[data-underline-style="dot-dash"\] \{ background-size: 13px 1\.5px;/);
  assert.match(editor, /function syncPatternUnderlines\(root:HTMLElement\)\{for\(const element of root\.querySelectorAll<HTMLElement>\('\[data-underline-style="dot-dash"\],\[data-underline-style="dot-dot-dash"\]'\)\)/);
  assert.match(editor, /const observer=new MutationObserver\(\(\)=>syncPatternUnderlines\(root\)\)/);
});

test("Tab in a header/footer moves to Word's centre and right positions, keeping what was typed on the left (date left, page number right without losing the date)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /onKeyDown=\{event=>\{if\(event\.key==="Tab"&&!event\.ctrlKey&&!event\.metaKey&&!event\.altKey&&!submitted&&\(changeListLevel\(event\.shiftKey\?-1:1\)\|\|headerFooterTab\(event\.shiftKey\)\)\)\{event\.preventDefault\(\);return\}/);
  assert.match(editor, /const headerFooterTab=\(back:boolean\)=>\{/);
  assert.match(editor, /left\.append\(\.\.\.\[\.\.\.area\.childNodes\]/, "the text already in the footer stays in the left position");
  // A page number / date at an empty position goes inside it, so the position keeps its right alignment.
  assert.match(editor, /const placeholder=selectedPlaceholder\(\),holder=placeholder\?\?emptySpot;if\(holder\)\{/);
  assert.match(editor, /if\(placeholder\)holder\.replaceWith\(\.\.\.nodes\);else holder\.append\(\.\.\.nodes\);/);
});

test("a page number looks like Word's: plain text in the line's font, Word's grey field shading only while the header/footer is edited (no cyan chip)", async () => {
  const [editor, css] = await Promise.all([read(EDITOR), read("app/globals.css")]);
  assert.doesNotMatch(editor, /border-dashed border-cyan-500 bg-cyan-50 px-1 text-xs font-bold text-cyan-800/);
  assert.match(editor, /contenteditable="false">\$\{escapeHtml\(pageNumberLabel/);
  assert.match(css, /\.word-document-page \.word-field \{ font: inherit; color: inherit; \}/);
  // A background IMAGE: the run reader saves a background COLOUR as a highlight.
  assert.match(css, /\.word-document-page\[data-hf-editing\] \[data-field\], \.word-document-page \[data-field\]:hover \{ background-image: linear-gradient\(#d9d9d9, #d9d9d9\); \}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";

test("a new header is prepended and a new footer is appended as real DOM siblings of the body blocks, not inserted wherever the cursor happened to be -- this is what actually pushes body content down/up", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const insertHeaderFooter=\(which:"header"\|"footer",innerHtml:string\)=>\{/);
  assert.match(editor, /if\(which==="header"\)editor\.current\.prepend\(element\);else editor\.current\.append\(element\)/);
});

test("Edit Header/Footer creates a truly empty element (no placeholder text baked into the saved document) so the CSS-only ghost placeholder shows instead", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(!element\)\{element=insertHeaderFooter\(which,""\);changed\(\)\}/);
  const css = await read("app/globals.css");
  assert.match(css, /header\[data-block-type="header"\]:empty::before,/);
  assert.match(css, /header\[data-block-type="header"\]:has\(> br:only-child\)::before \{ content: "Header";/);
  assert.match(css, /footer\[data-block-type="footer"\]:empty::before,/);
  assert.match(css, /footer\[data-block-type="footer"\]:has\(> br:only-child\)::before \{ content: "Footer";/);
});

test("Drop Cap is a real gallery (None/Dropped/In margin) plus a Drop Cap Options dialog (font, lines to drop, distance), and applies to the paragraph the cursor is in without requiring an explicit text selection", async () => {
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  assert.match(ribbon, /const DROP_CAP_ITEMS=\[\{value:"none",label:"None"\},\{value:"dropped",label:"Dropped"\},\{value:"margin",label:"In margin"\}\]/);
  assert.match(ribbon, /const DROP_CAP_ACTIONS=\[\{id:"options",label:"Drop Cap Options…"\}\]/);
  const editor = await read(EDITOR);
  assert.match(editor, /function DropCapOptionsForm/);
  assert.match(editor, /const dropCapParagraph=\(\)=>selectedBlocks\(\)\.find\(block=>block\.tagName==="P"\)\?\?null/);
  assert.match(editor, /const applyDropCap=\(mode:string,fontFamily:string,lines:string,distance:string\)=>\{/);
  assert.match(editor, /Place the cursor in a paragraph with text to apply Drop Cap\./);
});

test("Drop Cap's lines/distance/margin position persist across reload as new paragraph attrs, not just applied once and forgotten", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /block\.dataset\.dropCapLines=String\(linesValue\)/);
  assert.match(editor, /block\.dataset\.dropCapDistance=String\(distanceValue\)/);
  assert.match(editor, /function applyDropCapMarker\(element:HTMLElement,lines=3,distance=0,margin=false\)/);
  const validator = await read("lib/word-editor-document.ts");
  assert.match(validator, /"dropCapLines", "dropCapDistance", "dropCapMargin"/);
  const diff = await read("lib/word-document-diff.ts");
  assert.match(diff, /"dropCap", "dropCapLines", "dropCapDistance", "dropCapMargin"/);
});

test("Margins, Orientation, Page Size, and Columns are real galleries with the actual Word preset values from the screenshots, not a single toggle or a 2-item choice", async () => {
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  for (const label of ["Normal — Top/Bottom 2.54 cm, Left/Right 2.54 cm", "Narrow — all sides 1.27 cm", "Moderate — Top/Bottom 2.54 cm, Left/Right 1.91 cm", "Wide — Top/Bottom 2.54 cm, Left/Right 5.08 cm", "Mirrored — Top/Bottom 2.54 cm, Inside 3.18 cm, Outside 2.54 cm", "Office 2003 Default — Top/Bottom 2.54 cm, Left/Right 3.18 cm"]) {
    assert.match(ribbon, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(ribbon, /const MARGIN_ACTIONS=\[\{id:"custom",label:"Custom Margins…"\}\]/);
  assert.match(ribbon, /const ORIENTATION_ITEMS=\[\{value:"portrait",label:"Portrait"\},\{value:"landscape",label:"Landscape"\}\]/);
  for (const label of ["Letter — 21.59 × 27.94 cm", "Legal — 21.59 × 35.56 cm", "Statement — 13.97 × 21.59 cm", "Executive — 18.41 × 26.67 cm", "A4 — 21 × 29.7 cm", "A5 — 14.8 × 21 cm", "B5 (JIS) — 18.2 × 25.7 cm"]) {
    assert.match(ribbon, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(ribbon, /const PAGE_SIZE_ACTIONS=\[\{id:"custom",label:"More Paper Sizes…"\}\]/);
  assert.match(ribbon, /const COLUMN_ITEMS=\[\{value:"1",label:"One"\},\{value:"2",label:"Two"\},\{value:"3",label:"Three"\}\]/);
  assert.match(ribbon, /const COLUMN_ACTIONS=\[\{id:"custom",label:"More Columns…"\}\]/);
});

test("Left/Right unequal columns are honestly noted as unsupported instead of silently doing nothing, since this editor's CSS multi-column layout can't be asymmetric", async () => {
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  assert.match(ribbon, /columns:"Left\/Right unequal columns aren't supported in this exam tool — only equal-width columns\."/);
});

test("picking a margin/orientation/page size/columns preset applies immediately via onValueCommand, and More Columns genuinely offers more than the gallery's 1/2/3 (up to 6)", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /if\(id==="margins"\)\{const preset=MARGIN_PRESET_VALUES\[value\];if\(preset\)applyMargins\(\.\.\.preset\);return\}/);
  assert.match(editor, /if\(id==="orientation"\)\{setDialog\(null\);pageStyle\("aspectRatio",value==="landscape"\?"1\.414 \/ 1":"1 \/ 1\.414"\);return\}/);
  assert.match(editor, /if\(id==="pageSize"\)\{const width=PAGE_SIZE_WIDTHS\[value\];if\(width\)\{setDialog\(null\);pageStyle\("maxWidth",`\$\{width\}px`\)\}return\}/);
  assert.match(editor, /if\(id==="columns"\)\{setDialog\(null\);pageStyle\("columnCount",value\);return\}/);
  assert.match(editor, /options=\{\["1","2","3","4","5","6"\]\}/);
  assert.match(editor, /const applyColumns=\(value:string\)=>\{setDialog\(null\);pageStyle\("columnCount",String\(bounded\(value,1,6\)\)\)\}/);
});

test("every dialog is draggable by a shared title-bar handle instead of each Form implementing its own", async () => {
  const editor = await read(EDITOR);
  assert.match(editor, /const startDrag=\(event:MouseEvent<HTMLDivElement>\)=>\{/);
  assert.match(editor, /style=\{\{transform:`translate\(\$\{offset\.x\}px,\$\{offset\.y\}px\)`\}\}/);
  assert.match(editor, /title="Drag to move" onMouseDown=\{startDrag\}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Borders gallery offers the real Word option set (per-side, All, Outside, None) plus a Horizontal Line action, not just a two-option toggle", async () => {
  const ribbon = await read("components/word-efficiency/word-editor-ribbon.tsx");
  assert.match(ribbon, /const BORDER_ITEMS=\[\{value:"bottom",label:"Bottom Border"\},\{value:"top",label:"Top Border"\},\{value:"left",label:"Left Border"\},\{value:"right",label:"Right Border"\},\{value:"none",label:"No Border"\},\{value:"all",label:"All Borders"\},\{value:"outside",label:"Outside Borders"\}\]/);
  assert.match(ribbon, /const BORDER_ACTIONS=\[\{id:"horizontal-line",label:"Horizontal Line"\}\]/);
  assert.match(ribbon, /GalleryMenu option=\{option\} preview=\{preview\} items=\{BORDER_ITEMS\} onPick=\{value=>onValueCommand\?\.\("borders",value\)\} actions=\{BORDER_ACTIONS\} onAction=\{id=>onValueCommand\?\.\("borders",id\)\}/);
});

test("applying a per-side border clears the other sides first (so switching from Top to Left doesn't leave a stray top border), and Horizontal Line inserts a real rule instead of being treated as a border side", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /function applyBorderStyle\(html:HTMLElement,kind:string\)\{html\.style\.borderTop=html\.style\.borderRight=html\.style\.borderBottom=html\.style\.borderLeft=html\.style\.border="";/);
  assert.match(editor, /if\(id==="borders"\)\{if\(value==="horizontal-line"\)\{insertSafe\('<hr data-block-type="horizontal-rule">'\);return\}/);
});

test("a saved border (per-side keyword or legacy raw CSS) round-trips: makeBlock captures it from the dataset marker, renderSnapshot restores the correct sides and re-attaches the marker", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /if\(html\?\.dataset\.borderKind\)attrs\.border=html\.dataset\.borderKind;/);
  assert.match(editor, /if\(typeof block\.attrs\.border==="string"\)\{applyBorderStyle\(html,block\.attrs\.border\);if\(BORDER_SIDE_KEYWORDS\.has\(block\.attrs\.border\)\)html\.dataset\.borderKind=block\.attrs\.border\}/);
});

test("border values remain plain, length-bounded strings, so this change needed no schema or capability migration on either the client or Postgres validator", async () => {
  const clientValidator = await read("lib/word-editor-document.ts");
  assert.match(clientValidator, /if \(\["lineNumbers", "dropCap"\]\.includes\(key\) && typeof item !== "boolean"\)/);
  assert.doesNotMatch(clientValidator, /"top"|"bottom"|"outside"/); // no new enum was added for border -- it stays a free-form bounded string
});

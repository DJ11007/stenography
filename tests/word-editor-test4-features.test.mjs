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

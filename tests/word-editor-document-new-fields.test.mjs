import assert from "node:assert/strict";
import test from "node:test";
import { validateWordEditorDocument } from "../lib/word-editor-document.ts";

// Regression coverage for a real production incident: the Postgres schema
// validator (assert_word_efficiency_document_schema) was updated to accept
// smallCaps/allCaps/hidden run fields, specialIndentMode/specialIndentAmount
// paragraph attrs, tableLayout table attrs, and compound
// "page-number|position|alignment" field values -- but the CLIENT-SIDE
// mirror in lib/word-editor-document.ts (validateWordEditorDocument, which
// runs before every autosave/submit network call even reaches the server)
// was never updated to match. Every real student's autosave/submit failed
// immediately, client-side, the moment their document contained any of
// these new fields -- which happens on every save once the ribbon exposes
// them, i.e. always, for every test. These tests exist so that gap can
// never reopen silently.

const run = (overrides = {}) => ({ text: "Hello", bold: false, italic: false, underline: false, strike: false, superscript: false, subscript: false, fontFamily: null, fontSize: null, color: null, highlight: null, doubleStrike: false, href: null, bookmark: null, field: null, ...overrides });
const pageLayout = { padding: null, maxWidth: null, aspectRatio: null, columnCount: null, backgroundColor: null, border: null, watermark: null };
const doc = (blocks, overrides = {}) => ({ schemaVersion: "2", blocks, pageLayout, operations: [], savedAt: new Date().toISOString(), ...overrides });
const paragraph = (attrs = {}) => ({ id: "block-0", type: "paragraph", alignment: "left", runs: [run()], attrs: { lineNumbers: false, dropCap: false, ...attrs } });

test("a document is valid whether or not runs carry smallCaps/allCaps/hidden at all (they are optional)", () => {
  assert.doesNotThrow(() => validateWordEditorDocument(doc([paragraph()])));
  assert.doesNotThrow(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ smallCaps: true, allCaps: false, hidden: false })] }])));
});

test("a non-boolean smallCaps/allCaps/hidden value is rejected", () => {
  assert.throws(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ smallCaps: "yes" })] }])), /mark/i);
  assert.throws(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ hidden: 1 })] }])), /mark/i);
});

test("a paragraph's specialIndentMode/specialIndentAmount attrs are accepted when valid and rejected when the mode is unknown", () => {
  assert.doesNotThrow(() => validateWordEditorDocument(doc([paragraph({ specialIndentMode: "hanging", specialIndentAmount: "0.5in" })])));
  assert.doesNotThrow(() => validateWordEditorDocument(doc([paragraph({ specialIndentMode: "none" })])));
  assert.throws(() => validateWordEditorDocument(doc([paragraph({ specialIndentMode: "sideways" })])), /special indent/i);
});

test("a table's tableLayout attr is accepted from the enum and rejected otherwise", () => {
  const table = (tableLayout) => ({ id: "block-0", type: "table", alignment: "left", runs: [run()], attrs: { rows: [["A"]], ...(tableLayout ? { tableLayout } : {}) } });
  assert.doesNotThrow(() => validateWordEditorDocument(doc([table("fixed")])));
  assert.doesNotThrow(() => validateWordEditorDocument(doc([table(undefined)])));
  assert.throws(() => validateWordEditorDocument(doc([table("stretched")])), /table layout/i);
});

test("a page-number field encoding position and alignment is accepted, and an unknown position is rejected", () => {
  assert.doesNotThrow(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ field: "page-number|bottom|center" })] }])));
  assert.doesNotThrow(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ field: "page-number" })] }])));
  assert.throws(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ field: "page-number|sideways|center" })] }])), /field/i);
});

test("a real document built by the current editor (every new field present, matching what toSnapshot now actually produces) validates end to end", () => {
  const realistic = doc([
    { id: "block-0", type: "paragraph", alignment: "center", runs: [run({ bold: true, smallCaps: true })], attrs: { lineNumbers: false, dropCap: false, specialIndentMode: "firstLine", specialIndentAmount: "0.5in" } },
    { id: "block-1", type: "table", alignment: "left", runs: [run({ text: "" })], attrs: { rows: [["A", "B"], ["C", "D"]], tableLayout: "auto" } },
    { id: "block-2", type: "paragraph", alignment: "left", runs: [run({ field: "page-number|bottom|center", text: "" }), run({ hidden: true, allCaps: true })], attrs: { lineNumbers: false, dropCap: false } },
  ]);
  assert.doesNotThrow(() => validateWordEditorDocument(realistic));
});

test("a document is valid whether or not runs carry outline/emboss at all (they are optional, same as smallCaps/allCaps/hidden)", () => {
  assert.doesNotThrow(() => validateWordEditorDocument(doc([paragraph()])));
  assert.doesNotThrow(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ outline: true, emboss: false })] }])));
});

test("a non-boolean outline/emboss value is rejected", () => {
  assert.throws(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ outline: "yes" })] }])), /mark/i);
  assert.throws(() => validateWordEditorDocument(doc([{ ...paragraph(), runs: [run({ emboss: 1 })] }])), /mark/i);
});

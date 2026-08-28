import assert from "node:assert/strict";
import test from "node:test";
import { diffWordDocuments } from "../lib/word-document-diff.ts";

function doc(blocks, pageLayout = {}) {
  return { schemaVersion: "2", blocks, pageLayout, operations: [], savedAt: new Date().toISOString() };
}
function paragraph(id, text, extra = {}) {
  return { id, type: "paragraph", alignment: "left", runs: [{ text, bold: false, italic: false, underline: false }], attrs: {}, ...extra };
}

test("no changes between an identical before/after produces an empty diff", () => {
  const before = doc([paragraph("block-0", "Hello")]);
  const after = doc([paragraph("block-0", "Hello")]);
  assert.deepEqual(diffWordDocuments(before, after), []);
});

test("a single run-level formatting change (bold) is detected with the right target and value", () => {
  const before = doc([paragraph("block-6", "Hello")]);
  const after = doc([{ ...paragraph("block-6", "Hello"), runs: [{ text: "Hello", bold: true, italic: false, underline: false }] }]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.block-6.runs.0.bold");
  assert.equal(changes[0].expectedValue, true);
  assert.match(changes[0].label, /Paragraph 1/);
});

test("multiple simultaneous formatting changes on one paragraph are all detected independently", () => {
  const before = doc([paragraph("block-6", "Hello")]);
  const after = doc([{ ...paragraph("block-6", "Hello"), runs: [{ text: "Hello", bold: true, italic: true, underline: true }] }]);
  const changes = diffWordDocuments(before, after);
  const targets = changes.map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.block-6.runs.0.bold", "blocks.block-6.runs.0.italic", "blocks.block-6.runs.0.underline"]);
});

test("a text replacement inside a run is detected as a text change", () => {
  const before = doc([paragraph("block-3", "Gandhi")]);
  const after = doc([paragraph("block-3", "Patel")]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.block-3.runs.0.text");
  assert.equal(changes[0].expectedValue, "Patel");
});

test("paragraph alignment and attrs (margins, shading) changes are detected", () => {
  const before = doc([{ ...paragraph("block-1", "Hello"), attrs: { marginLeft: "0in" } }]);
  const after = doc([{ ...paragraph("block-1", "Hello"), alignment: "center", attrs: { marginLeft: "1.23in" } }]);
  const changes = diffWordDocuments(before, after);
  const targets = changes.map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.block-1.alignment", "blocks.block-1.attrs.marginLeft"]);
});

test("a table cell text edit is detected by row/column position, without disturbing unrelated cells", () => {
  const table = (rows) => ({ id: "block-9", type: "table", alignment: "left", runs: [], attrs: { rows } });
  const before = doc([table([["A", "B"], ["C", "D"]])]);
  const after = doc([table([["A", "B"], ["C", "Patel"]])]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.block-9.attrs.rows.1.1");
  assert.equal(changes[0].expectedValue, "Patel");
});

test("a table with a different row count is reported as one whole-table change instead of misaligned cells", () => {
  const table = (rows) => ({ id: "block-9", type: "table", alignment: "left", runs: [], attrs: { rows } });
  const before = doc([table([["A", "B"]])]);
  const after = doc([table([["A", "B"], ["New", "Row"]])]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.block-9.attrs.rows");
});

test("a paragraph whose run count changed (a sentence was split into multiple runs) is reported as one block-level change, not misleading per-index diffs", () => {
  const before = doc([paragraph("block-2", "Hello world")]);
  const after = doc([{ ...paragraph("block-2", "Hello world"), runs: [{ text: "Hello ", bold: false, italic: false, underline: false }, { text: "world", bold: true, italic: false, underline: false }] }]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.block-2.runs");
});

test("page layout changes (e.g. margins) are detected under the pageLayout namespace", () => {
  const before = doc([paragraph("block-0", "Hello")], { padding: "20mm 20mm 20mm 20mm" });
  const after = doc([paragraph("block-0", "Hello")], { padding: "10mm 10mm 10mm 10mm" });
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "pageLayout.padding");
});

test("a change to only one of several paragraphs reports just that paragraph, with the correct 1-based position", () => {
  const before = doc([paragraph("block-0", "One"), paragraph("block-1", "Two"), paragraph("block-2", "Three")]);
  const after = doc([paragraph("block-0", "One"), { ...paragraph("block-1", "Two"), alignment: "center" }, paragraph("block-2", "Three")]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].blockPosition, 2);
  assert.match(changes[0].label, /Paragraph 2/);
});

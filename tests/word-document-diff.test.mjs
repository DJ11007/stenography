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
  assert.equal(changes[0].target, "blocks.0.runs.0.bold");
  assert.equal(changes[0].expectedValue, true);
  assert.match(changes[0].label, /Paragraph 1/);
});

test("multiple simultaneous formatting changes on one paragraph are all detected independently", () => {
  const before = doc([paragraph("block-6", "Hello")]);
  const after = doc([{ ...paragraph("block-6", "Hello"), runs: [{ text: "Hello", bold: true, italic: true, underline: true }] }]);
  const changes = diffWordDocuments(before, after);
  const targets = changes.map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.0.runs.0.bold", "blocks.0.runs.0.italic", "blocks.0.runs.0.underline"]);
});

test("a text replacement inside a run is detected as a text change", () => {
  const before = doc([paragraph("block-3", "Gandhi")]);
  const after = doc([paragraph("block-3", "Patel")]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.0.runs.0.text");
  assert.equal(changes[0].expectedValue, "Patel");
});

test("paragraph alignment and attrs (margins, shading) changes are detected", () => {
  const before = doc([{ ...paragraph("block-1", "Hello"), attrs: { marginLeft: "0in" } }]);
  const after = doc([{ ...paragraph("block-1", "Hello"), alignment: "center", attrs: { marginLeft: "1.23in" } }]);
  const changes = diffWordDocuments(before, after);
  const targets = changes.map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.0.alignment", "blocks.0.attrs.marginLeft"]);
});

test("a table cell text edit is detected by row/column position, without disturbing unrelated cells", () => {
  const table = (rows) => ({ id: "block-9", type: "table", alignment: "left", runs: [], attrs: { rows } });
  const before = doc([table([["A", "B"], ["C", "D"]])]);
  const after = doc([table([["A", "B"], ["C", "Patel"]])]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.0.attrs.rows.1.1");
  assert.equal(changes[0].expectedValue, "Patel");
});

test("a table with a different row count is reported as one whole-table change instead of misaligned cells", () => {
  const table = (rows) => ({ id: "block-9", type: "table", alignment: "left", runs: [], attrs: { rows } });
  const before = doc([table([["A", "B"]])]);
  const after = doc([table([["A", "B"], ["New", "Row"]])]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "blocks.0.attrs.rows");
});

test("a paragraph whose run count changed (formatting only part of it) is compared run by run against its earlier formatting, numbered among the runs that carry text", () => {
  const before = doc([paragraph("block-2", "Hello world")]);
  const after = doc([{ ...paragraph("block-2", "Hello world"), runs: [{ text: "", bold: false, italic: false, underline: false }, { text: "Hello ", bold: false, italic: false, underline: false }, { text: "world", bold: true, italic: false, underline: false }] }]);
  const changes = diffWordDocuments(before, after);
  assert.deepEqual(changes.map((change) => [change.target, change.expectedValue]), [["blocks.0.runs.1.bold", true]]);
});

// Real reported bug: the saved Model Answer of a live test had four stray
// empty paragraphs, and ids are just "block-<position>", so pairing by id
// matched every later paragraph with the wrong one (one question carried 52
// criteria, and every rule pointed at the wrong paragraph).
test("blank paragraphs never shift which paragraph a change belongs to, on either side", () => {
  const blank = (id) => paragraph(id, "");
  const before = doc([paragraph("matter-p-1", "One"), paragraph("matter-p-2", "Two")]);
  const after = doc([blank("block-0"), paragraph("block-1", "One"), blank("block-2"), { ...paragraph("block-3", "Two"), runs: [{ text: "Two", bold: true, italic: false, underline: false }] }]);
  assert.deepEqual(diffWordDocuments(before, after).map((change) => change.target), ["blocks.1.runs.0.bold"]);
});

test("a paragraph turned into a list item is addressed by position, never by block id", () => {
  const before = doc([paragraph("block-10", "maths")]);
  const after = doc([{ ...paragraph("block-10", "maths"), type: "list-item", attrs: { listStyle: "upper-roman" } }]);
  assert.deepEqual(diffWordDocuments(before, after).map((change) => change.target).sort(), ["blocks.0.attrs.listStyle", "blocks.0.type"]);
});

test("attrs the editor merely dropped, or zero indents written as \"0pt\", are not changes", () => {
  const before = doc([{ ...paragraph("block-0", "One"), attrs: { lineHeight: "1.15", marginLeft: "0pt" } }]);
  const after = doc([{ ...paragraph("block-0", "One"), attrs: { marginRight: "0pt" } }]);
  assert.deepEqual(diffWordDocuments(before, after), []);
});

test("a text change records whether it was a letter-case change only", () => {
  const caseChange = diffWordDocuments(doc([paragraph("b", "hello world")]), doc([paragraph("b", "Hello World")]))[0];
  const wording = diffWordDocuments(doc([paragraph("b", "hello world")]), doc([paragraph("b", "hello there")]))[0];
  assert.equal(caseChange.caseOnly, true);
  assert.equal(wording.caseOnly, false);
});

test("page layout changes (e.g. margins) are detected under the pageLayout namespace", () => {
  const before = doc([paragraph("block-0", "Hello")], { padding: "20mm 20mm 20mm 20mm" });
  const after = doc([paragraph("block-0", "Hello")], { padding: "10mm 10mm 10mm 10mm" });
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].target, "pageLayout.padding");
});

test("a run missing the newer optional boolean fields (smallCaps/allCaps/hidden) entirely is NOT reported as different from a run that has them explicitly false -- missing means off, same as the schema validator's rule", () => {
  const before = doc([{ id: "block-0", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: false, italic: false, underline: false }], attrs: {} }]);
  const after = doc([{ id: "block-0", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: false, italic: false, underline: false, smallCaps: false, allCaps: false, hidden: false }], attrs: {} }]);
  assert.deepEqual(diffWordDocuments(before, after), []);
  assert.deepEqual(diffWordDocuments(after, before), []);
});

test("small caps, all caps, and hidden run changes are each detected independently", () => {
  const before = doc([paragraph("block-0", "Hello")]);
  const after = doc([{ ...paragraph("block-0", "Hello"), runs: [{ text: "Hello", bold: false, italic: false, underline: false, smallCaps: true, allCaps: true, hidden: true }] }]);
  const targets = diffWordDocuments(before, after).map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.0.runs.0.allCaps", "blocks.0.runs.0.hidden", "blocks.0.runs.0.smallCaps"]);
});

test("a run missing outline/emboss entirely is NOT reported as different from a run that has them explicitly false, same as smallCaps/allCaps/hidden", () => {
  const before = doc([{ id: "block-0", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: false, italic: false, underline: false }], attrs: {} }]);
  const after = doc([{ id: "block-0", type: "paragraph", alignment: "left", runs: [{ text: "Hello", bold: false, italic: false, underline: false, outline: false, emboss: false }], attrs: {} }]);
  assert.deepEqual(diffWordDocuments(before, after), []);
  assert.deepEqual(diffWordDocuments(after, before), []);
});

test("outline and emboss run changes are each detected independently with readable labels", () => {
  const before = doc([paragraph("block-0", "Hello")]);
  const after = doc([{ ...paragraph("block-0", "Hello"), runs: [{ text: "Hello", bold: false, italic: false, underline: false, outline: true, emboss: true }] }]);
  const changes = diffWordDocuments(before, after);
  const targets = changes.map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.0.runs.0.emboss", "blocks.0.runs.0.outline"]);
  assert.ok(changes.some((change) => change.target.endsWith(".outline") && /outline/i.test(change.label)));
  assert.ok(changes.some((change) => change.target.endsWith(".emboss") && /emboss/i.test(change.label)));
});

test("a paragraph's special indent (mode and amount) is detected as an attrs change", () => {
  const before = doc([{ ...paragraph("block-1", "Hello"), attrs: {} }]);
  const after = doc([{ ...paragraph("block-1", "Hello"), attrs: { specialIndentMode: "hanging", specialIndentAmount: "0.5in" } }]);
  const targets = diffWordDocuments(before, after).map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.0.attrs.specialIndentAmount", "blocks.0.attrs.specialIndentMode"]);
});

test("a table's AutoFit (tableLayout) change is detected alongside, not instead of, cell edits", () => {
  const table = (rows, tableLayout) => ({ id: "block-9", type: "table", alignment: "left", runs: [], attrs: { rows, ...(tableLayout ? { tableLayout } : {}) } });
  const before = doc([table([["A", "B"]], "fixed")]);
  const after = doc([table([["A", "Changed"]], "auto")]);
  const changes = diffWordDocuments(before, after);
  const targets = changes.map((change) => change.target).sort();
  assert.deepEqual(targets, ["blocks.0.attrs.rows.0.1", "blocks.0.attrs.tableLayout"]);
});

test("a change to only one of several paragraphs reports just that paragraph, with the correct 1-based position", () => {
  const before = doc([paragraph("block-0", "One"), paragraph("block-1", "Two"), paragraph("block-2", "Three")]);
  const after = doc([paragraph("block-0", "One"), { ...paragraph("block-1", "Two"), alignment: "center" }, paragraph("block-2", "Three")]);
  const changes = diffWordDocuments(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].blockPosition, 2);
  assert.match(changes[0].label, /Paragraph 2/);
});

// Real bug (commit 00ad78b): targets used to embed the block's id, but ids are
// assigned fresh per snapshot, so an admin's model answer and a student's
// attempt never agreed on them and auto-grading always scored 0. Targets now
// address a paragraph by array position, so differing ids must not matter.
test("a paragraph's target is its array position, identical whatever ids the two snapshots happen to carry", () => {
  const model = diffWordDocuments(
    doc([paragraph("matter-p-1", "One"), paragraph("matter-p-2", "Two")]),
    doc([paragraph("matter-p-1", "One"), { ...paragraph("matter-p-2", "Two"), runs: [{ text: "Two", bold: true, italic: false, underline: false }] }]),
  );
  const student = diffWordDocuments(
    doc([paragraph("block-0", "One"), paragraph("block-1", "Two")]),
    doc([paragraph("block-0", "One"), { ...paragraph("block-1", "Two"), runs: [{ text: "Two", bold: true, italic: false, underline: false }] }]),
  );
  assert.deepEqual(model.map((change) => change.target), ["blocks.1.runs.0.bold"]);
  assert.deepEqual(student.map((change) => change.target), model.map((change) => change.target));
});

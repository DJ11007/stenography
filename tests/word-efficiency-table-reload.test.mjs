import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// A reopened attempt (autosave, refresh, model answer) must keep its table cell formats: renderSnapshot builds
// tables with renderTableAttrs, and renderStructuredSnapshot must not rebuild them from the cell text only.
test("reopening a saved Word document keeps table cell formatting", async () => {
  const editor = await readFile("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", "utf8");
  const structured = editor.slice(editor.indexOf("function renderStructuredSnapshot"), editor.indexOf("function originalMeasurements"));
  assert.match(structured, /\["paragraph","list-item","page-break","table"\]\.includes\(block\.type\)\)\{const current=editor\.children\[index\]/);
  const snapshot = editor.slice(editor.indexOf("function renderSnapshot"), editor.indexOf("function renderStructuredSnapshot"));
  assert.match(snapshot, /renderTableAttrs\(element as HTMLTableElement,block\.attrs\)/);
});

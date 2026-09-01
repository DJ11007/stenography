import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { diffWordDocuments } from "../lib/word-document-diff.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the static (pre-edit) Run component prefixes highlight with # like it already does for color, instead of passing a bare hex string straight through as an unpredictable raw CSS value", async () => {
  const editor = await read("app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx");
  assert.match(editor, /backgroundColor:run\.highlight\?`#\$\{run\.highlight\}`:undefined/);
  assert.doesNotMatch(editor, /backgroundColor:run\.highlight\?\?undefined/);
});

// diffWordDocuments() itself has no application caller any more -- its only
// consumer, the admin Model Answer page, was removed at the admin's
// request (see tests/word-efficiency-model-answer-admin.test.mjs). The
// function is left in lib/word-document-diff.ts (harmless, dead until
// something calls it again), so these two regression tests for its own
// correctness stay valid and cheap to keep.
test("a run-level document diff includes a short text snippet so two different runs in the same paragraph with the same field change don't look like an identical duplicate", () => {
  const before = { schemaVersion: "2", blocks: [{ id: "b1", type: "paragraph", alignment: "left", runs: [{ text: "hello ", fontSize: null }, { text: "world", fontSize: null }], attrs: {} }] };
  const after = { schemaVersion: "2", blocks: [{ id: "b1", type: "paragraph", alignment: "left", runs: [{ text: "hello ", fontSize: 16 }, { text: "world", fontSize: 16 }], attrs: {} }] };
  const changes = diffWordDocuments(before, after);
  const labels = changes.map((change) => change.label);
  assert.equal(new Set(labels).size, labels.length, `expected every label to be distinct, got: ${labels.join(" | ")}`);
  assert.ok(labels.some((label) => label.includes("hello")));
  assert.ok(labels.some((label) => label.includes("world")));
});

test("a text-field change is not double-quoted (no redundant snippet alongside the already-quoted new text)", () => {
  const before = { schemaVersion: "2", blocks: [{ id: "b1", type: "paragraph", alignment: "left", runs: [{ text: "old" }], attrs: {} }] };
  const after = { schemaVersion: "2", blocks: [{ id: "b1", type: "paragraph", alignment: "left", runs: [{ text: "new" }], attrs: {} }] };
  const changes = diffWordDocuments(before, after);
  const textChange = changes.find((change) => change.target.endsWith(".text"));
  assert.ok(textChange);
  assert.equal(textChange.label, 'Paragraph 1: text changed to "new"');
});

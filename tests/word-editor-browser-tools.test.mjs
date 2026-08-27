import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { sortSelectedBlocks } from "../lib/word-editor-browser-tools.ts";

function documentWithMatter() {
  const window = new Window(), document = window.document;
  document.body.innerHTML = '<div id="editor"><p id="p1">Charlie</p><p id="p2">Alpha</p><p id="p3">Bravo</p><p id="p4">Delta</p></div>';
  return { document, editor: document.querySelector("#editor") };
}

test("with no meaningful selection, sort orders the whole document ascending", () => {
  const { document, editor } = documentWithMatter();
  sortSelectedBlocks(editor, [], "asc");
  assert.deepEqual([...editor.children].map((block) => block.textContent), ["Alpha", "Bravo", "Charlie", "Delta"]);
  assert.equal(document.querySelectorAll("p").length, 4);
});

test("descending sort reverses the whole-document order", () => {
  const { editor } = documentWithMatter();
  sortSelectedBlocks(editor, [], "desc");
  assert.deepEqual([...editor.children].map((block) => block.textContent), ["Delta", "Charlie", "Bravo", "Alpha"]);
});

test("with a real multi-block selection, only the selected blocks reorder into their own slots and untouched blocks keep their position", () => {
  const { document, editor } = documentWithMatter();
  const selected = [document.querySelector("#p1"), document.querySelector("#p3")];
  sortSelectedBlocks(editor, selected, "asc");
  // p1 (Charlie) and p3 (Bravo) occupy slots 0 and 2; sorted ascending that's Bravo then Charlie, so p3 moves into slot 0 and p1 into slot 2.
  assert.deepEqual([...editor.children].map((block) => block.id), ["p3", "p2", "p1", "p4"]);
  assert.deepEqual([...editor.children].map((block) => block.textContent), ["Bravo", "Alpha", "Charlie", "Delta"]);
});

test("a single selected block is treated as no real selection and sorts the whole document", () => {
  const { editor } = documentWithMatter();
  sortSelectedBlocks(editor, [editor.querySelector("#p2")], "asc");
  assert.deepEqual([...editor.children].map((block) => block.textContent), ["Alpha", "Bravo", "Charlie", "Delta"]);
});

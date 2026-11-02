import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// Real report (English EFFICIENCY TEST 1, Q11 "Change paragraph no. 7 in toggle case"): after a triple-click and
// Toggle Case the whole paragraph was changed, but only part of it stayed selected. Rewriting a text node moves any
// live range edge inside it to the node's start, and the selection was rebuilt from those moved edges.
const window = new Window();
globalThis.document = window.document;
const { changeEditorRangeCase } = await import("../lib/word-editor-dom.ts");

function paragraph() {
  const p = document.createElement("p");
  p.innerHTML = '<span>Every teacher happily organised </span><span style="font-weight:bold">SAMRADHI CLASSES</span><span> winter exhibition. Most families arrived.</span>';
  document.body.replaceChildren(p);
  return p;
}

for (const mode of ["toggle", "upper", "lower", "title", "sentence"]) {
  test(`${mode} case: the whole selected paragraph stays selected, and every run keeps its formatting`, () => {
    const p = paragraph();
    const runs = [...p.querySelectorAll("span")];
    const range = document.createRange();
    range.setStart(runs[0].firstChild, 0);
    range.setEnd(runs[2].firstChild, runs[2].firstChild.textContent.length);
    const before = range.toString();
    const selected = changeEditorRangeCase(range, mode);
    assert.equal(selected.toString(), p.textContent, "the selection still covers the whole paragraph");
    assert.equal(selected.toString().length, before.length);
    assert.equal(p.querySelectorAll("span").length, 3, "the runs are kept");
    assert.equal(p.querySelector('span[style*="bold"]').textContent.length, "SAMRADHI CLASSES".length);
  });
}

test("toggle case swaps every letter's case", () => {
  const p = paragraph();
  const range = document.createRange();
  range.selectNodeContents(p);
  changeEditorRangeCase(range, "toggle");
  assert.equal(p.textContent, "eVERY TEACHER HAPPILY ORGANISED samradhi classes WINTER EXHIBITION. mOST FAMILIES ARRIVED.");
});

test("a selection ending part-way through a run keeps exactly that end", () => {
  const p = paragraph();
  const last = p.querySelectorAll("span")[2].firstChild;
  const range = document.createRange();
  range.setStart(p.querySelector("span").firstChild, 6);
  range.setEnd(last, 7);
  const selected = changeEditorRangeCase(range, "upper");
  assert.equal(selected.toString(), "TEACHER HAPPILY ORGANISED SAMRADHI CLASSES WINTER");
});

test("the selection's ends are kept before any text node is rewritten (real browsers move live range edges)", async () => {
  // happy-dom does not move live ranges when text changes, so the bug only shows in a real browser (verified in
  // Chromium: the old code left "eVERY TEACHER HAPPILY ORGANISED samradhi classes" selected). This checks the fix.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../lib/word-editor-dom.ts", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("function replaceEditorRangeTextPreservingRuns"), source.indexOf("export function clearEditorRangeFormatting"));
  assert.ok(body.indexOf("const startContainer=range.startContainer,startOffset=range.startOffset,endContainer=range.endContainer,endOffset=range.endOffset;") < body.indexOf("node.textContent="));
  assert.match(body, /selected\.setStart\(startContainer,startOffset\);\s*selected\.setEnd\(endContainer,endOffset\);/);
  assert.doesNotMatch(body, /selected\.set(Start|End)\(range\./);
});

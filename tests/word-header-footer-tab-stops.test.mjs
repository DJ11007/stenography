import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";
import { caretInPosition, emptyPositionAt, ensureHeaderFooterMarkers, headerFooterPositions, mergeHeaderFooterPositions, restoreHeaderFooterTabs, typeInPosition } from "../lib/word-header-footer-tabs.ts";

// Header/footer lines are laid out in Word's three tab positions (left, centre, right). Tab moves between them; a
// typed character must land in the position the cursor is in; Backspace at the start of a position (Delete at the
// end of one) deletes the tab before (after) it, so the text moves back to the previous tab stop, as in Word.
// The real browser behaviour (where Chrome puts the cursor) was checked by hand in the Word editor; this pins the
// document changes themselves.

const ZONE = (align, text = "") => `<span style="display:inline-block;width:33%${align ? `;text-align:${align}` : ""}">${text}</span>`;
function line(left, mid, right, tag = "header") {
  const window = new Window(), document = window.document;
  document.body.innerHTML = `<div id="page"><${tag}>${ZONE("", left)}${ZONE("center", mid)}${ZONE("right", right)}</${tag}></div>`;
  const area = document.querySelector(tag);
  ensureHeaderFooterMarkers(area);
  return { document, area, zones: headerFooterPositions(area) };
}
const texts = (zones) => zones.map((zone) => (zone.textContent ?? ""));
const caretAt = (document, node, offset) => { const range = document.createRange(); range.setStart(node, offset); range.collapse(true); return range; };
const startOf = (document, zone) => { const text = [...zone.childNodes].find((node) => node.nodeType === 3); return caretAt(document, text ?? zone, 0); };
const endOf = (document, zone) => { const text = [...zone.childNodes].reverse().find((node) => node.nodeType === 3); return caretAt(document, text ?? zone, text ? text.length : zone.childNodes.length); };

test("the centre and right positions get an invisible tab marker, the left one never, and nothing is added twice", () => {
  const { area, zones } = line("Left", "Mid", "Right");
  assert.equal(area.querySelectorAll("[data-hf-tab]").length, 2);
  assert.equal(zones[0].querySelector("[data-hf-tab]"), null);
  assert.ok(zones[1].firstChild.hasAttribute("data-hf-tab") && zones[2].firstChild.hasAttribute("data-hf-tab"));
  ensureHeaderFooterMarkers(area);
  assert.equal(area.querySelectorAll("[data-hf-tab]").length, 2);
  assert.deepEqual(texts(zones), ["Left", "Mid", "Right"], "a marker holds no text, so it is never saved");
  zones[1].firstChild.remove();
  ensureHeaderFooterMarkers(area);
  assert.equal(area.querySelectorAll("[data-hf-tab]").length, 2, "a removed marker is put back");
});

test("Backspace at the start of the right-hand text moves it to the centre stop, as deleting the tab does in Word", () => {
  const { document, zones, area } = line("Left", "Mid", "Right");
  const caret = mergeHeaderFooterPositions(area, startOf(document, zones[2]), false);
  assert.ok(caret);
  assert.deepEqual(texts(zones), ["Left", "MidRight", ""]);
  assert.ok(zones[2].querySelector("br"), "the emptied position keeps a line");
  assert.equal(caret.startContainer, zones[1]);
  assert.equal(zones[1].childNodes[caret.startOffset - 1].textContent, "Mid", "the cursor is between Mid and Right");
});

test("Backspace at the start of the centre text moves everything after it up one stop: A⇥B⇥C becomes AB⇥C", () => {
  const { document, zones, area } = line("A", "B", "C");
  mergeHeaderFooterPositions(area, startOf(document, zones[1]), false);
  assert.deepEqual(texts(zones), ["AB", "C", ""]);
});

test("Backspace at the start of an empty position, and Delete at the end of the position before, delete the tab too", () => {
  const empty = line("Left", "", "Right");
  mergeHeaderFooterPositions(empty.area, caretInPosition(empty.zones[1]), false);
  assert.deepEqual(texts(empty.zones), ["Left", "Right", ""]);
  const forward = line("Left", "Mid", "Right");
  const caret = mergeHeaderFooterPositions(forward.area, endOf(forward.document, forward.zones[0]), true);
  assert.ok(caret);
  assert.deepEqual(texts(forward.zones), ["LeftMid", "Right", ""]);
});

test("in the middle of a position, at the very start of the line, or with a selection, nothing special happens", () => {
  const { document, zones, area } = line("Left", "Mid", "Right");
  assert.equal(mergeHeaderFooterPositions(area, caretAt(document, zones[2].childNodes[1], 2), false), null, "inside Right");
  assert.equal(mergeHeaderFooterPositions(area, startOf(document, zones[0]), false), null, "start of the line: no tab before it");
  assert.equal(mergeHeaderFooterPositions(area, endOf(document, zones[2]), true), null, "end of the line: no tab after it");
  const selection = document.createRange(); selection.selectNodeContents(zones[1]);
  assert.equal(mergeHeaderFooterPositions(area, selection, false), null);
  assert.deepEqual(texts(zones), ["Left", "Mid", "Right"], "unchanged");
});

test("a Blank (Three Columns) design keeps its [Type text] placeholders: Backspace is left to the placeholder handling", () => {
  const { document, zones, area } = line("Left", "Mid", "Right");
  zones[2].lastChild.replaceWith(Object.assign(document.createElement("span"), { textContent: "[Type text]" }));
  zones[2].lastChild.setAttribute("data-placeholder", "");
  assert.equal(mergeHeaderFooterPositions(area, startOf(document, zones[2]), false), null);
});

test("typing into an empty position is inserted by hand (the browser would put it in the neighbouring position)", () => {
  const { document, zones } = line("Left", "", "");
  const caret = caretInPosition(zones[1]);
  assert.equal(emptyPositionAt(caret), zones[1]);
  const after = typeInPosition(zones[1], "M");
  assert.deepEqual(texts(zones), ["Left", "M", ""]);
  assert.equal(zones[1].querySelector("br"), null, "its placeholder line is gone");
  assert.equal(emptyPositionAt(after), null, "no longer empty");
  assert.equal(emptyPositionAt(startOf(document, zones[0])), null);
});

test("a saved line with tab characters comes back as three positions with their markers", () => {
  const window = new Window(), document = window.document;
  document.body.innerHTML = `<div id="page"><footer>1\t\tSAMRADHI CLASSES</footer></div>`;
  restoreHeaderFooterTabs(document.getElementById("page"));
  const zones = headerFooterPositions(document.querySelector("footer"));
  assert.deepEqual(texts(zones), ["1", "", "SAMRADHI CLASSES"]);
  assert.equal(document.querySelectorAll("[data-hf-tab]").length, 2);
});

test("the editor wires Tab, Backspace and Delete, and the first typed character, to these functions", async () => {
  const editor = await readFile(new URL("../app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /headerFooterDelete\(event\.key==="Delete"\)/);
  assert.match(editor, /mergeHeaderFooterPositions\(area,range,forward\)/);
  assert.match(editor, /const position=deleting\?null:emptyPositionAt\(range\)/);
  assert.match(editor, /typeInPosition\(position,event\.data\?\?""\)/);
  assert.match(editor, /placeInPosition\(target\)/);
  assert.match(editor, /ensureHeaderFooterMarkers\(area\)/);
});

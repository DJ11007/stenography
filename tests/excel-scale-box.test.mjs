import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseScale } from "../lib/excel-scale.ts";

const dir = new URL("../app/typing/excel-efficiency/[language]/[testId]/workspace/", import.meta.url);
const editor = readFileSync(new URL("rich-sheet-editor.tsx", dir), "utf8");
const dialogs = readFileSync(new URL("excel-dialogs.tsx", dir), "utf8");

// 23 Nov 2026: the Scale box only took values typed so that every keystroke was already 10-400 ("88" stopped at "8").
test("a typed scale is read as Excel reads it", () => {
  assert.equal(parseScale("88"), 88);
  assert.equal(parseScale("88%"), 88);
  assert.equal(parseScale(" 57 % "), 57);
  assert.equal(parseScale("72.6"), 73);
  assert.equal(parseScale("5"), 10);     // below 10% -> 10%
  assert.equal(parseScale("999%"), 400); // above 400% -> 400%
  assert.equal(parseScale("abc"), null); // not a number -> the box keeps its value
  assert.equal(parseScale(""), null);
});

test("the ribbon's Scale and Page Setup's Adjust to use the spin box (applied on Enter / leaving the box)", () => {
  assert.match(editor, /<PercentSpinBox id="xl-scale" label="Scale"/);
  assert.match(dialogs, /<PercentSpinBox label="Adjust to percent"/);
  assert.doesNotMatch(editor, /aria-label="Scale" type="number"/);
});

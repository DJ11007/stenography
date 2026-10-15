import test from "node:test";
import assert from "node:assert/strict";
import { nextWordFontSize, wordFontSize } from "../lib/word-font-sizes.ts";

test("any size from 1 to 1638 pt is accepted in half points, as in Word 2013", () => {
  for (const [typed, size] of [["1", 1], ["1.5", 1.5], ["12.5", 12.5], ["18.5", 18.5], ["1000.5", 1000.5], ["1638", 1638], ["18,5", 18.5], ["18.4", 18.5], ["18.2", 18]]) assert.equal(wordFontSize(typed), size, typed);
  for (const typed of ["0.5", "0", "1638.5", "2000", "abc", ""]) assert.equal(wordFontSize(typed), null, typed);
});

test("Grow/Shrink Font step like Word: 1 pt below 8, the list up to 72, then 10 pt, never past 1-1638", () => {
  assert.equal(nextWordFontSize(12, 1), 14);
  assert.equal(nextWordFontSize(18.5, 1), 20);
  assert.equal(nextWordFontSize(72, 1), 80);
  assert.equal(nextWordFontSize(80, 1), 90);
  assert.equal(nextWordFontSize(1630, 1), 1638);
  assert.equal(nextWordFontSize(1638, 1), 1638);
  assert.equal(nextWordFontSize(8, -1), 7);
  assert.equal(nextWordFontSize(1.5, -1), 1);
  assert.equal(nextWordFontSize(1, -1), 1);
  assert.equal(nextWordFontSize(10.5, -1), 10);
});

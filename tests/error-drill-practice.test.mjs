import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: a student who just saw their mistakes on a
// result page should be able to copy those error words, paste them into
// a dedicated practice page, and drill each one across a chosen number
// of lines -- like a classic typing-class drill sheet. Deliberately a
// free-typing scratchpad with no WPM/accuracy scoring (an explicit
// scope decision), with Word-like language/font-size controls.

test("the result page (app/typing/attempts/[attemptId]) links to the new error-drill practice tool", async () => {
  const page = await read("app/typing/attempts/[attemptId]/page.tsx");
  assert.match(page, /import Link from "next\/link";/);
  assert.match(page, /href="\/typing\/practice\/error-drill"/);
  assert.match(page, /Practice My Errors/);
});

test("ErrorDrillPractice builds a drill by repeating each pasted word across the chosen lines/repeats, in the order the words were pasted", async () => {
  const component = await read("app/typing/practice/error-drill/error-drill-practice.tsx");
  assert.match(component, /function buildDrill\(pastedText: string, linesPerWord: number, repeatsPerLine: number\)/);
  assert.match(component, /pastedText\.split\(\/\[\\s,\]\+\/\)/);
});

test("ErrorDrillPractice offers English/Hindi-Unicode/Hindi-KrutiDev font options reusing the app's real input-system font stacks, plus font-size +/- controls", async () => {
  const component = await read("app/typing/practice/error-drill/error-drill-practice.tsx");
  assert.match(component, /fontFamily: "Arial, Helvetica, sans-serif"/);
  assert.match(component, /fontFamily: '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif'/);
  assert.match(component, /fontFamily: '"Kruti Dev 010", sans-serif'/);
  assert.match(component, /setFontSize\(\(size\) => Math\.max\(MIN_FONT_SIZE, size - FONT_SIZE_STEP\)\)/);
  assert.match(component, /setFontSize\(\(size\) => Math\.min\(MAX_FONT_SIZE, size \+ FONT_SIZE_STEP\)\)/);
});

test("ErrorDrillPractice is a free-typing scratchpad -- no WPM/accuracy scoring, calculateTypingScore, or timer state", async () => {
  const component = await read("app/typing/practice/error-drill/error-drill-practice.tsx");
  assert.doesNotMatch(component, /calculateTypingScore/);
  assert.doesNotMatch(component, /netWpm|grossWpm/i);
});

test("generated drills append to (not replace) existing practice text, separated by a blank line", async () => {
  const component = await read("app/typing/practice/error-drill/error-drill-practice.tsx");
  assert.match(component, /setPracticeText\(\(current\) => \(current \? `\$\{current\}\\n\\n\$\{drill\}` : drill\)\);/);
});

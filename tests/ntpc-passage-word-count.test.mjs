import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXAM_CATEGORIES } from "../lib/exam-categories.ts";
import { repeatPassageRounds, repeatPassageToExactWordCount } from "../lib/typing-curriculum.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// 23 Nov 2026 (owner's report): in the RRB NTPC exam simulator "300" could not be typed into Passage length -- every
// keystroke was clamped to 150-700, so the first "3" became 150. RRB NTPC tests now open at 300 words; the student can
// still change it; finishing early starts the passage again from its first line and every word typed is counted.

test("RRB NTPC opens every test at 300 words; no other category sets a length", () => {
  assert.equal(EXAM_CATEGORIES.find((category) => category.slug === "rrb-ntpc")?.defaultPassageWords, 300);
  assert.deepEqual(EXAM_CATEGORIES.filter((category) => category.defaultPassageWords !== undefined).map((category) => category.slug), ["rrb-ntpc"]);
});

test("the Passage length box keeps what is typed and applies it on Enter / leaving the box", async () => {
  const source = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.match(source, /<PassageWordCountInput /);
  assert.match(source, /onChange=\{\(event\) => setDraft\(event\.target\.value\)\}/);
  assert.match(source, /onBlur=\{\(event\) => commit\(event\.target\.value\)\}/);
  assert.doesNotMatch(source, /onChange=\{\(event\) => \{ const raw = Number\(event\.target\.value\)/);
});

test("the exam uses the category's length for this test and reset returns to it", async () => {
  const source = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(source, /const chosenWordCount = categoryDefaultWords \? \(sessionWordCount === undefined \? categoryDefaultWords : sessionWordCount\) : preferences\.passageWordCount;/);
  assert.match(source, /setSessionWordCount\(value === null \? undefined : value\)/);
  assert.match(source, /passageWordCount:wordCountEditable\?chosenWordCount:null/);
  assert.match(source, /roundPassage=\{limitedPassage\}/);
});

test("a second round is the same 300 words again after a space, so the panel can restart at its first line", () => {
  const passage = Array.from({ length: 520 }, (_, index) => `w${index}`).join(" ");
  const round = repeatPassageToExactWordCount(passage, 300);
  assert.equal(round.split(" ").length, 300);
  const twoRounds = repeatPassageRounds(round, 2);
  assert.equal(twoRounds, `${round} ${round}`);
  // ExamWorkspace: roundIndex = floor(typed / (round length + 1)); the typed text at the start of round 2 is position 0.
  const roundSize = round.length + 1;
  assert.equal(Math.floor(round.length / roundSize), 0);
  assert.equal(Math.floor((round.length + 1) / roundSize), 1);
});

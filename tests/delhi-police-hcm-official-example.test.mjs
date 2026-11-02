import assert from "node:assert/strict";
import test from "node:test";
import { calculateTypingScore } from "../lib/typing-test.ts";
import { calculateSpeedBandMarks } from "../lib/typing-results.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";
import { examCategoryPresetId } from "../lib/exam-categories.ts";

// SSC's Delhi Police HCM evaluation (addendum 16.01.2023): words = strokes / 5, tentative speed = words / test
// time, each mistake costs 1 w.p.m.; example: 2000 strokes in 10 minutes = 40 w.p.m., 10 mistakes = 30 actual.
const english = getExamPreset(examCategoryPresetId("delhi-police-hcm", "English"));
const hindi = getExamPreset(examCategoryPresetId("delhi-police-hcm", "Hindi"));

test("the notification's own example: 2000 strokes, 10 mistakes, 10 minutes = 30 w.p.m. actual, 10 marks", () => {
  const passage = Array.from({ length: 400 }, (_, i) => `w${String(i).padStart(3, "0")}`).join(" ");
  const typed = passage.split(" ").map((word, i) => (i % 40 === 0 ? `x${word.slice(1)}` : word)).join(" ") + " ";
  const score = calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 600, wordMethod: english.wordMethod, scoringProfile: english.scoringProfile });
  assert.equal(score.totalCharacters, 2000);
  // A one-letter slip is filed as a spelling (half) mistake, but here a half mistake costs as much as a full one.
  assert.equal(score.analysis.fullErrors + score.analysis.halfErrors, 10);
  assert.equal(score.analysis.totalPenalty, 100);
  assert.equal(score.grossWpm, 40);
  assert.equal(score.netWpm, 30);
  const marks = calculateSpeedBandMarks(score, english.speedMarksMethod);
  assert.equal(marks.qualified, true);
  assert.equal(marks.marksObtained, 10);
});

test("a spacing, capital-letter or punctuation slip costs a full 1 w.p.m. too (no half mistakes)", () => {
  const passage = "The Delhi Police office opens at nine.";
  const score = calculateTypingScore({ typedText: "the Delhi Police office opens at nine", passage, elapsedSeconds: 600, wordMethod: english.wordMethod, scoringProfile: english.scoringProfile });
  const units = score.analysis.fullErrors * english.scoringProfile.fullErrorPenalty + score.analysis.halfErrors * english.scoringProfile.halfErrorPenalty;
  assert.equal(units, 20); // capital T + missing full stop = 2 mistakes = 2 w.p.m. over 10 minutes
});

test("Hindi: 350 words = 1750 strokes, counted per key depression; 25 w.p.m. qualifies for 10 marks", () => {
  const word = "प्रकार"; // प ् र क ा र = 6 key depressions
  assert.equal(Array.from(word).length, 6);
  const passage = Array.from({ length: 300 }, () => "प्रकार").join(" ");
  const typed = passage.split(" ").slice(0, 250).join(" ") + " "; // 250 x 7 = 1750 strokes
  const score = calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 600, wordMethod: hindi.wordMethod, scoringProfile: hindi.scoringProfile });
  assert.equal(score.totalCharacters, 1750);
  assert.equal(score.netWpm, 35);
  assert.equal(calculateSpeedBandMarks(score, hindi.speedMarksMethod).marksObtained, 15);
});

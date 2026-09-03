import assert from "node:assert/strict";
import test from "node:test";

import { EXAM_PRESETS, getExamPreset } from "../lib/typing-curriculum.ts";
import { getInputSystemPassage } from "../lib/typing-language.ts";
import { calculateConfiguredRssbMarks } from "../lib/typing-results.ts";
import { calculateTypingScore, countSpaceWords } from "../lib/typing-test.ts";

const english = EXAM_PRESETS.find((preset) => preset.id === "rssb-ldc-english");
const hindi = EXAM_PRESETS.find((preset) => preset.id === "rssb-ldc-hindi");
assert.ok(english?.marksMethod);
assert.ok(hindi?.marksMethod);

const scoreWithCorrectWords = (correct, elapsedSeconds = 600) => ({ elapsedSeconds, analysis: { counts: { correct } } });

test("RSSB preset durations and every resolved passage match the configured method", () => {
  assert.equal(english.durationSeconds, 600);
  assert.equal(hindi.durationSeconds, 600);
  assert.equal(countSpaceWords(english.passage), 500);
  assert.equal(countSpaceWords(hindi.passage), 400);
  for (const system of english.inputSystems) assert.equal(countSpaceWords(getInputSystemPassage(system, english.passage)), 500);
  for (const system of hindi.inputSystems) assert.equal(countSpaceWords(getInputSystemPassage(system, hindi.passage)), 400);
});

test("English marks boundaries use 0.05 per fully correct word", () => {
  const below = calculateConfiguredRssbMarks(scoreWithCorrectWords(179), english.marksMethod);
  const passing = calculateConfiguredRssbMarks(scoreWithCorrectWords(180), english.marksMethod);
  const maximum = calculateConfiguredRssbMarks(scoreWithCorrectWords(500), english.marksMethod);
  assert.equal(below.marksObtained, 8.95);
  assert.equal(below.qualified, false);
  assert.equal(passing.marksObtained.toFixed(2), "9.00");
  assert.equal(passing.qualified, true);
  assert.equal(maximum.marksObtained.toFixed(2), "25.00");
});

test("Hindi marks boundaries use 0.0625 per fully correct word", () => {
  const below = calculateConfiguredRssbMarks(scoreWithCorrectWords(143), hindi.marksMethod);
  const passing = calculateConfiguredRssbMarks(scoreWithCorrectWords(144), hindi.marksMethod);
  const maximum = calculateConfiguredRssbMarks(scoreWithCorrectWords(400), hindi.marksMethod);
  assert.equal(below.marksObtained, 8.94);
  assert.equal(below.qualified, false);
  assert.equal(passing.marksObtained.toFixed(2), "9.00");
  assert.equal(passing.qualified, true);
  assert.equal(maximum.marksObtained.toFixed(2), "25.00");
});

test("marks are capped and short attempts retain marks with a duration warning", () => {
  assert.equal(calculateConfiguredRssbMarks(scoreWithCorrectWords(1000), english.marksMethod).marksObtained, 25);
  const shortAttempt = calculateConfiguredRssbMarks(scoreWithCorrectWords(125, 220), english.marksMethod);
  assert.equal(shortAttempt.durationMatches, false);
  assert.equal(shortAttempt.marksObtained.toFixed(2), "6.25");
  assert.equal(shortAttempt.qualified, false);
  assert.equal(shortAttempt.durationWarning, "This marks calculation is designed for a 10-minute configured typing test. This attempt used 3:40, so compare it cautiously.");
  assert.equal(calculateConfiguredRssbMarks(scoreWithCorrectWords(180, 220), english.marksMethod).qualified, true);
});

test("half errors, full errors, and remaining words receive no marks", () => {
  const typed = "hello wrong bonus";
  const score = calculateTypingScore({ typedText: typed, passage: "Hello world three four five", elapsedSeconds: 600, wordMethod: english.wordMethod, scoringProfile: english.scoringProfile, includeUntypedWords: true });
  assert.ok(score.analysis.halfErrors > 0);
  assert.ok(score.analysis.fullErrors > 0);
  assert.ok(score.analysis.remainingWords > 0);
  const result = calculateConfiguredRssbMarks(score, english.marksMethod);
  assert.equal(result.correctWords, score.analysis.counts.correct);
  assert.equal(result.marksObtained, score.analysis.counts.correct * 0.05);
});

// Real requested fix: the "Rajasthan LDC" exam-category simulator (the one
// students actually click into from /typing/exams) never carried RSSB's own
// marking scheme, even though its patternNotes already described it in
// prose -- only the generic, differently-named english-typing/hindi-typing
// presets above had it. Reuses the exact same marksMethod constants and the
// same calculateConfiguredRssbMarks already proven above -- this just
// confirms the category preset now genuinely carries them too.
test("the Rajasthan LDC exam-category presets (not just the generic english-typing/hindi-typing ones) carry the real RSSB marks scheme, word-separated counting, and no highlight", () => {
  const categoryEnglish = getExamPreset("exam-cat-rajasthan-ldc-english");
  const categoryHindi = getExamPreset("exam-cat-rajasthan-ldc-hindi");
  assert.ok(categoryEnglish?.marksMethod);
  assert.ok(categoryHindi?.marksMethod);
  assert.deepEqual(categoryEnglish.marksMethod, english.marksMethod);
  assert.deepEqual(categoryHindi.marksMethod, hindi.marksMethod);
  assert.equal(countSpaceWords(categoryEnglish.passage), 500);
  assert.equal(countSpaceWords(categoryHindi.passage), 400);
  assert.equal(categoryEnglish.wordMethod, "spaces");
  assert.equal(categoryHindi.wordMethod, "spaces");
  assert.equal(categoryEnglish.highlightMode, "none");
  assert.equal(categoryHindi.highlightMode, "none");
  assert.equal(categoryEnglish.backspaceMode, "word");
  assert.equal(categoryHindi.backspaceMode, "word");
});

test("marks qualification is independent of WPM and accuracy thresholds", () => {
  const words = english.passage.split(/\s+/u).slice(0, 180).join(" ");
  const score = calculateTypingScore({ typedText: words, passage: english.passage, elapsedSeconds: 600, wordMethod: english.wordMethod, scoringProfile: english.scoringProfile, includeUntypedWords: true });
  assert.equal(score.passed, false);
  assert.equal(score.analysis.counts.correct, 180);
  assert.equal(score.analysis.remainingWords, 320);
  const result = calculateConfiguredRssbMarks(score, english.marksMethod);
  assert.equal(result.marksObtained, 9);
  assert.equal(result.qualified, true);
});

// Real requested addition: Rajasthan DEO (Data Entry Operator) -- a
// genuinely separate RSSB post from Rajasthan LDC, researched and added
// alongside it: a 1250-word passage in EACH language (not LDC's differing
// 500/400 split), 15 minutes, 25 max marks per language, 10.5 to qualify
// (0.02 marks per correct word -- 525 correct words, i.e. 35 WPM, gives
// exactly the 10.5-mark minimum, matching the sourced qualifying speed).
test("the Rajasthan DEO exam-category presets carry the real RSSB DEO marks scheme (1250-word passages, 15 minutes, 0.02 marks/word, 10.5 to qualify) in both languages", () => {
  const deoEnglish = getExamPreset("exam-cat-rajasthan-deo-english");
  const deoHindi = getExamPreset("exam-cat-rajasthan-deo-hindi");
  assert.ok(deoEnglish?.marksMethod);
  assert.ok(deoHindi?.marksMethod);
  assert.deepEqual(deoEnglish.marksMethod, deoHindi.marksMethod);
  assert.equal(deoEnglish.marksMethod.maximumMarks, 25);
  assert.equal(deoEnglish.marksMethod.minimumPassingMarks, 10.5);
  assert.equal(deoEnglish.marksMethod.marksPerCorrectWord, 0.02);
  assert.equal(deoEnglish.marksMethod.requiredDurationSeconds, 900);
  assert.equal(deoEnglish.marksMethod.passageWordLimit, 1250);
  assert.equal(deoEnglish.durationSeconds, 900);
  assert.equal(deoHindi.durationSeconds, 900);
  assert.equal(countSpaceWords(deoEnglish.passage), 1250);
  assert.equal(countSpaceWords(deoHindi.passage), 1250);

  const belowQualifying = calculateConfiguredRssbMarks(scoreWithCorrectWords(524, 900), deoEnglish.marksMethod);
  const atQualifying = calculateConfiguredRssbMarks(scoreWithCorrectWords(525, 900), deoEnglish.marksMethod);
  const fullMarks = calculateConfiguredRssbMarks(scoreWithCorrectWords(1250, 900), deoEnglish.marksMethod);
  assert.equal(belowQualifying.qualified, false);
  assert.equal(atQualifying.marksObtained.toFixed(2), "10.50");
  assert.equal(atQualifying.qualified, true);
  assert.equal(fullMarks.marksObtained.toFixed(2), "25.00");
});

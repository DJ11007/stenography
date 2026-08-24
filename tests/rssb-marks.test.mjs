import assert from "node:assert/strict";
import test from "node:test";

import { EXAM_PRESETS } from "../lib/typing-curriculum.ts";
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

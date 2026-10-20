import assert from "node:assert/strict";
import test from "node:test";
import { calculateTypingScore, DEFAULT_SCORING_PROFILE, accuracyMethodOf } from "../lib/typing-test.ts";

// 10-word passage; the typed text has 1 substituted word (full mistake) and 1 capitalization slip (half).
const passage = "the quick brown fox jumps over the lazy dog today";
const typed = "the quick brown cat jumps over The lazy dog today";
const score = (accuracyMethod, wordMethod = "spaces") => calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 60, wordMethod, scoringProfile: { ...DEFAULT_SCORING_PROFILE, capitalizationErrors: true, accuracyMethod } });

test("character-based accuracy stays the default", () => {
  assert.equal(accuracyMethodOf(DEFAULT_SCORING_PROFILE), "characters");
  assert.equal(accuracyMethodOf({ ...DEFAULT_SCORING_PROFILE, accuracyFromSpeedRatio: true }), "speedRatio");
  const result = score(undefined);
  assert.equal(result.accuracy, Math.round(result.correctCharacters / result.totalCharacters * 100));
});

test("error-percent accuracy = 100 - (full + half/2) / words typed x 100", () => {
  const result = score("errorPercent");
  assert.equal(result.analysis.fullErrors, 1);
  assert.equal(result.analysis.halfErrors, 1);
  // 10 space-separated words typed: (1 + 0.5) / 10 = 15% errors
  assert.equal(result.accuracy, 85);
});

test("error-percent counts words the exam's way (5 keystrokes = 1 word)", () => {
  const result = score("errorPercent", "characters");
  const words = result.totalCharacters / 5;
  assert.equal(result.accuracy, Math.round((100 - (1.5 / words) * 100) * 100) / 100);
});

test("correct-words accuracy = correct words / words typed", () => {
  assert.equal(score("correctWords").accuracy, 80);
});

test("speed-ratio accuracy = net / gross", () => {
  const result = score("speedRatio");
  assert.equal(result.accuracy, result.efficiency);
});

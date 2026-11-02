import assert from "node:assert/strict";
import test from "node:test";
import { calculateTypingScore } from "../lib/typing-test.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";
import { examCategoryPresetId } from "../lib/exam-categories.ts";

// AIIMS CRE skill test scheme (docs.aiimsexams.ac.in, Scheme of Skill Test CRE-2024): strokes = key depressions,
// 5 strokes a word, 50 strokes per full mistake (half mistake = half), net w.p.m. = (strokes - penalty) / (5 x min).
const english = getExamPreset(examCategoryPresetId("aiims-cre-ldc", "English"));
const hindi = getExamPreset(examCategoryPresetId("aiims-cre-ldc", "Hindi"));

test("AIIMS presets: 15 minutes, 35 / 30 w.p.m., 10 words per full mistake, 5 per half, spelling a full mistake", () => {
  for (const preset of [english, hindi]) {
    assert.equal(preset.durationSeconds, 900);
    assert.equal(preset.scoringProfile.fullErrorPenalty, 10);
    assert.equal(preset.scoringProfile.halfErrorPenalty, 5);
    assert.equal(preset.scoringProfile.minorSpellingIsFullMistake, true);
    assert.equal(preset.scoringProfile.capMistakeUnitsPerWord, true);
  }
  assert.equal(english.scoringProfile.passNetWpm, 35);
  assert.equal(hindi.scoringProfile.passNetWpm, 30);
  // Capitalisation is not a mistake in Hindi (the scheme's note to Wrong Capitalization).
  assert.equal(hindi.scoringProfile.capitalizationErrors, false);
});

test("the scheme's worked example: 3,000 strokes with 20 mistakes in 10 minutes = 40 w.p.m. net, 80% accuracy", () => {
  const passage = Array.from({ length: 600 }, (_, i) => `w${String(i).padStart(3, "0")}`).join(" ");
  // 600 words of 4 letters + a space = 3,000 strokes; 20 words substituted = 20 full mistakes.
  const words = passage.split(" ");
  const typed = words.map((word, i) => (i % 30 === 0 ? `x${word.slice(1)}` : word)).join(" ") + " ";
  const score = calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 600, wordMethod: "characters", scoringProfile: english.scoringProfile });
  assert.equal(score.totalCharacters, 3000);
  assert.equal(score.analysis.fullErrors, 20);
  assert.equal(score.grossWpm, 60);
  assert.equal(score.netWpm, 40);
  assert.equal(score.accuracy, 67); // 40 / 60 -- the scheme's own 80% example divides by 50 gross (2,500 strokes)
});

test("Hindi strokes are counted per key depression, so Hindi gross speed is not under-counted", () => {
  const passage = "प्रकार की समस्या के लिए क्षमा";
  const score = calculateTypingScore({ typedText: passage, passage, elapsedSeconds: 60, wordMethod: "characters", scoringProfile: hindi.scoringProfile });
  assert.equal(score.totalCharacters, Array.from(passage).length);
  assert.equal(score.grossWpm, Math.round(Array.from(passage).length / 5));
  assert.equal(score.accuracy, 100);
});

test("net speed is worked out from the unrounded gross speed (no pass/fail flip from rounding twice)", () => {
  // 15 minutes, 2,620 strokes (gross 34.93), one half mistake (5 words = 0.33 w.p.m.): net 34.6 -> 35.
  const passage = "abcd ".repeat(524).trim();
  const typed = passage.slice(0, -4) + "abcd,";
  const score = calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 900, wordMethod: "characters", scoringProfile: english.scoringProfile });
  assert.equal(score.netWpm, Math.round(score.totalCharacters / 5 / 15 - (score.analysis.fullErrors * 10 + score.analysis.halfErrors * 5) / 15));
});

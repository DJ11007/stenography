import assert from "node:assert/strict";
import test from "node:test";
import { comparisonWordDisplay, spacingMark } from "../lib/typing-results.ts";
import { calculateTypingScore, DEFAULT_SCORING_PROFILE } from "../lib/typing-test.ts";

// Real report (Rajasthan LDC, EXERCISE-127): words typed exactly right showed as
// "before [before]" -- the student had pressed the space bar twice after them.
const score = (typedText, passage) => calculateTypingScore({ typedText, passage, elapsedSeconds: 60, wordMethod: "spaces", scoringProfile: DEFAULT_SCORING_PROFILE, includeUntypedWords: true });
const entry = (result, word) => result.analysis.entries.find(item => item.original === word);

test("a double space shows as a visible extra-space mark on the word, not as a copy of the word", () => {
  const result = score("study  before recording", "study before recording traits");
  const study = entry(result, "study");
  assert.deepEqual(study.halfErrorCategories, ["spacing"]);
  assert.equal(study.typedSeparatorAfter, "  ");
  const display = comparisonWordDisplay(study);
  assert.equal(display.text, "study");
  assert.equal(display.expected, undefined, "no '[study]' copy of a correctly typed word");
  assert.deepEqual(display.spacing, { marks: "+1 space", title: "1 extra space typed after this word" });
  assert.equal(spacingMark(entry(score("study    before", "study before"), "study")).marks, "+3 spaces");
  assert.equal(comparisonWordDisplay(entry(result, "before")).spacing, null, "words with the right gap get no mark");
});

test("Enter pressed in the middle of a line, and a missing paragraph break, are told apart", () => {
  assert.equal(spacingMark(entry(score("study\nbefore", "study before"), "study")).marks, "↵ Enter");
  assert.equal(spacingMark(entry(score("end. Next", "end.\n\nNext"), "end.")).marks, "¶ new para");
});

test("a misspelled word with an extra space keeps its [expected] word and also gets the mark", () => {
  const display = comparisonWordDisplay(entry(score("studdy  before", "study before"), "study"));
  assert.equal(display.expected, "study");
  assert.equal(display.spacing.marks, "+1 space");
});

test("attempts saved before the typed gap was recorded still show an extra-space mark", () => {
  const old = { id: "o1-t1", status: "half-error", original: "before", typed: "before", halfErrorCategories: ["spacing"], separatorAfter: " " };
  assert.deepEqual(comparisonWordDisplay(old), { text: "before", expected: undefined, spacing: { marks: "+space", title: "Extra space typed after this word" } });
});

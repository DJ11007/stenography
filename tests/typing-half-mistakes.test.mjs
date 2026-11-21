import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_SCORING_PROFILE, analyzeTyping } from "../lib/typing-test.ts";
import { repeatPassageRounds } from "../lib/typing-curriculum.ts";

// Typing-exam half mistakes (21 Nov 2026), as SSC / CPCT / RSMSSB-style evaluation lists them: spacing ("no space or
// extra space"), spelling slips (one letter added / dropped / wrong, two letters swapped), capitalisation and
// punctuation. Full mistakes: a word omitted, added, wrong, repeated or left incomplete.
const P = "The court passed the order today and the matter was listed again.";
const mistakes = (typed, passage = P) => { const a = analyzeTyping(passage, typed, DEFAULT_SCORING_PROFILE, false); return { full: a.fullErrors, half: a.halfErrors }; };

test("two words typed together (no space) is ONE half mistake, not 2 full", () => {
  assert.deepEqual(mistakes("The court passed theorder today and the matter was listed again."), { full: 0, half: 1 });
  assert.deepEqual(mistakes("न्यायालय ने आज आदेशपारित किया।", "न्यायालय ने आज आदेश पारित किया।"), { full: 0, half: 1 });
});

test("a word broken by a space is ONE half mistake, not 2 full", () => {
  assert.deepEqual(mistakes("The court passed the or der today and the matter was listed again."), { full: 0, half: 1 });
});

test("two swapped letters are a half spelling mistake", () => {
  assert.deepEqual(mistakes("The court passed the order today and the matter was lsited again."), { full: 0, half: 1 });
});

test("capital, punctuation and one-letter slips stay half; wrong / missing / extra / incomplete words stay full", () => {
  assert.deepEqual(mistakes("The Court passed the order today and the matter was listed again."), { full: 0, half: 1 });
  assert.deepEqual(mistakes("The court passed the order today and the matter was listed again"), { full: 0, half: 1 });
  assert.deepEqual(mistakes("The court pased the order today and the matter was listed again."), { full: 0, half: 1 });
  assert.deepEqual(mistakes("The court passed the decree today and the matter was listed again."), { full: 1, half: 0 });
  assert.deepEqual(mistakes("The court passed the order and the matter was listed again."), { full: 1, half: 0 });
  assert.deepEqual(mistakes("The court passed the new order today and the matter was listed again."), { full: 1, half: 0 });
  assert.deepEqual(mistakes("The court passed the order today and the matter was lis again."), { full: 1, half: 0 });
});

test("a finished passage starts again: typing it twice is all correct", () => {
  const twice = repeatPassageRounds(P, 2);
  assert.equal(twice, `${P} ${P}`);
  assert.equal(repeatPassageRounds(P, 1), P);
  assert.deepEqual(mistakes(`${P} The court passed`, twice), { full: 0, half: 0 });
});

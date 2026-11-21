import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_SCORING_PROFILE, analyzeTyping } from "../lib/typing-test.ts";

// SSC stenography evaluation (ScoringProfile.stenoEvaluation = "ssc"), per SSC's official guidelines: full mistakes
// = omitted / wrong / added / repeated / incomplete words, swapped abbreviations, ALL-CAPS words; half mistakes =
// spelling slips (incl. swapped or dropped letters), singular/plural, capitalisation, missing or misplaced full stop.
const SSC = { ...DEFAULT_SCORING_PROFILE, stenoEvaluation: "ssc", capitalizationErrors: true };
const mistakes = (passage, typed, profile = SSC) => { const a = analyzeTyping(passage, typed, profile, false); return { full: a.fullErrors, half: a.halfErrors }; };

test("SSC: swapped letters are ONE half mistake (were a full mistake)", () => {
  assert.deepEqual(mistakes("We receive the letter.", "We recieve the letter."), { full: 0, half: 1 });
  // Since 21 Nov 2026 the general typing rules count it as a half mistake too.
  assert.deepEqual(mistakes("We receive the letter.", "We recieve the letter.", DEFAULT_SCORING_PROFILE), { full: 0, half: 1 });
});

test("SSC: one dropped / extra / wrong letter is a half mistake", () => {
  assert.deepEqual(mistakes("The government decided.", "The goverment decided."), { full: 0, half: 1 });
  assert.deepEqual(mistakes("The members agreed.", "The memmbers agreed."), { full: 0, half: 1 });
});

test("SSC: singular for plural is a half mistake", () => {
  assert.deepEqual(mistakes("All the members agreed.", "All the member agreed."), { full: 0, half: 1 });
});

test("SSC: a short word typed as a different word is a FULL mistake (was half)", () => {
  assert.deepEqual(mistakes("This is a case of fraud.", "This in a case on fraud."), { full: 2, half: 0 });
  assert.equal(mistakes("This is a case of fraud.", "This in a case on fraud.", DEFAULT_SCORING_PROFILE).full, 0, "generic rules counted them half");
});

test("SSC: omitted, added and wrong words are full mistakes", () => {
  assert.deepEqual(mistakes("The court passed the order today.", "The court passed order today."), { full: 1, half: 0 });
  assert.deepEqual(mistakes("The court passed the order.", "The court passed the final order."), { full: 1, half: 0 });
  assert.deepEqual(mistakes("The court passed the order.", "The court reserved the order."), { full: 1, half: 0 });
});

test("SSC: an incomplete word is a full mistake", () => {
  assert.deepEqual(mistakes("The transcription was checked.", "The transcrip was checked."), { full: 1, half: 0 });
});

test("SSC: a word in ALL CAPITALS is a full mistake", () => {
  assert.deepEqual(mistakes("The court passed the order.", "The COURT passed the order."), { full: 1, half: 0 });
});

test("SSC: capitalisation is a half mistake", () => {
  assert.deepEqual(mistakes("He went to Delhi today.", "He went to delhi today."), { full: 0, half: 1 });
});

test("SSC: only a missing or misplaced full stop counts -- commas, quotes and spacing do not", () => {
  assert.deepEqual(mistakes("The order was passed. It was final.", "The order was passed It was final."), { full: 0, half: 1 });
  assert.deepEqual(mistakes("However, the order was passed.", "However the order was passed."), { full: 0, half: 0 });
  assert.deepEqual(mistakes("The order was passed.", "The  order   was passed."), { full: 0, half: 0 });
});

test("SSC: spelling + capitalisation in one word is one half mistake; its full stop is a second", () => {
  assert.deepEqual(mistakes("He lives in Delhi.", "He lives in delhii"), { full: 0, half: 2 });
});

test("Generic (non-SSC) typing rules are unchanged", () => {
  assert.deepEqual(mistakes("However, the order was passed.", "However the order was passed.", DEFAULT_SCORING_PROFILE), { full: 0, half: 1 });
});

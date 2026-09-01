import assert from "node:assert/strict";
import test from "node:test";
import { ALL_HALF_ERROR_CATEGORIES, DEFAULT_SCORING_PROFILE, alignWords, analyzeTyping } from "../lib/typing-test.ts";

// Concrete Hindi word pairs proving each new grammar-adjacent category
// classifies correctly. matra/halant are genuine codepoint-level
// detectors; gender/vachan are an explicitly-labeled heuristic (a known
// word-ending swap pattern), not real grammatical agreement checking --
// see the doc comments in lib/typing-test.ts for why.

function categoriesFor(originalWord, typedWord) {
  const entries = alignWords(originalWord, typedWord, DEFAULT_SCORING_PROFILE);
  const pair = entries.find((entry) => entry.status === "half-error" || entry.status === "correct" || entry.status === "substituted");
  assert.ok(pair, `expected exactly one aligned word pair for "${originalWord}" vs "${typedWord}"`);
  return { status: pair.status, categories: pair.halfErrorCategories };
}

test("a matra (vowel sign) swap mid-word is classified as matra", () => {
  // कि (short i matra) vs की (long ii matra) -- same consonant, different vowel sign.
  const { status, categories } = categoriesFor("कि", "की");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["matra"]);
});

test("a matra swap inside a longer word (not at the word boundary) is still classified as matra", () => {
  // किताब (kitab, book) vs कीताब (typo) -- differs only in the second character's vowel sign.
  const { status, categories } = categoriesFor("किताब", "कीताब");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["matra"]);
});

test("adding an inherent-vowel matra is also classified as matra, not a full substitution", () => {
  // क (ka, bare consonant, inherent 'a' vowel) vs का (kaa, with an explicit aa-matra).
  const { status, categories } = categoriesFor("क", "का");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["matra"]);
});

test("a halant (viram) added inside a word is classified as halant, even though it changes how the word re-clusters into graphemes", () => {
  // करता (karta, does -- no conjunct) vs कर्ता (karta, doer -- र्त conjunct via halant).
  const { status, categories } = categoriesFor("करता", "कर्ता");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["halant"]);
});

test("a halant dropped from a word is also classified as halant", () => {
  const { status, categories } = categoriesFor("कर्ता", "करता");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["halant"]);
});

test("a known masculine/feminine word-ending swap is classified as gender", () => {
  // अच्छा (accha, good -- masculine) vs अच्छी (acchi, good -- feminine).
  const { status, categories } = categoriesFor("अच्छा", "अच्छी");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["gender"]);
});

test("a known singular/plural word-ending swap is classified as vachan", () => {
  // लड़का (ladka, boy -- singular) vs लड़के (ladke, boys -- plural).
  const { status, categories } = categoriesFor("लड़का", "लड़के");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["vachan"]);
});

test("adding a plural-marking anusvara is classified as vachan", () => {
  // है (hai, is) vs हैं (hain, are).
  const { status, categories } = categoriesFor("है", "हैं");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["vachan"]);
});

test("a genuinely different Hindi word is never misclassified as matra/halant/gender/vachan, whatever its status resolves to", () => {
  const { categories } = categoriesFor("राम", "श्याम");
  for (const category of ["matra", "halant", "gender", "vachan"]) assert.ok(!categories.includes(category), `did not expect "${category}" for two unrelated words`);
});

test("two words with a large, genuine difference are a full substitution", () => {
  const { status } = categoriesFor("पुस्तकालय", "विद्यालय");
  assert.equal(status, "substituted");
});

test("an English word pair is completely unaffected by any of the Devanagari-specific logic (regression guard)", () => {
  const beforeResult = analyzeTyping("The quick brown fox jumps over the lazy dog.", "The quick brown fox jumps over the lazy dog", DEFAULT_SCORING_PROFILE);
  assert.equal(beforeResult.categoryCounts.matra, 0);
  assert.equal(beforeResult.categoryCounts.halant, 0);
  assert.equal(beforeResult.categoryCounts.gender, 0);
  assert.equal(beforeResult.categoryCounts.vachan, 0);
  assert.equal(beforeResult.categoryCounts.punctuation, 1); // "dog." vs "dog" -- unchanged existing behavior
});

test("matra/gender/vachan are never in the student-toggleable category list -- only halant joins the original four", () => {
  assert.deepEqual(ALL_HALF_ERROR_CATEGORIES, ["capitalization", "punctuation", "spacing", "minorSpelling", "halant"]);
  assert.ok(!ALL_HALF_ERROR_CATEGORIES.includes("matra"));
  assert.ok(!ALL_HALF_ERROR_CATEGORIES.includes("gender"));
  assert.ok(!ALL_HALF_ERROR_CATEGORIES.includes("vachan"));
});

test("matra/gender/vachan are always graded at full weight regardless of any ScoringProfile toggle -- there's no flag that turns them off", () => {
  const profileWithEverythingOff = { ...DEFAULT_SCORING_PROFILE, capitalizationErrors: false, punctuationErrors: false, spacingErrors: false, minorSpellingErrors: false, halantErrors: false };
  const entries = alignWords("अच्छा", "अच्छी", profileWithEverythingOff);
  const pair = entries.find((entry) => entry.status === "half-error");
  assert.ok(pair, "gender difference should still be graded even with every toggleable category off");
  assert.deepEqual(pair.halfErrorCategories, ["gender"]);
});

test("halant IS gated by its ScoringProfile toggle, unlike matra/gender/vachan", () => {
  const profileWithHalantOff = { ...DEFAULT_SCORING_PROFILE, halantErrors: false };
  const entries = alignWords("करता", "कर्ता", profileWithHalantOff);
  const pair = entries.find((entry) => entry.status === "correct" || entry.status === "half-error");
  assert.ok(pair);
  assert.equal(pair.status, "correct"); // forgiven, not escalated to substituted
  assert.deepEqual(pair.halfErrorCategories, []);
});

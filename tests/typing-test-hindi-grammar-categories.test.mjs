import assert from "node:assert/strict";
import test from "node:test";
import { ALL_HALF_ERROR_CATEGORIES, DEFAULT_SCORING_PROFILE, alignWords, analyzeTyping } from "../lib/typing-test.ts";

// Concrete Hindi word pairs proving each new grammar-adjacent category
// classifies correctly. matra/halant are genuine codepoint-level
// detectors; gender/vachan are an explicitly-labeled heuristic (a known
// word-ending swap pattern), not real grammatical agreement checking --
// see the doc comments in lib/typing-test.ts for why.
//
// Real reported bug: these categories were showing up (and being graded)
// in a PLAIN Hindi typing/exam/learn test's results, purely because the
// passage was Devanagari -- they only ever make sense for stenography's
// dictation scoring. matra/halant/gender/vachan are now three-state
// (true = graded as this category, false = a stenography attempt
// explicitly forgave it, undefined = not a stenography context at all, so
// it falls through to ordinary minor-spelling grading), so every test
// here that wants to see the category itself now uses STENO_PROFILE
// (mirroring what managedVersionToPreset/typing-curriculum.ts's preset()
// actually set for a stenography test) instead of DEFAULT_SCORING_PROFILE.

const STENO_PROFILE = { ...DEFAULT_SCORING_PROFILE, matraErrors: true, halantErrors: true, genderErrors: true, vachanErrors: true };

function categoriesFor(originalWord, typedWord, profile = STENO_PROFILE) {
  const entries = alignWords(originalWord, typedWord, profile);
  const pair = entries.find((entry) => entry.status === "half-error" || entry.status === "correct" || entry.status === "substituted");
  assert.ok(pair, `expected exactly one aligned word pair for "${originalWord}" vs "${typedWord}"`);
  return { status: pair.status, categories: pair.halfErrorCategories };
}

test("a matra (vowel sign) swap mid-word is classified as matra (stenography)", () => {
  // कि (short i matra) vs की (long ii matra) -- same consonant, different vowel sign.
  const { status, categories } = categoriesFor("कि", "की");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["matra"]);
});

test("a matra swap inside a longer word (not at the word boundary) is still classified as matra (stenography)", () => {
  // किताब (kitab, book) vs कीताब (typo) -- differs only in the second character's vowel sign.
  const { status, categories } = categoriesFor("किताब", "कीताब");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["matra"]);
});

test("adding an inherent-vowel matra is also classified as matra, not a full substitution (stenography)", () => {
  // क (ka, bare consonant, inherent 'a' vowel) vs का (kaa, with an explicit aa-matra).
  const { status, categories } = categoriesFor("क", "का");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["matra"]);
});

test("a halant (viram) added inside a word is classified as halant, even though it changes how the word re-clusters into graphemes (stenography)", () => {
  // करता (karta, does -- no conjunct) vs कर्ता (karta, doer -- र्त conjunct via halant).
  const { status, categories } = categoriesFor("करता", "कर्ता");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["halant"]);
});

test("a halant dropped from a word is also classified as halant (stenography)", () => {
  const { status, categories } = categoriesFor("कर्ता", "करता");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["halant"]);
});

test("a known masculine/feminine word-ending swap is classified as gender (stenography)", () => {
  // अच्छा (accha, good -- masculine) vs अच्छी (acchi, good -- feminine).
  const { status, categories } = categoriesFor("अच्छा", "अच्छी");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["gender"]);
});

test("a known singular/plural word-ending swap is classified as vachan (stenography)", () => {
  // लड़का (ladka, boy -- singular) vs लड़के (ladke, boys -- plural).
  const { status, categories } = categoriesFor("लड़का", "लड़के");
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["vachan"]);
});

test("adding a plural-marking anusvara is classified as vachan (stenography)", () => {
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
  const beforeResult = analyzeTyping("The quick brown fox jumps over the lazy dog.", "The quick brown fox jumps over the lazy dog", STENO_PROFILE);
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

test("in a stenography profile, matra/gender/vachan are graded at full weight regardless of every OTHER (non-Devanagari) toggle", () => {
  const profileWithEverythingElseOff = { ...STENO_PROFILE, capitalizationErrors: false, punctuationErrors: false, spacingErrors: false, minorSpellingErrors: false };
  const entries = alignWords("अच्छा", "अच्छी", profileWithEverythingElseOff);
  const pair = entries.find((entry) => entry.status === "half-error");
  assert.ok(pair, "gender difference should still be graded even with every other category off");
  assert.deepEqual(pair.halfErrorCategories, ["gender"]);
});

test("halant IS gated by its own ScoringProfile toggle even within a stenography profile (the dictation gate's per-attempt checklist)", () => {
  const profileWithHalantOff = { ...STENO_PROFILE, halantErrors: false };
  const entries = alignWords("करता", "कर्ता", profileWithHalantOff);
  const pair = entries.find((entry) => entry.status === "correct" || entry.status === "half-error");
  assert.ok(pair);
  assert.equal(pair.status, "correct"); // forgiven, not escalated to substituted
  assert.deepEqual(pair.halfErrorCategories, []);
});

// The actual bug report: a plain (non-stenography) Hindi typing/exam/learn
// test uses DEFAULT_SCORING_PROFILE, which leaves matra/halant/gender/
// vachan undefined -- these differences must fall through to ordinary
// minorSpelling grading (a generic, mode-agnostic bucket every language
// already uses for small typos), not disappear or get labeled with a
// dictation-specific category name that doesn't apply outside stenography.
test("outside stenography (undefined flags), a matra difference is graded as an ordinary minor spelling error, not matra", () => {
  const { status, categories } = categoriesFor("कि", "की", DEFAULT_SCORING_PROFILE);
  assert.equal(status, "half-error");
  assert.deepEqual(categories, ["minorSpelling"]);
});

// Unlike matra/gender/vachan (small, single-codepoint swaps that fit
// comfortably within the default edit-distance tolerance), a halant
// difference restructures grapheme clusters enough that it can exceed
// minorSpellingMaxDistance -- exactly why the dedicated halant detector
// existed in the first place (see classifyDevanagariDifference's own doc
// comment). Outside stenography this still isn't escalated to a
// substitution or mislabeled "halant": isWithinHalfErrorFamily's own
// (profile-independent) Devanagari check forgives it outright, the same
// leniency a stenography attempt gets from explicitly toggling halant off.
test("outside stenography (undefined flags), a halant difference is forgiven outright (correct), not labeled halant or escalated to a substitution", () => {
  const { status, categories } = categoriesFor("करता", "कर्ता", DEFAULT_SCORING_PROFILE);
  assert.equal(status, "correct");
  assert.deepEqual(categories, []);
});

test("outside stenography (undefined flags), a gender/vachan word-ending swap is graded as an ordinary minor spelling error, not gender/vachan", () => {
  const gender = categoriesFor("अच्छा", "अच्छी", DEFAULT_SCORING_PROFILE);
  assert.equal(gender.status, "half-error");
  assert.deepEqual(gender.categories, ["minorSpelling"]);
  const vachan = categoriesFor("लड़का", "लड़के", DEFAULT_SCORING_PROFILE);
  assert.equal(vachan.status, "half-error");
  assert.deepEqual(vachan.categories, ["minorSpelling"]);
});

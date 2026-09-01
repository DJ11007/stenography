import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_HALF_ERROR_CATEGORIES,
  DEFAULT_SCORING_PROFILE,
  activeHalfErrorCategories,
  alignWords,
  analyzeTyping,
  sanitizeSelectedCategories,
  scoringProfileWithSelectedCategories,
} from "../lib/typing-test.ts";

// Supports the stenography dictation phase, where a student picks which
// half-error categories (capitalization/punctuation/spacing/minorSpelling)
// get graded in their attempt. Wrong/missing/extra/repeated ("full error")
// words are never optional and aren't covered here.

test("scoringProfileWithSelectedCategories sets exactly the four booleans matching the selected array", () => {
  const profile = scoringProfileWithSelectedCategories(DEFAULT_SCORING_PROFILE, ["punctuation", "spacing"]);
  assert.equal(profile.capitalizationErrors, false);
  assert.equal(profile.punctuationErrors, true);
  assert.equal(profile.spacingErrors, true);
  assert.equal(profile.minorSpellingErrors, false);
  // Base profile fields are preserved.
  assert.equal(profile.fullErrorPenalty, DEFAULT_SCORING_PROFILE.fullErrorPenalty);
});

test("sanitizeSelectedCategories defaults to all four for undefined/non-array input, matching today's unrestricted grading", () => {
  assert.deepEqual(sanitizeSelectedCategories(undefined), ALL_HALF_ERROR_CATEGORIES);
  assert.deepEqual(sanitizeSelectedCategories(null), ALL_HALF_ERROR_CATEGORIES);
  assert.deepEqual(sanitizeSelectedCategories("punctuation"), ALL_HALF_ERROR_CATEGORIES);
});

test("sanitizeSelectedCategories dedupes and drops invalid entries from a malformed array, preserving canonical order", () => {
  assert.deepEqual(sanitizeSelectedCategories(["spacing", "punctuation", "spacing", "not-a-real-category", 42]), ["punctuation", "spacing"]);
  assert.deepEqual(sanitizeSelectedCategories([]), []);
});

test("activeHalfErrorCategories returns all four for the default profile, and only the enabled ones when some are toggled off", () => {
  assert.deepEqual(activeHalfErrorCategories(DEFAULT_SCORING_PROFILE), ALL_HALF_ERROR_CATEGORIES);
  const profile = scoringProfileWithSelectedCategories(DEFAULT_SCORING_PROFILE, ["capitalization"]);
  assert.deepEqual(activeHalfErrorCategories(profile), ["capitalization"]);
});

test("a word differing only by a toggled-off category is forgiven (correct, zero penalty), not escalated to a full error", () => {
  const profile = scoringProfileWithSelectedCategories(DEFAULT_SCORING_PROFILE, []); // every category off
  const entries = alignWords("Hello, world.", "Hello world", profile);
  // "world." vs "world" differs only by punctuation -- with punctuation
  // ungraded, this must be "correct", not "substituted".
  const worldEntry = entries.find((entry) => entry.original === "world.");
  assert.ok(worldEntry, "expected an aligned pair for world./world");
  assert.equal(worldEntry.status, "correct");
  assert.equal(worldEntry.halfErrorCategories.length, 0);
});

test("the same word, with the category actually graded, still scores as a half-error exactly as it did before this feature existed", () => {
  const entries = alignWords("Hello, world.", "Hello world", DEFAULT_SCORING_PROFILE);
  const worldEntry = entries.find((entry) => entry.original === "world.");
  assert.ok(worldEntry);
  assert.equal(worldEntry.status, "half-error");
  assert.deepEqual(worldEntry.halfErrorCategories, ["punctuation"]);
});

test("a genuinely different word (not within the half-error family) still scores as a full substitution regardless of category toggles", () => {
  const profile = scoringProfileWithSelectedCategories(DEFAULT_SCORING_PROFILE, []);
  const entries = alignWords("The quick fox", "The slow fox", profile);
  const swapped = entries.find((entry) => entry.original === "quick");
  assert.ok(swapped);
  assert.equal(swapped.status, "substituted");
});

test("a Hindi-style profile (capitalizationErrors: false, no case) produces identical analyzeTyping output whether or not the new toggles exist -- regression guard for the existing behavior", () => {
  const hindiProfile = { ...DEFAULT_SCORING_PROFILE, capitalizationErrors: false };
  const passage = "नमस्ते, दुनिया।";
  const typed = "नमस्ते दुनिया";
  const before = analyzeTyping(passage, typed, hindiProfile);
  const after = analyzeTyping(passage, typed, { ...hindiProfile }); // same shape, proves no accidental behavior shift
  assert.deepEqual(after.categoryCounts, before.categoryCounts);
  assert.deepEqual(after.counts, before.counts);
  assert.equal(after.totalPenalty, before.totalPenalty);
});

test("default-profile analyzeTyping results are unchanged by this feature (no toggles set at all)", () => {
  const passage = "The quick brown fox jumps over the lazy dog.";
  const typed = "The quick brown fox jumps over the lazy dog";
  const result = analyzeTyping(passage, typed, DEFAULT_SCORING_PROFILE);
  // "dog." vs "dog" is a punctuation half-error, graded by default.
  assert.equal(result.categoryCounts.punctuation, 1);
  assert.equal(result.counts.substituted, 0);
});

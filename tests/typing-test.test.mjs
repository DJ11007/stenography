import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_SCORING_PROFILE,
  alignWords,
  analyzeTyping,
  calculateTypingScore,
  entryMistakeUnits,
  isAllowedTypingEdit,
} from "../lib/typing-test.ts";
import { categoryTotalsReconcile } from "../lib/typing-results.ts";

const statuses = (passage, typed) =>
  alignWords(passage, typed, DEFAULT_SCORING_PROFILE, true).map(
    ({ status, original, typed: typedWord }) => ({ status, original, typed: typedWord }),
  );

test("aligns an insertion without shifting later words", () => {
  assert.deepEqual(statuses("one two three", "one bonus two three"), [
    { status: "correct", original: "one", typed: "one" },
    { status: "extra", original: undefined, typed: "bonus" },
    { status: "correct", original: "two", typed: "two" },
    { status: "correct", original: "three", typed: "three" },
  ]);
});

test("aligns an omission without shifting later words", () => {
  assert.deepEqual(statuses("one two three", "one three"), [
    { status: "correct", original: "one", typed: "one" },
    { status: "missing", original: "two", typed: undefined },
    { status: "correct", original: "three", typed: "three" },
  ]);
});

test("classifies a substituted word as one full error", () => {
  const analysis = analyzeTyping("one two three", "one seven three");
  assert.equal(analysis.counts.substituted, 1);
  assert.equal(analysis.fullErrors, 1);
});

test("classifies punctuation as a half error", () => {
  const analysis = analyzeTyping("Hello, world.", "Hello world.");
  assert.equal(analysis.categoryCounts.punctuation, 1);
  assert.equal(analysis.halfErrors, 1);
  assert.equal(analysis.totalPenalty, 0.5);
});

test("classifies capitalization as a half error", () => {
  const analysis = analyzeTyping("Hello world", "hello world");
  assert.equal(analysis.categoryCounts.capitalization, 1);
  assert.equal(analysis.halfErrors, 1);
});

test("combines two half errors into one full-error penalty", () => {
  const analysis = analyzeTyping("Hello, world", "hello world");
  assert.equal(analysis.categoryCounts.capitalization, 1);
  assert.equal(analysis.categoryCounts.punctuation, 1);
  assert.equal(analysis.halfErrors, 2);
  assert.equal(analysis.totalPenalty, 1);
});

test("classifies changed inter-word whitespace as a half error", () => {
  const analysis = analyzeTyping("hello world", "hello  world");
  assert.equal(analysis.categoryCounts.spacing, 1);
  assert.equal(analysis.halfErrors, 1);
});

// Real bug reported live: the passage's paragraph breaks are stored as a
// blank line ("\n\n" -- what pasting from Word/Docs naturally produces),
// but a student reasonably presses Enter exactly once per paragraph,
// producing a single "\n". Comparing separators for exact string equality
// flagged the last word of every single paragraph in every passage as a
// spacing mistake -- not a real typing error, just a mismatch between how
// many blank lines the source document happened to have and how many
// times a normal typist presses Enter.
test("pressing Enter once at a paragraph break is not a spacing error, even when the source passage used a blank line (two newlines)", () => {
  const analysis = analyzeTyping("...with determination.\n\nMathematics and science...", "...with determination.\nMathematics and science...");
  assert.equal(analysis.categoryCounts.spacing, 0);
  assert.equal(analysis.halfErrors, 0);
});

test("any number of newlines on both sides still counts as a match -- only whether a line break happened matters, not how many", () => {
  const analysis = analyzeTyping("one.\n\n\ntwo", "one.\ntwo");
  assert.equal(analysis.categoryCounts.spacing, 0);
});

test("running two paragraphs together (typing no Enter at all where the passage has one) is still a genuine spacing error", () => {
  const analysis = analyzeTyping("one.\n\ntwo", "one. two");
  assert.equal(analysis.categoryCounts.spacing, 1);
  assert.equal(analysis.halfErrors, 1);
});

test("inserting an unwanted line break where the passage has none is still a genuine spacing error", () => {
  const analysis = analyzeTyping("one two three", "one\ntwo three");
  assert.equal(analysis.categoryCounts.spacing, 1);
});

test("preserves character-level comparison for a minor spelling error", () => {
  const analysis = analyzeTyping("typing practice", "typng practice");
  assert.equal(analysis.categoryCounts.minorSpelling, 1);
  assert.equal(analysis.fullErrors, 0);
  assert.equal(analysis.totalPenalty, 0.5);
});

test("empty final input reports every original word as remaining", () => {
  const analysis = analyzeTyping("one two three", "");
  assert.equal(analysis.counts.missing, 0);
  assert.equal(analysis.counts.remaining, 3);
  assert.equal(analysis.fullErrors, 0);
  assert.equal(analysis.totalPenalty, 0);
  assert.equal(analysis.entries.length, 3);
});

test("backspace modes and passage length restrictions remain enforced", () => {
  const base = { previousValue: "one two", maximumLength: 20 };
  assert.equal(isAllowedTypingEdit({ ...base, nextValue: "one tw", selectionStart: 6, selectionEnd: 7, mode: "full" }), true);
  assert.equal(isAllowedTypingEdit({ ...base, nextValue: "onetwo", selectionStart: 3, selectionEnd: 4, mode: "word" }), false);
  assert.equal(isAllowedTypingEdit({ ...base, nextValue: "one tw", selectionStart: 6, selectionEnd: 7, mode: "disabled" }), false);
  assert.equal(isAllowedTypingEdit({ previousValue: "", nextValue: "12345", selectionStart: 0, selectionEnd: 0, mode: "full", maximumLength: 4 }), false);
});

test("beforeinput without inputType is normalized before protected operations are checked", () => {
  const exam = readFileSync(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8");
  assert.match(exam, /const nativeInputType = \(event\.nativeEvent as InputEvent\)\.inputType;/);
  assert.match(exam, /const inputType = typeof nativeInputType === "string" \? nativeInputType : "";/);
  assert.match(exam, /inputType === "insertFromDrop" \|\| inputType\.startsWith\("history"\)/);
});

test("result totals equal the underlying aligned analysis entries", () => {
  const score = calculateTypingScore({ typedText: "Hello wurld extra", passage: "hello world", elapsedSeconds: 60, wordMethod: "characters", includeUntypedWords: true });
  const entries = score.analysis.entries;
  assert.equal(score.correctWords, entries.filter((entry) => entry.status === "correct").length);
  assert.equal(score.analysis.fullErrors, entries.filter((entry) => ["missing", "extra", "repeated", "substituted"].includes(entry.status)).length);
  assert.equal(score.analysis.halfErrors, entries.reduce((total, entry) => total + entry.halfErrorCategories.length, 0));
  assert.equal(score.analysis.totalPenalty, score.analysis.fullErrors * DEFAULT_SCORING_PROFILE.fullErrorPenalty + score.analysis.halfErrors * DEFAULT_SCORING_PROFILE.halfErrorPenalty);
  assert.equal(score.efficiency, score.grossWpm > 0 ? Math.min(100, Math.round(score.netWpm / score.grossWpm * 100)) : 100);
});

// Real reported research: RRB NTPC's typing skill test forgives
// errorRelaxationPercent% of typed words' worth of mistakes before any
// penalty applies at all (confirmed independently across two detailed
// sources reproducing an identical worked example). This reproduces that
// exact worked example end to end: 62 words typed, 14 full mistakes, 0 half
// mistakes, 10-minute test -> gross 6.20 WPM (rounds to 6), 140-point raw
// penalty, 31-point relaxation (5% x 62 x 10), 109 effective penalty, net
// speed floored at 0 -- matching the source's own 6.20 / 140 / 0.00 result
// screen values exactly.
test("errorRelaxationPercent forgives a percentage of typed words' worth of mistakes before the per-mistake penalty applies, reproducing RRB NTPC's own worked example", () => {
  const relaxedProfile = { ...DEFAULT_SCORING_PROFILE, fullErrorPenalty: 10, halfErrorPenalty: 5, errorRelaxationPercent: 5 };
  const words = Array.from({ length: 62 }, (_, index) => `w${index}`);
  const passage = words.join(" ");
  const typedText = words.map((word, index) => index < 14 ? `WRONG${index}` : word).join(" ");
  const score = calculateTypingScore({ typedText, passage, elapsedSeconds: 600, wordMethod: "spaces", scoringProfile: relaxedProfile, includeUntypedWords: true });
  assert.equal(score.grossWpm, 6);
  assert.equal(score.analysis.fullErrors, 14);
  assert.equal(score.analysis.totalPenalty, 140);
  assert.equal(score.netWpm, 0);
});

test("errorRelaxationPercent is a no-op for every profile that doesn't set it -- identical netWpm to before this feature existed", () => {
  const withoutRelaxation = calculateTypingScore({ typedText: "hello Wurld extra", passage: "hello world missing", elapsedSeconds: 60, wordMethod: "spaces", scoringProfile: DEFAULT_SCORING_PROFILE, includeUntypedWords: true });
  const explicitZero = calculateTypingScore({ typedText: "hello Wurld extra", passage: "hello world missing", elapsedSeconds: 60, wordMethod: "spaces", scoringProfile: { ...DEFAULT_SCORING_PROFILE, errorRelaxationPercent: 0 }, includeUntypedWords: true });
  assert.equal(withoutRelaxation.netWpm, Math.max(Math.round(withoutRelaxation.grossWpm - withoutRelaxation.analysis.totalPenalty / 1), 0));
  assert.equal(explicitZero.netWpm, withoutRelaxation.netWpm);
});

// Real reported research: UPSSSC's typing test forgives a FLAT count of
// mistakes (errorGraceCount) regardless of words typed -- genuinely
// different from RRB NTPC's percentage-based errorRelaxationPercent above.
// Reproduces UPSSSC's own worked example end to end: 180 words, 6 full + 4
// half mistakes (8 mistake-units, since half counts as 0.5), grace 5,
// penalty (8-5)x5=15 words, net speed (180-15)/5min=33 WPM.
test("errorGraceCount forgives a flat count of mistakes regardless of words typed, reproducing UPSSSC's own worked example", () => {
  const graceProfile = { ...DEFAULT_SCORING_PROFILE, fullErrorPenalty: 5, halfErrorPenalty: 2.5, errorGraceCount: 5 };
  const words = Array.from({ length: 180 }, (_, index) => `w${index}`);
  const passage = words.join(" ");
  const typedText = words.map((word, index) => index < 6 ? `WRONG${index}` : index < 10 ? word.toUpperCase() : word).join(" ");
  const score = calculateTypingScore({ typedText, passage, elapsedSeconds: 300, wordMethod: "spaces", scoringProfile: graceProfile, includeUntypedWords: true });
  assert.equal(score.grossWpm, 36);
  assert.equal(score.analysis.fullErrors, 6);
  assert.equal(score.analysis.halfErrors, 4);
  assert.equal(score.analysis.totalPenalty, 40);
  assert.equal(score.netWpm, 33);
});

test("errorGraceCount is a no-op for every profile that doesn't set it -- identical netWpm to before this feature existed", () => {
  const withoutGrace = calculateTypingScore({ typedText: "hello Wurld extra", passage: "hello world missing", elapsedSeconds: 60, wordMethod: "spaces", scoringProfile: DEFAULT_SCORING_PROFILE, includeUntypedWords: true });
  const explicitZero = calculateTypingScore({ typedText: "hello Wurld extra", passage: "hello world missing", elapsedSeconds: 60, wordMethod: "spaces", scoringProfile: { ...DEFAULT_SCORING_PROFILE, errorGraceCount: 0 }, includeUntypedWords: true });
  assert.equal(explicitZero.netWpm, withoutGrace.netWpm);
});

// Real reported research: AIIMS CRE-5's official DEST/typing evaluation
// criteria PDF. Its "50 strokes penalty per full mistake" is exactly this
// platform's existing fullErrorPenalty:10/halfErrorPenalty:5 convention
// (50 strokes / 5 strokes-per-word = 10 penalty-words) -- no new engine
// code needed for the WPM formula itself, confirmed by reproducing the
// PDF's own worked example: 3000 strokes, 20 mistake-units, 10-minute
// test -> gross 60 WPM, 200-word penalty, net 40 WPM.
test("AIIMS's 50-strokes-per-full-mistake penalty (fullErrorPenalty 10 / halfErrorPenalty 5) reproduces its own worked example: 3000 strokes, 20 mistake units, 10 minutes -> 40 net WPM", () => {
  const aiimsPenalty = { ...DEFAULT_SCORING_PROFILE, fullErrorPenalty: 10, halfErrorPenalty: 5 };
  // 600 words, single-space separated: 599 x "aaaa" (4 chars) + 1 x
  // "aaaaa" (5 chars) + 599 spaces = 2396 + 5 + 599 = 3000 characters.
  const words = Array.from({ length: 600 }, (_, index) => (index === 599 ? "aaaaa" : "aaaa"));
  const passage = words.join(" ");
  // First 20 words wrong (substituted, same length so totalCharacters is
  // unaffected) -- exactly 20 full mistakes, 0 half mistakes.
  const typedText = words.map((word, index) => index < 20 ? "bbbb" : word).join(" ");
  const score = calculateTypingScore({ typedText, passage, elapsedSeconds: 600, wordMethod: "characters", scoringProfile: aiimsPenalty, includeUntypedWords: true });
  assert.equal(score.totalCharacters, 3000);
  assert.equal(score.analysis.fullErrors, 20);
  assert.equal(score.analysis.halfErrors, 0);
  assert.equal(score.analysis.totalPenalty, 200);
  assert.equal(score.grossWpm, 60);
  assert.equal(score.netWpm, 40);
});

// AIIMS's real Accuracy = Net Speed / Gross Speed x 100 is already exactly
// what TypingScore.efficiency computes -- accuracyFromSpeedRatio just
// reports that instead of the platform's default character-based figure.
test("accuracyFromSpeedRatio reports Net/Gross speed as accuracy instead of the character-based default, and is a no-op when unset", () => {
  const base = { typedText: "hello wurld extra", passage: "hello world missing", elapsedSeconds: 60, wordMethod: "spaces", includeUntypedWords: true };
  const withoutFlag = calculateTypingScore({ ...base, scoringProfile: DEFAULT_SCORING_PROFILE });
  const withFlag = calculateTypingScore({ ...base, scoringProfile: { ...DEFAULT_SCORING_PROFILE, accuracyFromSpeedRatio: true } });
  assert.equal(withFlag.accuracy, withFlag.efficiency);
  assert.equal(withoutFlag.accuracy, Math.round((withoutFlag.correctCharacters / (withoutFlag.correctCharacters + withoutFlag.incorrectCharacters)) * 100));
  assert.notEqual(withFlag.accuracy, withoutFlag.accuracy);
});

// AIIMS's real FULL MISTAKES list includes letter-level spelling errors --
// exactly this platform's "minorSpelling" half-error category, just
// counted as full for this board. entry.status/halfErrorCategories/
// categoryCounts must NOT change (display/counting stays exactly as
// today); only the final fullErrors/halfErrors aggregate moves.
test("minorSpellingIsFullMistake moves a minorSpelling occurrence into fullErrors without touching entry.status, halfErrorCategories, or categoryCounts", () => {
  const promoted = { ...DEFAULT_SCORING_PROFILE, minorSpellingIsFullMistake: true };
  const passage = "hello world";
  const typedText = "helllo world"; // one extra letter -> minorSpelling half-error
  const withoutFlag = analyzeTyping(passage, typedText, DEFAULT_SCORING_PROFILE, true);
  const withFlag = analyzeTyping(passage, typedText, promoted, true);
  assert.equal(withoutFlag.fullErrors, 0);
  assert.equal(withoutFlag.halfErrors, 1);
  assert.equal(withFlag.fullErrors, 1);
  assert.equal(withFlag.halfErrors, 0);
  // Entries and category counts are identical between the two -- only the
  // aggregate moved.
  assert.deepEqual(withFlag.entries.map((e) => ({ status: e.status, categories: e.halfErrorCategories })), withoutFlag.entries.map((e) => ({ status: e.status, categories: e.halfErrorCategories })));
  assert.deepEqual(withFlag.categoryCounts, withoutFlag.categoryCounts);
});

// entryMistakeUnits() is the pure function both analyzeTyping's aggregate
// and guidePenaltyTotal/ErrorDetail's per-word display now share.
test("entryMistakeUnits: a full-status entry is always exactly 1 full unit, ignoring any half categories riding along on the same entry", () => {
  const entry = { id: "1", status: "substituted", original: "hope", typed: "Hopa", halfErrorCategories: ["capitalization", "spacing"] };
  assert.deepEqual(entryMistakeUnits(entry, DEFAULT_SCORING_PROFILE), { full: 1, half: 0 });
  assert.deepEqual(entryMistakeUnits(entry, { ...DEFAULT_SCORING_PROFILE, capMistakeUnitsPerWord: true }), { full: 1, half: 0 });
});

// AIIMS's NOTE 1, reproduced from the PDF's own example verbatim: a word
// with capitalization + spacing + a spelling substitution (2 Half & 1
// [promoted-to-]Full mistakes) is capped at exactly 1.0 mistake-equivalent
// unit, never summed to 1.5 or 2.0.
test("entryMistakeUnits caps a half-error entry with capitalization + spacing + a promoted spelling substitution at exactly 1 full unit (AIIMS's NOTE 1)", () => {
  const aiims = { ...DEFAULT_SCORING_PROFILE, minorSpellingIsFullMistake: true, capMistakeUnitsPerWord: true };
  const entry = { id: "1", status: "half-error", original: "hope", typed: "Ho pa", halfErrorCategories: ["capitalization", "spacing", "minorSpelling"] };
  assert.deepEqual(entryMistakeUnits(entry, aiims), { full: 1, half: 0 });
  // Without the cap, the same entry is 1 full (promoted spelling) + 1.0
  // half-equivalent (2 x 0.5) worth of the other two categories -- shows
  // the cap is doing real work, not a no-op.
  const uncapped = { ...DEFAULT_SCORING_PROFILE, minorSpellingIsFullMistake: true };
  assert.deepEqual(entryMistakeUnits(entry, uncapped), { full: 1, half: 2 });
});

test("entryMistakeUnits caps a half-error entry with 3 ordinary half categories (no promoted spelling) at 2 half units, never 3", () => {
  const capped = { ...DEFAULT_SCORING_PROFILE, capMistakeUnitsPerWord: true };
  const entry = { id: "1", status: "half-error", original: "I hope", typed: "i hope,", halfErrorCategories: ["capitalization", "spacing", "punctuation"] };
  assert.deepEqual(entryMistakeUnits(entry, capped), { full: 0, half: 2 });
  assert.deepEqual(entryMistakeUnits(entry, DEFAULT_SCORING_PROFILE), { full: 0, half: 3 });
});

test("minorSpellingIsFullMistake and capMistakeUnitsPerWord are each a strict no-op when absent or explicitly false -- identical analyzeTyping output to before either flag existed", () => {
  const passage = "The quick brown fox jumps over the lazy dog, and I hope it goes well.";
  const typedText = "The quikc brown fox fox jumps over lazy dog nearthe old barn today extra";
  const base = analyzeTyping(passage, typedText, DEFAULT_SCORING_PROFILE, true);
  const explicitFalse = analyzeTyping(passage, typedText, { ...DEFAULT_SCORING_PROFILE, minorSpellingIsFullMistake: false, capMistakeUnitsPerWord: false }, true);
  assert.equal(explicitFalse.fullErrors, base.fullErrors);
  assert.equal(explicitFalse.halfErrors, base.halfErrors);
  assert.equal(explicitFalse.totalPenalty, base.totalPenalty);
});

// The legacy two-expression sum in analyzeTyping's tail is kept as a
// literal, untouched branch for flagless profiles specifically so this
// equivalence can never silently drift -- pinned directly rather than
// relied upon structurally.
test("the legacy fullErrors/halfErrors sum agrees exactly with summing entryMistakeUnits() over every entry, for a flagless profile", () => {
  const passages = [
    ["The quick brown fox jumps over the lazy dog.", "The quikc brown fox fox jumps over lazy dog nearthe."],
    ["one two three four five six seven eight nine ten", "onee two three four fivee six  seven eight nine"],
  ];
  for (const [passage, typedText] of passages) {
    const analysis = analyzeTyping(passage, typedText, DEFAULT_SCORING_PROFILE, true);
    const reduced = analysis.entries.reduce((total, entry) => {
      const units = entryMistakeUnits(entry, DEFAULT_SCORING_PROFILE);
      return { full: total.full + units.full, half: total.half + units.half };
    }, { full: 0, half: 0 });
    assert.equal(reduced.full, analysis.fullErrors);
    assert.equal(reduced.half, analysis.halfErrors);
  }
});

test("categoryTotalsReconcile stays true for an AIIMS-flagged profile (capMistakeUnitsPerWord + minorSpellingIsFullMistake)", () => {
  const aiims = { ...DEFAULT_SCORING_PROFILE, fullErrorPenalty: 10, halfErrorPenalty: 5, minorSpellingIsFullMistake: true, capMistakeUnitsPerWord: true };
  const score = calculateTypingScore({ typedText: "Ho pa quikc brown fox extra", passage: "hope quick brown fox jumps", elapsedSeconds: 600, wordMethod: "characters", scoringProfile: aiims, includeUntypedWords: true });
  assert.equal(categoryTotalsReconcile(score, aiims), true);
});

// AIIMS's "Insufficient Attempt" minimum-strokes threshold is read only by
// the results UI (see ScoringProfile.minimumStrokesFromPassSpeed's own doc
// comment) -- this confirms the derivation (passNetWpm x 5 x duration
// minutes) matches the exact numbers already written in this category's
// own patternNotes (2625 English / 2250 Hindi), so the UI and the
// researched prose can never silently disagree.
test("AIIMS's derived minimum-strokes threshold (passNetWpm x 5 x duration minutes) matches its own researched patternNotes (2625 English / 2250 Hindi)", async () => {
  const { getExamPreset } = await import("../lib/typing-curriculum.ts");
  const { examCategoryPresetId } = await import("../lib/exam-categories.ts");
  const english = getExamPreset(examCategoryPresetId("aiims-cre-ldc", "English"));
  const hindi = getExamPreset(examCategoryPresetId("aiims-cre-ldc", "Hindi"));
  assert.ok(english && hindi, "both aiims-cre-ldc presets should exist");
  const minimumStrokes = (preset) => Math.round(preset.scoringProfile.passNetWpm * 5 * (preset.durationSeconds / 60));
  assert.equal(minimumStrokes(english), 2625);
  assert.equal(minimumStrokes(hindi), 2250);
  assert.equal(english.scoringProfile.minimumStrokesFromPassSpeed, true);
  assert.equal(english.scoringProfile.passAccuracy, 0, "AIIMS's own qualifying standard states only a speed threshold, no separate accuracy percentage");
});

test("early stop classifies the untouched suffix as zero-penalty remaining text", () => {
  const score = calculateTypingScore({ typedText: "one", passage: "one two three four", elapsedSeconds: 30, wordMethod: "characters", includeUntypedWords: true });
  assert.deepEqual(score.analysis.entries.map((entry) => entry.status), ["correct", "remaining", "remaining", "remaining"]);
  assert.equal(score.analysis.counts.missing, 0);
  assert.equal(score.analysis.counts.remaining, 3);
  assert.equal(score.analysis.remainingWords, 3);
  assert.equal(score.analysis.remainingCharacters, 14);
  assert.equal(score.analysis.fullErrors, 0);
  assert.equal(score.analysis.totalPenalty, 0);
  assert.equal(score.incorrectCharacters, 0);
  assert.equal(score.netWpm, score.grossWpm);
});

test("classifies one or several skipped words as missing and realigns later words", () => {
  assert.deepEqual(statuses("one two three four five", "one three five").map((entry) => entry.status), ["correct", "missing", "correct", "missing", "correct"]);
});

test("a skipped word is missing while a later untouched suffix remains neutral", () => {
  const analysis = analyzeTyping("one two three four", "one three");
  assert.deepEqual(analysis.entries.map((entry) => entry.status), ["correct", "missing", "correct", "remaining"]);
  assert.equal(analysis.counts.missing, 1);
  assert.equal(analysis.counts.remaining, 1);
  assert.equal(analysis.fullErrors, 1);
  assert.equal(analysis.totalPenalty, DEFAULT_SCORING_PROFILE.fullErrorPenalty);
});

test("omitted words do not fabricate wrong typed characters", () => {
  const score = calculateTypingScore({ typedText: "one three", passage: "one two three four", elapsedSeconds: 60, wordMethod: "characters", includeUntypedWords: true });
  assert.equal(score.analysis.counts.missing, 1);
  assert.equal(score.analysis.counts.remaining, 1);
  assert.equal(score.incorrectCharacters, 0);
  assert.equal(score.correctCharacters, score.totalCharacters);
  assert.equal(score.accuracy, 100);
  assert.ok(score.netWpm <= score.grossWpm);
});

test("a substitution advances the attempted boundary without penalizing its suffix", () => {
  const analysis = analyzeTyping("one two three four", "one seven");
  assert.deepEqual(analysis.entries.map((entry) => entry.status), ["correct", "substituted", "remaining", "remaining"]);
  assert.equal(analysis.counts.substituted, 1);
  assert.equal(analysis.counts.remaining, 2);
  assert.equal(analysis.fullErrors, 1);
});

test("classifies a skipped complete line as missing while preserving its newline", () => {
  const entries = alignWords("first line\nskipped complete line\nlast line", "first line\nlast line", DEFAULT_SCORING_PROFILE, true);
  assert.deepEqual(entries.filter((entry) => entry.status === "missing").map((entry) => entry.original), ["skipped", "complete", "line"]);
  assert.equal(entries.find((entry) => entry.original === "line" && entry.originalIndex === 4)?.separatorAfter, "\n");
  assert.deepEqual(entries.slice(-2).map((entry) => entry.status), ["correct", "correct"]);
});

test("distinguishes repeated words, phrases, and complete lines from ordinary extra text", () => {
  const repeatedWord = analyzeTyping("one two three", "one two two three");
  assert.equal(repeatedWord.counts.repeated, 1);
  assert.deepEqual(repeatedWord.entries.map((entry) => entry.status), ["correct", "correct", "repeated", "correct"]);
  assert.equal(analyzeTyping("one two three four", "one two one two three four").counts.repeated, 2);
  const line = analyzeTyping("alpha beta\ngamma delta", "alpha beta\nalpha beta\ngamma delta");
  assert.equal(line.counts.repeated, 2);
  assert.deepEqual(line.entries.filter((entry) => entry.status === "repeated").map((entry) => entry.typed), ["alpha", "beta"]);
  const ordinary = analyzeTyping("one two three", "one unrelated two three");
  assert.equal(ordinary.counts.extra, 1);
  assert.equal(ordinary.counts.repeated, 0);
});

test("does not flag legitimate duplicate words or unfinished content as repeated", () => {
  const legitimate = analyzeTyping("work carefully and work accurately", "work carefully and work accurately");
  assert.equal(legitimate.counts.repeated, 0);
  const unfinished = analyzeTyping("one two three four", "one two", DEFAULT_SCORING_PROFILE, true);
  assert.equal(unfinished.counts.repeated, 0);
  assert.equal(unfinished.counts.missing, 0);
  assert.equal(unfinished.counts.remaining, 2);
});

test("remaining suffix detection supports English, Hindi Unicode, and Kruti Dev tokens", () => {
  for (const [passage, typed] of [
    ["one two three", "one"],
    ["कक्षा में ध्यान", "कक्षा"],
    ["jktLFkku ljdkj ijh{kk", "jktLFkku"],
  ]) {
    const analysis = analyzeTyping(passage, typed);
    assert.equal(analysis.counts.remaining, 2);
    assert.equal(analysis.counts.missing, 0);
    assert.equal(analysis.fullErrors, 0);
    assert.equal(analysis.totalPenalty, 0);
  }
});

test("handles Hindi Unicode grapheme clusters for repetition and omission", () => {
  const repeated = analyzeTyping("कक्षा में ध्यान रखें", "कक्षा में कक्षा में ध्यान रखें");
  assert.equal(repeated.counts.repeated, 2);
  const omitted = analyzeTyping("कक्षा में ध्यान रखें", "कक्षा ध्यान रखें");
  assert.equal(omitted.counts.missing, 1);
  assert.equal(omitted.entries.at(-1).status, "correct");
});

test("handles Kruti Dev raw tokens for repetition and omission without normalization", () => {
  const repeated = analyzeTyping("jktLFkku ljdkj ijh{kk", "jktLFkku ljdkj ljdkj ijh{kk");
  assert.equal(repeated.counts.repeated, 1);
  const omitted = analyzeTyping("jktLFkku ljdkj ijh{kk", "jktLFkku ijh{kk");
  assert.equal(omitted.counts.missing, 1);
  assert.equal(omitted.entries.at(-1).status, "correct");
});

test("repeated content keeps the existing extra-content scoring penalty", () => {
  const profile = { ...DEFAULT_SCORING_PROFILE, fullErrorPenalty: 2 };
  const extra = analyzeTyping("one two three", "one bonus two three", profile);
  const repeated = analyzeTyping("one two three", "one one two three", profile);
  assert.equal(extra.totalPenalty, 2);
  assert.equal(repeated.totalPenalty, extra.totalPenalty);
  assert.equal(repeated.fullErrors, 1);
});

test("active typing workspaces defer full scoring until completion", () => {
  const exam = readFileSync(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8");
  const lesson = readFileSync(new URL("../app/typing/_components/lesson-workspace.tsx", import.meta.url), "utf8");
  assert.match(exam, /finished \? calculateTypingScore/);
  assert.match(lesson, /completed \? calculateTypingScore/);
  assert.match(exam, /useMemo\(\(\) => segmentGraphemes\(passage\), \[passage\]\)/);
  assert.doesNotMatch(exam, /const passageUnits = segmentGraphemes\(passage\)/);
});

test("input validation keeps deletion restrictions without duplicate insertion work", () => {
  const exam = readFileSync(new URL("../app/typing/_components/configurable-typing-exam.tsx", import.meta.url), "utf8");
  assert.match(exam, /typeof nativeInputType === "string" \? nativeInputType : ""/);
  assert.match(exam, /inputType\.startsWith\("history"\)/);
  assert.doesNotMatch(exam, /typeof native\.data === "string"/);
  assert.match(exam, /if \(!allowed\(from, end/);
  assert.match(exam, /onPaste=\{\(event\) => \{ if \(!adminPreview\) event\.preventDefault\(\); \}\}/);
});

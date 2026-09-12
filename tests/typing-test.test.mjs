import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_SCORING_PROFILE,
  alignWords,
  analyzeTyping,
  calculateTypingScore,
  isAllowedTypingEdit,
} from "../lib/typing-test.ts";

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

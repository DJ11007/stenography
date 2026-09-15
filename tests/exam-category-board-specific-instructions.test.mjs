import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXAM_CATEGORIES } from "../lib/exam-categories.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression guard for a real requested feature: each of the 25 exam
// categories previously carried a generic 1-2 line patternNotes entry, most
// of which said nothing about the actual marking scheme, backspace policy,
// or on-screen highlighting behaviour for that specific board. Every
// category now has several researched, board-specific notes covering at
// least one of those three topics -- not a copy-pasted template shared
// across categories.
test("every exam category's patternNotes are individually researched (not templated) and cover the requested topics", () => {
  assert.ok(EXAM_CATEGORIES.length >= 25);
  const topicWords = /mark|backspace|highlight|error|mistake|keystroke|accuracy|WPM|qualify/i;
  for (const category of EXAM_CATEGORIES) {
    assert.ok(category.patternNotes.length >= 2, `${category.slug} should have more than a one-line note`);
    assert.ok(category.patternNotes.some((note) => topicWords.test(note)), `${category.slug}'s notes should mention marks, backspace, highlighting, or error tolerance`);
  }
  // Notes are genuinely per-category, not a shared template string repeated
  // across every entry.
  const allNotesJoined = EXAM_CATEGORIES.map((category) => category.patternNotes.join(" ")).join("\n");
  const uniqueNoteSets = new Set(EXAM_CATEGORIES.map((category) => category.patternNotes.join("|")));
  assert.equal(uniqueNoteSets.size, EXAM_CATEGORIES.length, "no two categories should share an identical patternNotes array");
  assert.ok(allNotesJoined.length > 5000);
});

// A category whose real pattern genuinely could not be confirmed (Bihar
// Civil Court Clerk) must stay honestly marked unsourced rather than have a
// fabricated-sounding pattern applied to it just because most other
// categories now have rich research. Jharkhand High Court Assistant, by
// contrast, WAS genuinely upgraded during a later deep-research pass (a
// real source gave 200 words/5 min/40 WPM English vs 300 words/10 min/30
// WPM Hindi) -- a real fact-finding upgrade, not a silent/fabricated one.
test("a category with no confirmed official notification stays marked unsourced (Bihar Civil Court Clerk), while one genuinely upgraded by later research (Jharkhand HC Assistant) is marked sourced with its own real, asymmetric per-language duration", () => {
  const bihar = EXAM_CATEGORIES.find((category) => category.slug === "bihar-civil-court-clerk");
  const jharkhand = EXAM_CATEGORIES.find((category) => category.slug === "jharkhand-hc-assistant");
  assert.ok(bihar && jharkhand);
  assert.equal(bihar.patternSourced, false);
  assert.ok(bihar.patternNotes.some((note) => /no confirmed pattern|verify/i.test(note)));
  assert.equal(jharkhand.patternSourced, true);
  assert.equal(jharkhand.durationMinutes, 5);
  assert.equal(jharkhand.durationMinutesHindi, 10);
  assert.equal(jharkhand.speedEnglish, 40);
  assert.equal(jharkhand.speedHindi, 30);
});

// The exam simulator's own start screen (not just the /category/[slug] rules
// page reached before it) now shows these same board-specific notes and
// whether they're researched or estimated -- threaded through ExamPreset so
// ExamStart doesn't need to re-derive them from the category list.
test("ExamStart (exam mode) renders instructionNotes and a researched-vs-estimated badge", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /preset\.instructionNotes\?\.map\(\(note\) => <li key=\{note\}>\{note\}<\/li>\)/);
  assert.match(workspace, /preset\.patternSourced !== undefined && <p/);
  assert.match(workspace, /Pattern researched from this board's published exam-pattern/);
  assert.match(workspace, /No confirmed official pattern was found for this exact post/);
  // The earlier redesign turn's own instructions claimed the timer starts on
  // the Begin Simulation click, which is false for every non-audio exam --
  // the timer actually starts on the first keystroke (see beginTiming /
  // onFirstTypingInput). Guard against that inaccuracy recurring.
  assert.doesNotMatch(workspace, /timer begins the instant you click <strong>Begin Simulation/);
  assert.match(workspace, /timer begins the moment you type your first keystroke/);
});

test("every category resolves to a preset carrying its own instructionNotes and patternSourced, in both languages", () => {
  for (const category of EXAM_CATEGORIES.slice(0, 5)) {
    for (const language of ["English", "Hindi"]) {
      const preset = getExamPreset(`exam-cat-${category.slug}-${language.toLowerCase()}`);
      assert.ok(preset, `missing preset for ${category.slug}/${language}`);
      assert.deepEqual(preset.instructionNotes, language === "Hindi" ? (category.patternNotesHindi ?? category.patternNotes) : category.patternNotes);
      assert.equal(preset.patternSourced, category.patternSourced);
    }
  }
  // The four base (non-category) presets and the stenography presets have no
  // specific recruiting-authority pattern to cite -- instructionNotes/
  // patternSourced must stay undefined for them, so ExamStart keeps its
  // generic instructions instead of an empty researched/estimated badge.
  const base = getExamPreset("rssb-ldc-english");
  assert.ok(base);
  assert.equal(base.instructionNotes, undefined);
  assert.equal(base.patternSourced, undefined);
});

// The category rules page's old blanket disclaimer ("Terms & conditions...
// have not been finalized yet... generic placeholders") was false for every
// category that now has real research applied to it. It must reflect each
// category's own patternSourced state instead of a single static claim.
test("the category rules page's disclaimer box reflects each category's own research state, not a blanket placeholder claim", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.doesNotMatch(page, /generic placeholders/);
  assert.doesNotMatch(page, /have not been finalized yet/);
  assert.match(page, /category\.patternSourced \? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"/);
  assert.match(page, /researched from \{category\.name\}&apos;s published exam-pattern guidance/);
  assert.match(page, /No confirmed official notification was found for \{category\.name\}&apos;s exact typing-test pattern/);
});

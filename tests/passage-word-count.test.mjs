import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { repeatPassageToExactWordCount } from "../lib/typing-curriculum.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real requested feature: a student can choose the passage length (150-700
// words) for Learn Typing, Practice Tests, and Exam Simulator -- but never
// Stenography (a dictation passage is paired to a fixed audio recording),
// and never while any typing rule is already officially locked or once
// typing has actually started.

test("repeatPassageToExactWordCount is exported and correctly truncates/cycles arbitrary text", () => {
  const source = "one two three four five";
  assert.equal(repeatPassageToExactWordCount(source, 3), "one two three");
  assert.equal(repeatPassageToExactWordCount(source, 5), source);
  assert.equal(repeatPassageToExactWordCount(source, 7), "one two three four five one two");
});

test("ConfigurableTypingExam computes an effective, resampled passage that stays stable once typing starts", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /const showPassageWordCount = preset\.category !== "stenography";/);
  assert.match(workspace, /const wordCountEditable = showPassageWordCount && !rulesLocked;/);
  assert.match(workspace, /const passageWordCountLocked = !wordCountEditable \|\| timerStarted;/);
  assert.match(workspace, /const effectivePassage = useMemo\(\(\) => wordCountEditable && preferences\.passageWordCount \? repeatPassageToExactWordCount\(passage, preferences\.passageWordCount\) : passage, \[wordCountEditable, preferences\.passageWordCount, passage\]\);/);
  // effectivePassage must NOT be re-gated on passageWordCountLocked/timerStarted --
  // otherwise the passage a student is mid-way through typing would silently
  // revert to its natural length the instant they type their first keystroke.
  assert.doesNotMatch(workspace, /effectivePassage = useMemo\(\(\) => showPassageWordCount && !passageWordCountLocked/);
  assert.match(workspace, /passage=\{effectivePassage\}/);
  assert.match(workspace, /passage: getScoringText\(effectivePassage, inputSystem\)/);
  assert.match(workspace, /passageWordCount:wordCountEditable\?preferences\.passageWordCount:null/);
});

test("the Settings popup renders a locked/hidden-appropriately gated Passage length control", async () => {
  const settings = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.match(settings, /showPassageWordCount && onPassageWordCountChange/);
  assert.match(settings, /Passage length \(words\)/);
  assert.match(settings, /type="number" min=\{150\} max=\{700\} disabled=\{passageWordCountLocked\}/);
  assert.match(settings, /Math\.min\(700, Math\.max\(150, Math\.round\(raw\)\)\)/);
});

test("resetSettings also resets passage word count back to the test's natural length when unlocked", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /if \(!passageWordCountLocked\) onPassageWordCountChange\(null\);/);
});

test("recordManagedAttempt only honors a student-chosen word count for a genuinely unlocked (non-live Practice, non-Stenography) managed test, re-deriving that server-side rather than trusting the client", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /const wordCountCustomizable = version\.mode === "practice" && !test\.is_live && preset\.category !== "stenography";/);
  assert.match(actions, /repeatPassageToExactWordCount\(resolvedPassage, requestedWordCount\)/);
  assert.match(actions, /passage: getScoringText\(effectivePassage, inputSystem\)/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EXAM_PATH = "app/typing/_components/configurable-typing-exam.tsx";

// Reference stenography platforms block Submit on a dictation test until the
// student has typed a minimum share of the dictated matter (seen quoted as
// "Required content: 20% minimum (0/83 words)") -- stopping a near-blank
// attempt from burning a test's limited attempt count. Only meaningful for
// dictation tests, since a plain passage test's typed length is already
// visibly compared against the on-screen original as the student types.
test("a dictation (audio) test computes a minimum-content requirement as a percentage of the dictated matter's word count", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /const MINIMUM_DICTATION_CONTENT_PERCENT = 20;/);
  assert.match(editor, /const dictationRequiredWordCount = preset\.audioUrl \? Math\.ceil\(countPassageWords\(effectivePassage\) \* MINIMUM_DICTATION_CONTENT_PERCENT \/ 100\) : 0;/);
  assert.match(editor, /const dictationTypedWordCount = countPassageWords\(typedText\);/);
  assert.match(editor, /const contentRequirementMet = dictationRequiredWordCount === 0 \|\| dictationTypedWordCount >= dictationRequiredWordCount;/);
});

test("submit (both the toolbar button's onClick and the Ctrl+Enter shortcut) is blocked while the content requirement isn't met", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /const submit = \(\) => \{ if \(!contentRequirementMet\) return;/);
  assert.match(editor, /if\(!finished&&\(!preset\.audioUrl\|\|dictationReady\)&&contentRequirementMet\)submit\(\)/);
});

test("the workspace passes the content status down and disables/labels the Submit button while short, with a visible status pill", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /contentStatus=\{dictationRequiredWordCount > 0 \? \{ typed: dictationTypedWordCount, required: dictationRequiredWordCount \} : null\}/);
  assert.match(editor, /contentStatus: \{ typed: number; required: number \} \| null/);
  assert.match(editor, /disabled=\{Boolean\(contentStatus && contentStatus\.typed < contentStatus\.required\)\}/);
  assert.match(editor, /Required content: \{MINIMUM_DICTATION_CONTENT_PERCENT\}% minimum \(\{contentStatus\.typed\}\/\{contentStatus\.required\} words\)/);
});

test("a non-dictation test (no audioUrl) never gets a content requirement, so this never affects existing practice/exam behavior", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /preset\.audioUrl \? Math\.ceil\(countPassageWords\(effectivePassage\) \* MINIMUM_DICTATION_CONTENT_PERCENT \/ 100\) : 0/);
});

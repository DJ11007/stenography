import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EXAM_PATH = "app/typing/_components/configurable-typing-exam.tsx";

// Real reported bug: a "Required content: 20% minimum (X/Y words)" gate
// (added deliberately, mirroring reference stenography platforms) blocked
// Submit until the student had typed a minimum share of the dictated
// matter -- but a student who genuinely wanted to submit early (e.g. to
// end a bad attempt rather than burn the full timer) had no way to. The
// only thing that should ever stop a submission is a genuinely empty
// attempt, which would score as a meaningless 0/0 result and is more
// likely a misclick than an intentional early submission.
test("Submit is never blocked by how much the student has typed -- only a completely empty attempt is blocked, with an alert", async () => {
  const editor = await read(EXAM_PATH);
  assert.doesNotMatch(editor, /MINIMUM_DICTATION_CONTENT_PERCENT/);
  assert.doesNotMatch(editor, /contentRequirementMet/);
  assert.doesNotMatch(editor, /contentStatus/);
  assert.match(editor, /const submit = \(\) => \{ if \(!typedText\.trim\(\)\) \{ window\.alert\("Please write at least one word before submitting\."\); return; \}/);
});

test("the Submit button is always enabled (no disabled/title tied to a content requirement) and the Ctrl+Enter shortcut no longer checks one either", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /<button type="button" onClick=\{onSubmit\} className="flex h-9 items-center justify-center rounded-lg bg-white px-4 text-xs font-black text-blue-800 hover:bg-blue-50">Submit<\/button>/);
  assert.match(editor, /if\(!started\)start\(\);else if\(!finished&&\(!preset\.audioUrl\|\|dictationReady\)\)submit\(\);/);
});

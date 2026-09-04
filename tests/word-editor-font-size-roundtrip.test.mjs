import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EDITOR = "app/typing/word-efficiency/[language]/[testId]/workspace/rich-document-editor.tsx";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Regression test for a real, reported bug: paragraphs visibly growing or
// shrinking while working on the Model Answer page (and, since this is the
// shared student-facing editor, potentially anywhere a document round-trips
// through toSnapshot() and back).
//
// getComputedStyle(...).fontSize is always reported in px -- but every
// run's fontSize is stored as a bare number and re-rendered as
// `${run.fontSize}pt` (see renderSnapshot's `span.style.fontSize =
// `${run.fontSize}pt``). approvedSize() -- the one function that turns a
// computed style into a stored run.fontSize -- was taking that px number
// literally as if it were already pt, with no unit conversion at all. A
// run declared at 14pt (renders at 18.6667px) round-tripped through
// toSnapshot() as fontSize 18.6667, then got rendered back as
// "18.6667pt" literally -- about 33% larger every round-trip (autosave
// restore, reopening a saved Model Answer, Compare Current), compounding
// on repeated saves.
//
// fontDialog() and applyFontStep() elsewhere in this same file already do
// this conversion correctly (parseFloat(computed px) * .75, since
// 1pt = 1.3333px) -- approvedSize() was the one place that forgot it.
test("approvedSize() converts getComputedStyle's px font-size to pt before it's stored, matching fontDialog()/applyFontStep()'s own conversion", async () => {
  const editor = await read(EDITOR);
  const body = editor.slice(editor.indexOf("function approvedSize"));
  assert.match(body, /function approvedSize\(value:string\)\{const size=Math\.round\(Number\.parseFloat\(value\)\*\.75\);return Number\.isFinite\(size\)&&size>=8&&size<=72\?size:null\}/);

  // Confirm the two known-correct px->pt conversions elsewhere in this
  // file use the exact same *.75 factor, so approvedSize is now
  // consistent with them rather than introducing a second, different one.
  assert.match(editor, /fontSize:style\?String\(Math\.round\(Number\.parseFloat\(style\.fontSize\)\*\.75\)\):"11"/);
  assert.match(editor, /current=Number\.parseFloat\(parent\?getComputedStyle\(parent\)\.fontSize:"11"\)\*\.75/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Matches a reference stenography site's pre-typing setup screen (timer +
// dictation-category checkboxes + Exit/Next side by side, on the same
// screen as the audio). The dictation gate already had the audio and the
// categories; it now also offers the adjustable timer (reusing the exact
// duration-picker pattern ExamStart already uses) and an Exit link back
// out, so a student never has to commit to starting a dictation blind.
test("the dictation gate offers an adjustable timer (when not locked) using the same duration-picker pattern as ExamStart, and an Exit link back out", async () => {
  const gate = await read("app/typing/_components/dictation-gate.tsx");
  assert.match(gate, /durationSeconds: number;\s*durationLocked: boolean;\s*onDurationChange: \(minutes: number\) => void;\s*backHref\?: string;/);
  assert.match(gate, /\{!durationLocked && <label className="mt-4 block max-w-xs text-sm font-bold text-slate-800">Timer/);
  assert.match(gate, /PRACTICE_DURATION_MINUTES\.includes\(durationSeconds \/ 60\)/);
  assert.match(gate, /\{backHref && <Link href=\{backHref\} className="rounded-xl border-2 border-red-200 px-6 py-4 text-lg font-black text-red-700 hover:bg-red-50">Exit<\/Link>\}/);
});

test("the workspace threads its own duration/backHref state into the dictation gate instead of the gate managing its own copy", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /<DictationGate preset=\{preset\} url=\{preset\.audioUrl\} selectedCategories=\{selectedCategories\} onCategoriesChange=\{setSelectedCategories\} onStartTyping=\{\(\) => \{ beginTiming\(\); setDictationReady\(true\); \}\} durationSeconds=\{activeDurationSeconds\} durationLocked=\{durationLocked\} onDurationChange=\{changeDuration\} backHref=\{backHref\} adminPreview=\{adminPreview\}\/>/);
});

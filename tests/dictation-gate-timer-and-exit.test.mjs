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
// The Exit button used to only appear when a caller opted in with its own
// backHref -- most callers of ConfigurableTypingExam don't, leaving a dead
// end mid-dictation with no way out but closing the tab. ExitButton now
// always renders, falling back to router.back() (matching BackButton's own
// fallback elsewhere) when no backHref was supplied.
test("the dictation gate offers an adjustable timer (when not locked) using the same duration-picker pattern as ExamStart, and an Exit button that always renders (falling back to browser back when no backHref was given)", async () => {
  const gate = await read("app/typing/_components/dictation-gate.tsx");
  assert.match(gate, /durationSeconds: number;\s*durationLocked: boolean;\s*onDurationChange: \(minutes: number\) => void;\s*backHref\?: string;/);
  assert.match(gate, /\{!durationLocked && <label className="mt-4 block max-w-xs text-sm font-bold text-slate-800">Timer/);
  assert.match(gate, /PRACTICE_DURATION_MINUTES\.includes\(durationSeconds \/ 60\)/);
  assert.match(gate, /<ExitButton href=\{backHref\}\/>/);
  assert.match(gate, /function ExitButton\(\{ href \}: \{ href\?: string \}\) \{/);
  assert.match(gate, /if \(href\) return <Link href=\{href\} className=\{className\}>Exit<\/Link>;/);
  assert.match(gate, /return <button type="button" onClick=\{\(\) => router\.back\(\)\} className=\{className\}>Exit<\/button>;/);
});

test("the workspace threads its own duration/backHref state into the dictation gate instead of the gate managing its own copy", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /<DictationGate preset=\{preset\} url=\{preset\.audioUrl\} selectedCategories=\{selectedCategories\} onCategoriesChange=\{setSelectedCategories\} onStartTyping=\{\(\) => \{ beginTiming\(\); setDictationReady\(true\); \}\} durationSeconds=\{activeDurationSeconds\} durationLocked=\{durationLocked\} onDurationChange=\{changeDuration\} backHref=\{backHref\} adminPreview=\{adminPreview\} practiceNavigation=\{practiceNavigation\} onNavigateTest=\{navigatePracticeTest\}\/>/);
});

// Real reported request: a student on the dictation-listening screen (a
// real dictation test entered via the "Take Tests" practice flow, e.g.
// from the Stenography category page's own real-test navigator) should be
// able to switch to a different test from here too, not just from the
// in-workspace header that only appears once typing has actually started
// -- the exact same "‹ Test X of Y ▾ ›" control as ExamWorkspace's own
// practice navigation nav, reusing the same practiceNavigation data and
// navigatePracticeTest function ConfigurableTypingExam already builds.
test("the dictation gate renders the same practice-test navigator (arrows + dropdown) as the in-workspace header, when one is available", async () => {
  const gate = await read("app/typing/_components/dictation-gate.tsx");
  assert.match(gate, /import type \{ PracticeNavigation \} from "\.\/configurable-typing-exam";/);
  assert.match(gate, /practiceNavigation\?: PracticeNavigation;\s*\n\s*onNavigateTest\?: \(href: string\) => void;/);
  assert.match(gate, /\{practiceNavigation && onNavigateTest && \(/);
  assert.match(gate, /aria-label="Previous test"/);
  assert.match(gate, /aria-label="Next test"/);
  assert.match(gate, /value=\{practiceNavigation\.items\[practiceNavigation\.currentIndex\]\?\.href\} onChange=\{\(event\) => onNavigateTest\(event\.target\.value\)\}/);
});

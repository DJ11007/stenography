import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

// A live test follows its official rules for every student, in typing, stenography and efficiency
// tests alike; student-side changes are for practice tests only.
test("typing / stenography live test: 'Unlock official rules' is not offered and does nothing; highlight is fixed too", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(exam, /const isLiveTest = Boolean\(managedTest\?\.isLive\);/);
  assert.match(exam, /const manualUnlock = requestedUnlock && !isLiveTest;/);
  assert.match(exam, /onManualUnlockChange=\{!timerStarted && !isLiveTest \? setManualUnlock : undefined\}/);
  assert.match(exam, /const highlightLocked = rulesLocked && \(categoryHighlightConfirmed \|\| isLiveTest\) && !manualUnlock;/);
  const settings = await read("lib/typing-platform-settings.ts");
  assert.match(settings, /return \{ duration: true, highlightMode: true, backspaceMode: true, wordMethod: true \};/, "duration, highlight, backspace, word calculation locked");
});

test("stenography live test: dictation plays once at normal speed, no pause/seek/replay, graded mistake types fixed", async () => {
  const [gate, exam] = await Promise.all([read("app/typing/_components/dictation-gate.tsx"), read("app/typing/_components/configurable-typing-exam.tsx")]);
  assert.match(exam, /<DictationGate live=\{isLiveTest\}/);
  assert.match(gate, /if \(live\) \{ if \(audio\.paused && !playedThrough\) void audio\.play\(\); return; \}/);
  assert.match(gate, /if \(!live && audio && duration\) audio\.currentTime = fraction \* duration;/);
  assert.match(gate, /<select value=\{live \? 1 : speed\} disabled=\{live\}/);
  assert.match(gate, /checked=\{selectedCategories\.includes\(category\)\} disabled=\{live\}/);
});

test("efficiency live test (Word, Excel): no duration choice on the card or instructions, and the database refuses another duration", async () => {
  const [wordCard, wordInstructions, excelCard, excelInstructions, liveList, migration] = await Promise.all([
    read("app/typing/word-efficiency/_components/word-test-catalogue.tsx"), read("app/typing/word-efficiency/[language]/[testId]/instructions/page.tsx"),
    read("app/typing/excel-efficiency/_components/excel-test-catalogue.tsx"), read("app/typing/excel-efficiency/[language]/[testId]/instructions/page.tsx"),
    read("app/live-test/page.tsx"), read("supabase/migrations/202610251100_live_efficiency_tests_fixed_duration.sql")]);
  assert.match(wordCard, /version\.duration_options\.length>1&&!test\.is_live\?<label/);
  assert.match(wordInstructions, /const duration=!test\.is_live&&version\.duration_options\.includes\(selected\)\?selected:version\.duration_options\[0\];/);
  assert.match(excelCard, /duration_options\.length>1&&!test\.is_live\?<label/);
  assert.match(excelInstructions, /const duration = !test\.is_live && version\.duration_options\.includes\(selected\) \? selected : version\.duration_options\[0\];/);
  assert.match(liveList, /duration_seconds: test\.duration_options\[0\] \?\? 0,/);
  assert.match(migration, /if test_record\.is_live and p_duration_seconds<>version_record\.duration_options\[1\] then raise exception ''a live test runs for its set duration''/);
  assert.match(migration, /if t\.is_live and p_duration_seconds<>v\.duration_options\[1\] then raise exception ''a live test runs for its set duration''/);
});

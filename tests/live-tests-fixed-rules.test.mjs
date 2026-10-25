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

// A live efficiency test is two things at once: the live attempt, opened from the Live Test page (?live=1), with
// its set duration and one attempt; and ordinary practice in the Efficiency section, any time, any duration.
test("efficiency live test (Word, Excel): the Live Test page opens the live attempt, the Efficiency section opens practice", async () => {
  const [wordCard, wordInstructions, wordLaunch, wordActions, excelCard, excelInstructions, excelLaunch, excelActions, liveList, migration, wordServer, excelServer] = await Promise.all([
    read("app/typing/word-efficiency/_components/word-test-catalogue.tsx"), read("app/typing/word-efficiency/[language]/[testId]/instructions/page.tsx"),
    read("app/typing/word-efficiency/[language]/[testId]/instructions/student-test-launch.tsx"), read("app/typing/word-efficiency/actions.ts"),
    read("app/typing/excel-efficiency/_components/excel-test-catalogue.tsx"), read("app/typing/excel-efficiency/[language]/[testId]/instructions/page.tsx"),
    read("app/typing/excel-efficiency/[language]/[testId]/instructions/student-test-launch.tsx"), read("app/typing/excel-efficiency/actions.ts"),
    read("app/live-test/page.tsx"), read("supabase/migrations/202610251500_efficiency_practice_while_live.sql"),
    read("lib/word-efficiency-server.ts"), read("lib/excel-efficiency-server.ts")]);
  // Listed in the Efficiency section with the duration choice, live or not.
  assert.doesNotMatch(wordServer, /eq\("is_live",false\)/);
  assert.doesNotMatch(excelServer, /eq\("is_live", false\)/);
  assert.match(wordCard, /version\.duration_options\.length>1\?<label/);
  assert.match(excelCard, /version\.duration_options\.length>1\?<label/);
  // Only the Live Test page's link is the live attempt.
  assert.match(liveList, /\/instructions\?live=1`/);
  assert.match(liveList, /duration_seconds: test\.duration_options\[0\] \?\? 0,/);
  assert.match(wordInstructions, /const live=Boolean\(test\.is_live\)&&query\.live==="1";/);
  assert.match(wordInstructions, /const duration=!live&&version\.duration_options\.includes\(selected\)\?selected:version\.duration_options\[0\];/);
  assert.match(excelInstructions, /const live = Boolean\(test\.is_live\) && query\.live === "1";/);
  assert.match(excelInstructions, /const duration = !live && version\.duration_options\.includes\(selected\) \? selected : version\.duration_options\[0\];/);
  assert.match(wordLaunch, /\{live&&<input type="hidden" name="live" value="1"\/>\}/);
  assert.match(excelLaunch, /\{live && <input type="hidden" name="live" value="1" \/>\}/);
  assert.match(wordActions, /p_delivery:delivery,p_live:live\}\);/);
  assert.match(excelActions, /p_live: live \}\);/);
  // The database: the live rules (window, one attempt, set duration) apply only to a live attempt.
  assert.match(migration, /p_delivery text, p_live boolean DEFAULT true\)/);
  assert.match(migration, /replace\(def, 'test_record\.is_live', '\(test_record\.is_live and coalesce\(p_live,true\)\)'\)/);
  assert.match(migration, /p_show_questions boolean, p_live boolean DEFAULT true\)/);
  assert.match(migration, /replace\(def, 't\.is_live', '\(t\.is_live and coalesce\(p_live,true\)\)'\)/);
});

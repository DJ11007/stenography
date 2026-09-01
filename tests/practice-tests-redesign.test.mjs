import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRACTICE_DURATION_MINUTES } from "../lib/typing-test.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PRACTICE_DURATION_MINUTES is 1-25 in 1-minute steps then 30-70 in 5-minute steps", () => {
  const expected = [...Array.from({ length: 25 }, (_, i) => i + 1), 30, 35, 40, 45, 50, 55, 60, 65, 70];
  assert.deepEqual(PRACTICE_DURATION_MINUTES, expected);
});

test("Practice Tests admin form no longer asks for Description or Required WPM/Accuracy, and explains duration is student-chosen; Exam/Live still ask for all of it", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /\{showAdminRules && <Field label="Description">/);
  assert.match(manager, /\{showAdminRules && <div className="grid grid-cols-2 gap-3"><Field label="Required WPM">/);
  assert.match(manager, /Practice tests aren&apos;t graded against a target -- required speed\/accuracy default to 30 WPM \/ 90%/);
  assert.match(manager, /Duration is picked by the student \(1–25 min, then 5-min steps to 70\)/);
});

test("the server hardcodes 30 WPM / 90% accuracy for plain practice tests, ignoring whatever the form submits", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /const isPlainPractice = mode === "practice" && !isLive;/);
  assert.match(actions, /requiredWpm: isPlainPractice \? 30 : Number\(formData\.get\("requiredWpm"\)\),/);
  assert.match(actions, /requiredAccuracy: isPlainPractice \? 90 : Number\(formData\.get\("requiredAccuracy"\)\),/);
});

test("a practice-mode managed test's duration is no longer forced to the admin's fixed value (real fix -- it used to be, even though the UI showed it as editable)", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /const activeDurationSeconds = attemptVariant === "official" \|\| matterPreset \|\| \(Boolean\(managedTest\) && managedRulesLocked\) \? preset\.durationSeconds : preferences\.durationMinutes \* 60;/);
  // Every other managed mode still forces it: managedRulesLocked is true for
  // everything except practice-non-live (see managedTestSettingsLocks), so
  // Boolean(managedTest) && managedRulesLocked is unchanged (still true) for
  // exam/learn/stenography/live -- only practice-non-live newly evaluates false.
  assert.match(workspace, /PRACTICE_DURATION_MINUTES/);
});

test("ExamStart's duration control is the stepped picker, not a free-form 1-60 number input", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.doesNotMatch(workspace, /Duration \(1–60 minutes\)/);
  assert.match(workspace, /\{!durationLocked && <label className="mt-6 block max-w-xs text-sm font-bold">Duration<select/);
  assert.match(workspace, /PRACTICE_DURATION_MINUTES\.includes\(durationSeconds \/ 60\)/);
});

test("SectionTestPage accepts an optional language/inputSystemId scope, filters the test list by it, and passes it through to TestManager as a lock", async () => {
  const page = await read("app/admin/tests/section-test-page.tsx");
  assert.match(page, /language\?: "English" \| "Hindi"; inputSystemId\?: string; backHref\?: string/);
  assert.match(page, /if \(language\) query = query\.eq\("language", language\);/);
  assert.match(page, /if \(inputSystemId\) query = query\.eq\("input_system_id", inputSystemId\);/);
  assert.match(page, /<TestManager tests=\{rows\} lockedMode=\{mode\} lockedLanguage=\{language\} lockedInputSystemId=\{inputSystemId\}\/>/);
});

test("TestManager locks Language/Input system to hidden inputs (not an editable select) when given lockedLanguage, and seeds a new test's language from it instead of always defaulting to English", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /lockedLanguage\?:"English"\|"Hindi"; lockedInputSystemId\?:string;/);
  assert.match(manager, /useState<"English"\|"Hindi">\(lockedLanguage \?\? "English"\)/);
  assert.match(manager, /lockedLanguage \? <>/);
  assert.match(manager, /<input type="hidden" name="language" value=\{language\}\/>/);
  assert.match(manager, /<input type="hidden" name="inputSystemId" value=\{inputSystem\}\/>/);
  assert.match(manager, /setLanguage\(test\?\.currentVersion\?\.language\?\?lockedLanguage\?\?"English"\)/);
});

test("directWorkspace (the practice-hub entry point every student actually uses, which skips ExamStart entirely) still ends up with the correct duration, not the admin's stale default", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  // timeLeft's own useState always seeds from preset.durationSeconds
  // (activeDurationSeconds isn't computed yet at that line), so the
  // directWorkspace-only settings-init effect must correct it once,
  // otherwise a student who never sees ExamStart (that's the only place
  // the previous duration fix landed) would still see the admin's fixed
  // duration regardless of their own preference.
  assert.match(workspace, /setTimeLeft\(activeDurationSeconds\)/);
  assert.match(workspace, /\}, \[activeDurationSeconds, directWorkspace, loaded, managedRulesLocked, officialSettings, preferences, preset\.highlightMode, resolvedAttemptVariant\]\);/);
});

test("duration can be changed from the in-workspace Settings popup too (not just ExamStart, which directWorkspace students never see), and locks once typing has actually started", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /const durationLocked = attemptVariant === "official" \|\| matterPreset \|\| \(Boolean\(managedTest\) && managedRulesLocked\) \|\| timerStarted;/);
  assert.match(workspace, /const changeDuration = \(minutes: number\) => \{ updatePreferences\(\{ durationMinutes: minutes \}\); if \(!timerStarted\) setTimeLeft\(minutes \* 60\); \};/);
  assert.match(workspace, /durationMinutes=\{activeDurationSeconds \/ 60\} durationLocked=\{durationLocked\} onDurationChange=\{changeDuration\}\/>;/);
  const settingsPanel = await read("app/typing/_components/universal-typing-settings.tsx");
  assert.doesNotMatch(settingsPanel, /Duration \(1–60 minutes\)/);
  assert.match(settingsPanel, /PRACTICE_DURATION_MINUTES\.includes\(durationMinutes\)/);
});

test("the admin Practice Tests page gates entry behind a language picker, then goes straight to the (now scoped) test list -- Hindi has no keyboard picker any more since Kruti Dev is the only option", async () => {
  const page = await read("app/admin/practice-tests/page.tsx");
  assert.match(page, /const language = params\.language === "Hindi" \? "Hindi" as const : params\.language === "English" \? "English" as const : null;/);
  assert.match(page, /if \(!language\) \{/);
  assert.doesNotMatch(page, /HINDI_INPUT_SYSTEMS/);
  assert.match(page, /const inputSystemId = language === "Hindi" \? HINDI_KRUTI_DEV\.id : "english-qwerty";/);
  assert.match(page, /<SectionTestPage mode="practice" language=\{language\} inputSystemId=\{inputSystemId\} backHref=\{backHref\} \/>/);
});

test("Hindi typing (Learn/Practice) is restricted to Kruti Dev 010 only; Exam Simulators and Stenography keep every Hindi input system", async () => {
  const curriculum = await read("lib/typing-curriculum.ts");
  assert.match(curriculum, /export function hindiInputSystemsFor\(mode: "learn" \| "practice" \| "exam" \| "stenography"\): InputSystem\[\] \{/);
  assert.match(curriculum, /return mode === "learn" \|\| mode === "practice" \? \[HINDI_KRUTI_DEV\] : HINDI_INPUT_SYSTEMS;/);

  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /const hindiSystemIds = new Set\(hindiInputSystemsFor\(formMode\)\.map\(\(system\) => system\.id\)\);/);
  assert.match(manager, /const systems = MANAGED_INPUT_SYSTEMS\.filter\(\(system\) => system\.language === language && \(language !== "Hindi" \|\| hindiSystemIds\.has\(system\.id\)\)\);/);

  const catalogue = await read("app/typing/practice/_components/category-catalogue.tsx");
  assert.match(catalogue, /const hindiInputSystems = hindiInputSystemsFor\(mode\);/);
});

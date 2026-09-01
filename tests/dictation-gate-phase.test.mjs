import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const EXAM_PATH = "app/typing/_components/configurable-typing-exam.tsx";
const GATE_PATH = "app/typing/_components/dictation-gate.tsx";
const ACTIONS_PATH = "app/tests/actions.ts";

test("the dictation gate is only reachable once a test has actually started, and only when it has dictation audio configured", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /if \(started && preset\.audioUrl && !dictationReady\) return <DictationGate/);
});

test("DictationAudioPanel and its old always-visible speed list are gone from the shared exam component -- audio only ever appears on the dedicated gate screen now", async () => {
  const editor = await read(EXAM_PATH);
  assert.doesNotMatch(editor, /function DictationAudioPanel/);
  assert.doesNotMatch(editor, /const DICTATION_SPEEDS/);
});

test("the workspace never shows the reference passage or an audio panel for a dictation test -- the typing panel is the only row", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /\{!preset\.audioUrl && <section className="flex min-h-0 flex-col bg-white" aria-labelledby="original-passage-title">/);
  assert.doesNotMatch(editor, /preset\.audioUrl \? <DictationAudioPanel/);
});

test("Ctrl+Enter cannot submit an empty attempt while still on the dictation gate (a student hasn't started typing yet)", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /if\(!started\)start\(\);else if\(!finished&&\(!preset\.audioUrl\|\|dictationReady\)\)submit\(\);/);
});

test("Start Typing begins the timer immediately (reuses the existing idempotent beginTiming), not on the student's first keystroke", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /onStartTyping=\{\(\) => \{ beginTiming\(\); setDictationReady\(true\); \}\}/);
});

test("starting a fresh attempt resets the dictation phase and category selection back to defaults, so Try Again doesn't get stuck on a stale selection", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /setDictationReady\(false\); setSelectedCategories\(defaultCategoriesFor\(preset\.language\)\); setStarted\(true\);/);
});

test("the student's category selection is folded into the scoring profile only for audio tests (zero behavior change otherwise), and used for both the on-screen and server-recorded score", async () => {
  const editor = await read(EXAM_PATH);
  assert.match(editor, /const effectiveScoringProfile = useMemo\(\(\) => preset\.audioUrl \? scoringProfileWithSelectedCategories\(preset\.scoringProfile, selectedCategories\) : preset\.scoringProfile/);
  assert.match(editor, /const scoredPreset = useMemo\(\(\) => preset\.audioUrl \? \{ \.\.\.preset, scoringProfile: effectiveScoringProfile \} : preset/);
  assert.match(editor, /scoringProfile: effectiveScoringProfile, includeUntypedWords: true \}\) : null/);
  assert.match(editor, /recordManagedAttempt\(\{testId:managedTest\.testId,versionId:managedTest\.versionId,startedAt:startedAt\.current,typedText,elapsedSeconds:finalScore\.elapsedSeconds,backspaces,selectedCategories\}\)/);
});

test("the dictation gate hides the audio player, shows the category checkboxes, and keeps Start Typing disabled until the audio has played through once", async () => {
  const gate = await read(GATE_PATH);
  assert.match(gate, /onEnded=\{\(\) => \{ setPlaying\(false\); setPlayedThrough\(true\); \}\}/);
  assert.match(gate, /<button type="button" disabled=\{!playedThrough\} onClick=\{onStartTyping\}/);
  assert.match(gate, /HALF_ERROR_CATEGORY_LABELS\[category\]/);
});

test("capitalization is not offered as a selectable category for non-English (Devanagari has no case)", async () => {
  const gate = await read(GATE_PATH);
  assert.match(gate, /const availableCategories = preset\.language === "English" \? ALL_HALF_ERROR_CATEGORIES : ALL_HALF_ERROR_CATEGORIES\.filter\(\(category\) => category !== "capitalization"\)/);
});

test("the server-side re-scoring in recordManagedAttempt folds in the same sanitized category selection, and only for versions that actually have dictation audio configured", async () => {
  const actions = await read(ACTIONS_PATH);
  assert.match(actions, /audioPath: \(v\.configuration as Record<string, unknown> \| null\)\?\.audio_path as string \| null \?\? null/);
  assert.match(actions, /const scoringProfile = version\.audioPath\s*\n\s*\? scoringProfileWithSelectedCategories\(preset\.scoringProfile, sanitizeSelectedCategories\(payload\.selectedCategories\)\)\s*\n\s*: preset\.scoringProfile;/);
});

test("the results page shows a 'graded for this attempt' banner only when a category was actually toggled off, reusing the same shared label constant as the dictation gate", async () => {
  const results = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(results, /HALF_ERROR_CATEGORY_LABELS as CATEGORY_LABELS/);
  assert.match(results, /const gradedCategories = activeHalfErrorCategories\(preset\.scoringProfile\);/);
  assert.match(results, /gradedCategories\.length < ALL_HALF_ERROR_CATEGORIES\.length && <p role="status"/);
});

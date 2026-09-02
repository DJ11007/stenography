import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real bug reported: an admin created 3 exam tests, none of which were
// reachable anywhere as a student -- the admin-managed exam system and the
// 25 hardcoded exam-category simulators were completely disconnected.
// Fixed by requiring every non-live exam test to belong to one of the 25
// categories, deriving its real speed/duration/accuracy/backspace from
// that category (see tests/practice-tests-redesign.test.mjs for that
// derivation logic), and surfacing it on a new per-category exercise list.

test("the admin exam form offers a required Exam category select, only for exam mode non-live, placed before the auto-derived fields", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /formMode==="exam" && !isLive && <Field label="Exam category">/);
  assert.match(manager, /name="examCategory"/);
  assert.match(manager, /EXAM_CATEGORIES\.map\(\(category\)=><option key=\{category\.slug\} value=\{category\.slug\}>\{category\.name\}/);
  assert.match(manager, /setExamCategorySlug\(\(test\?\.currentVersion\?\.configuration\?\.exam_category as string\|undefined\) \?\? ""\)/);
});

test("validateManagedTest requires a real EXAM_CATEGORIES slug for exam-mode non-live tests, and never for live/practice", async () => {
  const { validateManagedTest } = await import("../lib/admin-tests.ts");
  const base = { title: "Test", description: "", slug: "test", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 900, passage: "A sufficiently long English typing passage for validation of the exam category requirement here.", requiredWpm: 35, requiredAccuracy: 90, backspaceMode: "full", wordMethod: "characters", highlightMode: "character", visibility: "public", isLive: false };
  assert.match(validateManagedTest(base).errors.join(" "), /Choose the exam category/);
  assert.deepEqual(validateManagedTest({ ...base, examCategory: "rajasthan-ldc" }).errors, []);
  assert.doesNotMatch(validateManagedTest({ ...base, isLive: true, examCategory: null }).errors.join(" "), /Choose the exam category/);
  assert.deepEqual(validateManagedTest({ ...base, mode: "practice", examCategory: null }).errors, []);
});

// Real bug reported live: an admin exercise linked to Rajasthan LDC showed
// Highlight=Character and Word calculation=5 Characters in its own Settings
// popup, instead of the category's real None/Space-separated -- because
// parseDraft's category-derivation only ever forced duration/speed/
// accuracy/backspace from the chosen category, deliberately leaving
// wordMethod/highlightMode flat (a reasonable call at the time, before any
// category varied those two fields -- Rajasthan LDC now does).
test("parseDraft derives wordMethod/highlightMode from the chosen exam category too, not just duration/speed/accuracy/backspace", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /wordMethod: forcedDefaultRules \? \(examCategoryDefinition\?\.wordMethod \?\? "characters"\) : /);
  assert.match(actions, /highlightMode: forcedDefaultRules \? \(examCategoryDefinition\?\.highlightMode \?\? "character"\) : /);
});

test("managedVersionToPreset attaches examCategorySlug/instructionNotes/patternSourced from EXAM_CATEGORIES when configured, and leaves them undefined otherwise", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "characters", highlightMode: "character", visibility: "public" };
  const linked = managedVersionToPreset({ ...base, examCategory: "rajasthan-ldc" });
  assert.equal(linked.examCategorySlug, "rajasthan-ldc");
  assert.ok(linked.instructionNotes?.length);
  assert.equal(typeof linked.patternSourced, "boolean");
  const unlinked = managedVersionToPreset(base);
  assert.equal(unlinked.examCategorySlug, undefined);
  assert.equal(unlinked.instructionNotes, undefined);
});

// Real bug reported live: an admin exercise linked to Rajasthan LDC showed
// the RSSB marks-based instructions (25 max, 9 to qualify, 0.05/0.0625
// marks per correct word) via instructionNotes above, but its results
// screen would have silently fallen back to plain WPM/accuracy pass-fail --
// marksMethod was never attached here, even though categoryPreset() already
// attaches it for the hardcoded preset of the same category (see
// tests/rssb-marks.test.mjs). Fixed by attaching the same RSSB_*_MARKS_METHOD
// constants whenever the linked category is rajasthan-ldc, for both
// languages, and leaving it undefined for every other category/unlinked test.
test("managedVersionToPreset attaches the real RSSB marks scheme when linked to Rajasthan LDC, matching the hardcoded category preset exactly, and leaves it undefined otherwise", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const { getExamPreset } = await import("../lib/typing-curriculum.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "characters", highlightMode: "character", visibility: "public" };
  const linkedEnglish = managedVersionToPreset({ ...base, language: "English", examCategory: "rajasthan-ldc" });
  const linkedHindi = managedVersionToPreset({ ...base, language: "Hindi", inputSystemId: "hindi-unicode-mangal", examCategory: "rajasthan-ldc" });
  assert.deepEqual(linkedEnglish.marksMethod, getExamPreset("exam-cat-rajasthan-ldc-english").marksMethod);
  assert.deepEqual(linkedHindi.marksMethod, getExamPreset("exam-cat-rajasthan-ldc-hindi").marksMethod);
  const otherCategory = managedVersionToPreset({ ...base, language: "English", examCategory: "ssc-chsl" });
  assert.equal(otherCategory.marksMethod, undefined);
  const unlinked = managedVersionToPreset({ ...base, language: "English" });
  assert.equal(unlinked.marksMethod, undefined);
});

test("the exam simulator's returnHref routes back to the category's exercise page for a category-linked exam test, not the generic catalogue", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /managedTest\.mode === "exam" && preset\.examCategorySlug \? `\/typing\/exams\/category\/\$\{preset\.examCategorySlug\}\/\$\{inputSystem\.language === "Hindi" \? "hindi" : "english"\}`/);
  assert.match(workspace, /managedTest\.mode === "exam" && preset\.examCategorySlug \? "Return to Exercises"/);
});

test("the category rules page's Start links lead to the new per-language exercise-selection route, not straight to the single hardcoded workspace", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.doesNotMatch(page, /examCategoryPresetId/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/english`\}/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/hindi`\}/);
});

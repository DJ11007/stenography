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

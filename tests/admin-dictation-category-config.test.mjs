import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const FORM_PATH = "app/admin/tests/test-manager.tsx";
const ACTIONS_PATH = "app/admin/tests/actions.ts";
const ADMIN_TESTS_LIB_PATH = "lib/admin-tests.ts";
const GATE_PATH = "app/typing/_components/dictation-gate.tsx";
const EXAM_PATH = "app/typing/_components/configurable-typing-exam.tsx";

test("the admin test form offers a per-test dictation-category checklist, shown only for stenography tests", async () => {
  const form = await read(FORM_PATH);
  assert.match(form, /formMode==="stenography" && <Field label="Dictation grading checklist/);
  assert.match(form, /name="dictationAvailable"/);
  assert.match(form, /name="dictationDefaults"/);
});

test("a category can't be a default unless it's also offered -- unchecking 'Offer to student' clears its default too", async () => {
  const form = await read(FORM_PATH);
  assert.match(form, /if\(event\.target\.checked\)next\.add\(category\);else\{next\.delete\(category\);const defaults=new Set\(dictationDefaults\);defaults\.delete\(category\);setDictationDefaults\(defaults\);\}setDictationAvailable\(next\);/);
});

test("saving a stenography test parses and sanitizes the checklist into configuration.dictation_categories, only for stenography mode", async () => {
  const actions = await read(ACTIONS_PATH);
  assert.match(actions, /const dictationCategories = draft\.mode === "stenography" \? \(\(\) => \{/);
  assert.match(actions, /\(ALL_HALF_ERROR_CATEGORIES as string\[\]\)\.includes\(item\)/);
  assert.match(actions, /const defaults = parse\("dictationDefaults"\)\.filter\(\(item\) => available\.includes\(item\)\)/);
  assert.match(actions, /dictation_categories: dictationCategories/);
});

test("ExamPreset carries an optional dictationCategories field, and managedVersionToPreset() reads it from the version", async () => {
  const curriculum = await read("lib/typing-curriculum.ts");
  assert.match(curriculum, /dictationCategories\?: \{ available: HalfErrorCategory\[\]; defaults: HalfErrorCategory\[\] \}/);
  const adminTests = await read(ADMIN_TESTS_LIB_PATH);
  assert.match(adminTests, /dictationCategories: version\.dictationCategories \?\? undefined,/);
});

test("both /tests/[slug] and the practice navigator read configuration.dictation_categories into the version object, the same way they already read audio_path", async () => {
  const slugPage = await read("app/tests/[slug]/page.tsx");
  assert.match(slugPage, /dictationCategories:configuration\?\.dictation_categories as ManagedTestVersion\["dictationCategories"\]\?\?null/);
  const navigator = await read("app/typing/practice/_components/practice-navigator.tsx");
  assert.match(navigator, /dictationCategories:configuration\?\.dictation_categories as ManagedTestVersion\["dictationCategories"\] \?\? null/);
});

test("the dictation gate narrows its offered checklist to the admin's configured 'available' list when one is set, and falls back to every language-appropriate category when it isn't (zero regression for every test an admin hasn't touched)", async () => {
  const gate = await read(GATE_PATH);
  assert.match(gate, /const availableCategories = preset\.dictationCategories \? languageAppropriate\.filter\(\(category\) => preset\.dictationCategories!\.available\.includes\(category\)\) : languageAppropriate;/);
});

test("the initial/reset category selection seeds from the admin's configured defaults when set, and still respects the language-appropriate filter even then", async () => {
  const exam = await read(EXAM_PATH);
  assert.match(exam, /const defaultCategoriesFor = \(preset: ExamPreset\): HalfErrorCategory\[\] => \{/);
  assert.match(exam, /if \(!preset\.dictationCategories\) return languageAppropriate;/);
  assert.match(exam, /return languageAppropriate\.filter\(\(category\) => preset\.dictationCategories!\.defaults\.includes\(category\)\);/);
});

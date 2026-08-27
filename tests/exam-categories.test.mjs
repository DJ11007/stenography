import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXAM_CATEGORIES, getExamCategory, examCategoryPresetId, defaultExamCategoryRules } from "../lib/exam-categories.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("exam categories are unique, non-empty, and each carries a badge/tone for original iconography", () => {
  assert.ok(EXAM_CATEGORIES.length >= 25);
  const slugs = new Set(EXAM_CATEGORIES.map((category) => category.slug));
  assert.equal(slugs.size, EXAM_CATEGORIES.length);
  const knownKinds = new Set(["commission", "medical", "train", "police", "scales", "book", "flask", "monitor"]);
  for (const category of EXAM_CATEGORIES) {
    assert.ok(category.name.length > 0);
    assert.ok(category.fullName.length > 0);
    assert.ok(category.badge.length > 0);
    assert.match(category.tone, /^#[0-9a-f]{6}$/i);
    assert.match(category.toneDark, /^#[0-9a-f]{6}$/i);
    assert.ok(knownKinds.has(category.iconKind), `unknown icon kind ${category.iconKind} for ${category.slug}`);
  }
});

test("every category resolves to a working English and Hindi exam preset", () => {
  for (const category of EXAM_CATEGORIES) {
    const english = getExamPreset(examCategoryPresetId(category.slug, "English"));
    const hindi = getExamPreset(examCategoryPresetId(category.slug, "Hindi"));
    assert.ok(english, `missing English preset for ${category.slug}`);
    assert.ok(hindi, `missing Hindi preset for ${category.slug}`);
    assert.equal(english.language, "English");
    assert.equal(hindi.language, "Hindi");
    assert.ok(english.passage.length > 0);
    assert.ok(hindi.passage.length > 0);
  }
});

test("unknown category slugs resolve to nothing", () => {
  assert.equal(getExamCategory("not-a-real-exam"), undefined);
  assert.equal(getExamPreset(examCategoryPresetId("not-a-real-exam", "English")), undefined);
});

test("category rules disclose affiliation, the target pattern, and whether it was researched or estimated, per language", () => {
  const sourced = EXAM_CATEGORIES.find((category) => category.patternSourced);
  const unsourced = EXAM_CATEGORIES.find((category) => !category.patternSourced);
  assert.ok(sourced && unsourced, "expected both a sourced and an unsourced category to exist");
  const english = defaultExamCategoryRules(sourced, "English");
  const hindi = defaultExamCategoryRules(sourced, "Hindi");
  assert.ok(english.some((rule) => /not affiliated/i.test(rule)));
  assert.ok(english.some((rule) => /Target pattern:/.test(rule)));
  assert.ok(english.some((rule) => /based on published exam-pattern research/i.test(rule)));
  assert.ok(hindi.some((rule) => /Target pattern:/.test(rule)));
  const unsourcedRules = defaultExamCategoryRules(unsourced, "English");
  assert.ok(unsourcedRules.some((rule) => /reasoned baseline/i.test(rule)));
});

test("the exam simulator hub renders a category grid with an EN/HI badge and a rules route per category, and no longer shows the retired managed-exam-tests section", async () => {
  const hub = await read("app/typing/exams/page.tsx");
  assert.match(hub, /Select Exam Category/);
  assert.match(hub, /EXAM_CATEGORIES\.map/);
  assert.match(hub, /\/typing\/exams\/category\/\$\{category\.slug\}/);
  assert.match(hub, /EN \/ HI/);
  assert.match(hub, /A to Z Exams/);
  assert.match(hub, /Keyboard Practice/);
  assert.match(hub, /<ExamCategoryIcon category=\{category\}/);
  assert.doesNotMatch(hub, /Managed exam tests/);
  assert.doesNotMatch(hub, /General exam presets/);
  assert.doesNotMatch(hub, /getPublishedManagedTests/);
  assert.doesNotMatch(hub, /ManagedTestCards/);
});

test("the exam category icon renders an original medallion-style graphic per institution type, not a flat text badge or a scraped emblem image", async () => {
  const icon = await read("app/typing/exams/_components/exam-category-icon.tsx");
  for (const kind of ["commission", "medical", "train", "police", "scales", "book", "flask", "monitor"]) {
    assert.match(icon, new RegExp(`case "${kind}"`));
  }
  assert.match(icon, /stopColor=\{category\.tone\}/);
  assert.match(icon, /stopColor=\{category\.toneDark\}/);
  assert.match(icon, /textPath href=\{`#\$\{arcId\}`\}/);
  assert.doesNotMatch(icon, /<img /);
  assert.doesNotMatch(icon, /\.(png|jpe?g|svg)"/i);
});

test("the category rules page shows English and Hindi rules with distinct start links and an affiliation disclaimer", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.match(page, /getExamCategory/);
  assert.match(page, /if \(!category\) notFound\(\)/);
  assert.match(page, /Start in English/);
  assert.match(page, /Start in Hindi/);
  assert.match(page, /examCategoryPresetId\(category\.slug, "English"\)/);
  assert.match(page, /examCategoryPresetId\(category\.slug, "Hindi"\)/);
  assert.match(page, /<BackButton href="\/typing\/exams" label="Exam Categories" \/>/);
});

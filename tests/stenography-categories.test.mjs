import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STENOGRAPHY_CATEGORIES, getStenographyCategory, stenographyCategoryPresetId, defaultStenographyCategoryRules } from "../lib/stenography-categories.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("stenography categories are unique, non-empty, and each carries a badge/tone for original iconography", () => {
  assert.ok(STENOGRAPHY_CATEGORIES.length >= 12);
  const slugs = new Set(STENOGRAPHY_CATEGORIES.map((category) => category.slug));
  assert.equal(slugs.size, STENOGRAPHY_CATEGORIES.length);
  const knownKinds = new Set(["commission", "medical", "train", "police", "scales", "book", "flask", "monitor"]);
  for (const category of STENOGRAPHY_CATEGORIES) {
    assert.ok(category.name.length > 0);
    assert.ok(category.fullName.length > 0);
    assert.ok(category.badge.length > 0);
    assert.match(category.tone, /^#[0-9a-f]{6}$/i);
    assert.match(category.toneDark, /^#[0-9a-f]{6}$/i);
    assert.ok(knownKinds.has(category.iconKind), `unknown icon kind ${category.iconKind} for ${category.slug}`);
  }
});

test("every stenography category resolves to a working English and Hindi exam preset", () => {
  for (const category of STENOGRAPHY_CATEGORIES) {
    const english = getExamPreset(stenographyCategoryPresetId(category.slug, "English"));
    const hindi = getExamPreset(stenographyCategoryPresetId(category.slug, "Hindi"));
    assert.ok(english, `missing English preset for ${category.slug}`);
    assert.ok(hindi, `missing Hindi preset for ${category.slug}`);
    assert.equal(english.category, "stenography");
    assert.equal(hindi.category, "stenography");
    assert.equal(english.language, "English");
    assert.equal(hindi.language, "Hindi");
    assert.ok(english.passage.length > 0);
    assert.ok(hindi.passage.length > 0);
  }
});

test("unknown stenography category slugs resolve to nothing", () => {
  assert.equal(getStenographyCategory("not-a-real-exam"), undefined);
  assert.equal(getExamPreset(stenographyCategoryPresetId("not-a-real-exam", "English")), undefined);
});

test("stenography category rules disclose affiliation, the target dictation pattern, research confidence, and that audio isn't configured for this category", () => {
  const sourced = STENOGRAPHY_CATEGORIES.find((category) => category.patternSourced);
  const unsourced = STENOGRAPHY_CATEGORIES.find((category) => !category.patternSourced);
  assert.ok(sourced && unsourced, "expected both a sourced and an unsourced category to exist");
  const english = defaultStenographyCategoryRules(sourced, "English");
  const hindi = defaultStenographyCategoryRules(sourced, "Hindi");
  assert.ok(english.some((rule) => /not affiliated/i.test(rule)));
  assert.ok(english.some((rule) => /Target pattern:/.test(rule)));
  assert.ok(english.some((rule) => /based on published exam-pattern research/i.test(rule)));
  assert.ok(english.some((rule) => /audio dictation delivery is not yet configured/i.test(rule)));
  assert.ok(hindi.some((rule) => /Target pattern:/.test(rule)));
  const unsourcedRules = defaultStenographyCategoryRules(unsourced, "English");
  assert.ok(unsourcedRules.some((rule) => /reasoned baseline/i.test(rule)));
});

test("the stenography language chooser links to the new stenography exam simulator", async () => {
  const page = await read("app/typing/practice/stenography/page.tsx");
  assert.match(page, /Select Exam Category/);
  assert.match(page, /href="\/typing\/practice\/stenography\/exams"/);
});

test("the stenography exam simulator hub renders a category grid using the shared original icon component", async () => {
  const hub = await read("app/typing/practice/stenography/exams/page.tsx");
  assert.match(hub, /Select Exam Category/);
  assert.match(hub, /STENOGRAPHY_CATEGORIES\.map/);
  assert.match(hub, /\/typing\/practice\/stenography\/exams\/\$\{category\.slug\}/);
  assert.match(hub, /<ExamCategoryIcon category=\{category\}/);
  assert.match(hub, /<TypingBrandHeader backHref="\/typing\/practice\/stenography" backLabel="Stenography" \/>/);
});

test("the stenography category rules page shows English and Hindi rules with distinct start links into the shared exam workspace route", async () => {
  const page = await read("app/typing/practice/stenography/exams/[slug]/page.tsx");
  assert.match(page, /getStenographyCategory/);
  assert.match(page, /if \(!category\) notFound\(\)/);
  assert.match(page, /Start in English/);
  assert.match(page, /Start in Hindi/);
  assert.match(page, /stenographyCategoryPresetId\(category\.slug, "English"\)/);
  assert.match(page, /stenographyCategoryPresetId\(category\.slug, "Hindi"\)/);
  assert.match(page, /\/typing\/exams\/\$\{englishPresetId\}/);
  assert.match(page, /\/typing\/exams\/\$\{hindiPresetId\}/);
});

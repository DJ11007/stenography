import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported gap: the Exam Simulator's category rules page had no way to
// jump straight to a real, admin-published exercise -- only a generic
// "Start in English/Hindi" link into the Official Pattern simulation. The
// Stenography Exam Simulator's own rules page already solved this (see
// tests/stenography-category-navigator.test.mjs's RealTestList), so this
// mirrors that exact pattern here instead of inventing a new one -- same
// box styling/copy, adapted for exam exercises being shared onto every
// category's list (see getExamCategoryNavigator's own comment) rather than
// scoped to just one: previews a handful, links out to the existing full
// paginated catalogue (/typing/exams/category/[slug]/[language]) for the
// rest instead of listing everything inline.
test("the exam category rules page fetches and renders both languages' navigator lists via RealTestList, above each Start link", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.match(page, /import \{ getExamCategoryNavigator, type ExamCategoryNavigatorItem \} from "@\/lib\/exam-category-navigator-server";/);
  assert.match(page, /const \[englishTests, hindiTests\] = await Promise\.all\(\[/);
  assert.match(page, /<RealTestList categorySlug=\{category\.slug\} tests=\{englishTests\.items\} total=\{englishTests\.total\} language="English"\/>/);
  assert.match(page, /<RealTestList categorySlug=\{category\.slug\} tests=\{hindiTests\.items\} total=\{hindiTests\.total\} language="Hindi"\/>/);
  assert.match(page, /function RealTestList\(/);
  // Real tests appear before the Start link on each language's card, not after.
  const englishCardIndex = page.indexOf("English rules");
  const realTestIndex = page.indexOf("<RealTestList categorySlug={category.slug} tests={englishTests.items}");
  const startLinkIndex = page.indexOf("Start in English");
  assert.ok(englishCardIndex < realTestIndex && realTestIndex < startLinkIndex, "Real tests box must sit between the rules list and the Start link");
});

test("RealTestList previews a bounded number of exercises and links out to the full catalogue when there are more", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.match(page, /const REAL_TEST_PREVIEW_COUNT = 5;/);
  assert.match(page, /const preview = tests\.slice\(0, REAL_TEST_PREVIEW_COUNT\);/);
  assert.match(page, /\{total > preview\.length && \(/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{categorySlug\}\/\$\{language\.toLowerCase\(\)\}`\}/);
  assert.match(page, /href=\{`\/tests\/\$\{item\.slug\}\?viewAs=\$\{categorySlug\}`\}/);
});

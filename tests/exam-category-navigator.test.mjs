import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeExamCategoryPage, examCategoryPageBounds, examCategoryPageCount, EXAM_CATEGORY_PAGE_SIZE } from "../lib/exam-category-navigator.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("page size is 50 (as requested -- at least 50 exercises per page) and page math clamps/paginates correctly", () => {
  assert.equal(EXAM_CATEGORY_PAGE_SIZE, 50);
  assert.equal(normalizeExamCategoryPage("3"), 3);
  assert.equal(normalizeExamCategoryPage("abc"), 1);
  assert.equal(normalizeExamCategoryPage(-4), 1);
  assert.equal(normalizeExamCategoryPage(undefined), 1);
  assert.equal(examCategoryPageCount(0), 1);
  assert.equal(examCategoryPageCount(50), 1);
  assert.equal(examCategoryPageCount(51), 2);
  assert.deepEqual(examCategoryPageBounds(1, 120), { page: 1, from: 0, to: 49, pages: 3 });
  assert.deepEqual(examCategoryPageBounds(2, 120), { page: 2, from: 50, to: 99, pages: 3 });
  assert.deepEqual(examCategoryPageBounds(9, 120), { page: 3, from: 100, to: 119, pages: 3 });
});

test("server query filters mode/status/visibility/is_live/language, ordered by published_at and paginated", async () => {
  const server = await read("lib/exam-category-navigator-server.ts");
  for (const expected of [/\.eq\("mode","exam"\)/, /\.eq\("status","published"\)/, /\.eq\("visibility","public"\)/, /\.eq\("is_live",false\)/, /\.eq\("language",filters\.language\)/, /\.order\("published_at",\{ascending:oldest\}\)\.order\("id",\{ascending:true\}\)/, /\.range\(from,from\+EXAM_CATEGORY_PAGE_SIZE-1\)/]) assert.match(server, expected);
});

// Real feature: every Rajasthan LDC exercise the admin uploads is shared
// into every other category's own list automatically -- Rajasthan LDC's
// own list stays exactly its own uploads (never broadened, no
// double-counting risk since exam_category is a single scalar string per
// test), every other category's list also matches Rajasthan-LDC-tagged
// tests via a PostgREST .or() filter.
test("Rajasthan LDC's own list is unbroadened; every other category's list also includes Rajasthan-LDC-tagged tests via .or()", async () => {
  const server = await read("lib/exam-category-navigator-server.ts");
  assert.match(server, /filters\.categorySlug==="rajasthan-ldc"/);
  assert.match(server, /\?query\.eq\("settings->>exam_category","rajasthan-ldc"\)/);
  assert.match(server, /:query\.or\(`settings->>exam_category\.eq\.\$\{filters\.categorySlug\},settings->>exam_category\.eq\.rajasthan-ldc`\)/);
});

test("the exercise-selection page shows the permanent Official Pattern card, a numbered paginated grid, and a newest/oldest toggle", async () => {
  const page = await read("app/typing/exams/category/[slug]/[language]/page.tsx");
  assert.match(page, /getExamCategoryNavigator/);
  assert.match(page, /Official Pattern/);
  assert.match(page, /Start Official Pattern/);
  assert.match(page, /href=\{pageHref\(1, "newest"\)\}/);
  assert.match(page, /href=\{pageHref\(1, "oldest"\)\}/);
  assert.match(page, /href=\{`\/typing\/exams\/\$\{officialPresetId\}`\}/);
});

// A Rajasthan LDC exercise reached via a different category's list must
// render/score with THAT category's own rules -- the ?viewAs= param is
// what tells managedVersionToPreset() which category that is. Rajasthan
// LDC's own list never needs it (it only ever lists its own exercises).
test("exercise links carry ?viewAs=<category> on every category page except Rajasthan LDC's own", async () => {
  const page = await read("app/typing/exams/category/[slug]/[language]/page.tsx");
  assert.match(page, /href=\{slug==="rajasthan-ldc"\?`\/tests\/\$\{item\.slug\}`:`\/tests\/\$\{item\.slug\}\?viewAs=\$\{slug\}`\}/);
});

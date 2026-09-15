import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeExamCategoryPage, examCategoryPageBounds, examCategoryPageCount, sortExamCategoryNavigatorItems, EXAM_CATEGORY_PAGE_SIZE } from "../lib/exam-category-navigator.ts";

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

// Real reported request: every category's list should include every exam
// exercise, whichever category it was native-uploaded under -- not just
// its own uploads plus Rajasthan LDC's. No exam_category filter at all
// (managedVersionToPreset's viewAsCategorySlug is what re-scopes a shared
// exercise's rules to the category page it's actually viewed from).
test("every category's list includes every exam exercise -- no exam_category filter, no Rajasthan-LDC-specific broadening", async () => {
  const server = await read("lib/exam-category-navigator-server.ts");
  assert.doesNotMatch(server, /settings->>exam_category/);
  assert.doesNotMatch(server, /filters\.categorySlug==="rajasthan-ldc"/);
  assert.match(server, /\.eq\("mode","exam"\)\.eq\("status","published"\)\.eq\("visibility","public"\)\.eq\("is_live",false\)\.eq\("language",filters\.language\)/);
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

// An exercise reached via any category's list must render/score with
// THAT category's own rules -- the ?viewAs= param is what tells
// managedVersionToPreset() which category that is. Every category page
// (including a native-category item on its own home page, where viewAs
// resolves to the same rules either way) always carries it now.
test("exercise links carry ?viewAs=<category> on every category page, unconditionally", async () => {
  const page = await read("app/typing/exams/category/[slug]/[language]/page.tsx");
  assert.match(page, /href=\{`\/tests\/\$\{item\.slug\}\?viewAs=\$\{slug\}`\}/);
});

// Real reported bug: "CHAPTER - 8" was published before "CHAPTER - 6", so
// the page listed them 1,2,3,4,5,8,6,9,7 -- publish order, not the serial
// order a student expects from titles that are plainly numbered.
test("sortExamCategoryNavigatorItems re-orders numbered titles into serial order, ascending for Oldest", () => {
  const publishOrder = [{ title: "CHAPTER - 1" }, { title: "CHAPTER - 2" }, { title: "CHAPTER - 3" }, { title: "CHAPTER - 4" }, { title: "CHAPTER - 5" }, { title: "CHAPTER - 8" }, { title: "CHAPTER - 6" }, { title: "CHAPTER - 9" }, { title: "CHAPTER - 7" }];
  const serial = sortExamCategoryNavigatorItems(publishOrder, "ascending").map((item) => item.title);
  assert.deepEqual(serial, ["CHAPTER - 1", "CHAPTER - 2", "CHAPTER - 3", "CHAPTER - 4", "CHAPTER - 5", "CHAPTER - 6", "CHAPTER - 7", "CHAPTER - 8", "CHAPTER - 9"]);
});

test("sortExamCategoryNavigatorItems reverses to descending for Newest, and keeps unnumbered titles at the end in their original relative order", () => {
  const items = [{ title: "CHAPTER - 2" }, { title: "Official Rules Notice" }, { title: "CHAPTER - 1" }, { title: "Practice Tips" }];
  assert.deepEqual(sortExamCategoryNavigatorItems(items, "ascending").map((item) => item.title), ["CHAPTER - 1", "CHAPTER - 2", "Official Rules Notice", "Practice Tips"]);
  assert.deepEqual(sortExamCategoryNavigatorItems(items, "descending").map((item) => item.title), ["CHAPTER - 2", "CHAPTER - 1", "Official Rules Notice", "Practice Tips"]);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STENOGRAPHY_CATEGORIES } from "../lib/stenography-categories.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported gap: an admin-created stenography test (with genuine court-
// matter dictation) tagged to one "court and legal" category (e.g.
// Rajasthan High Court Steno) was invisible everywhere except the flat,
// uncategorized Task Library list -- a student browsing a *different*
// court category's own page (Delhi HC, Supreme Court PA, etc.) never saw
// it, even though the same real dictation is just as useful there. Every
// other, non-court category (RSMSSB, SSC, CBI, IB, RBI, ...) should stay
// unshared -- only its own exactly-tagged tests belong on its own page.
test("court/legal categories are exactly the ones with the scales icon, and there are at least two of them to actually share between", () => {
  const court = STENOGRAPHY_CATEGORIES.filter((category) => category.iconKind === "scales");
  assert.ok(court.length >= 2, "expected multiple court/legal categories to verify sharing between");
  assert.ok(court.some((category) => category.slug === "rajasthan-hc-steno"));
  assert.ok(court.some((category) => category.slug === "delhi-hc-steno"));
  assert.ok(!court.some((category) => category.slug === "rsmssb-steno"), "RSMSSB is a commission post, not a court -- must not be swept into court sharing");
});

test("getStenographyCategoryNavigator scopes a court category's query to every court/legal slug via .or(), and a non-court category to only its own exact tag", async () => {
  const source = await read("lib/stenography-category-navigator-server.ts");
  assert.match(source, /const COURT_CATEGORY_SLUGS = STENOGRAPHY_CATEGORIES\.filter\(\(category\) => category\.iconKind === "scales"\)\.map\(\(category\) => category\.slug\);/);
  assert.match(source, /query\.or\(COURT_CATEGORY_SLUGS\.map\(\(slug\) => `settings->>steno_category\.eq\.\$\{slug\}`\)\.join\(","\)\)/);
  assert.match(source, /: query\.eq\("settings->>steno_category", categorySlug\);/);
  assert.match(source, /\.eq\("mode", "stenography"\)\.eq\("status", "published"\)\.eq\("visibility", "public"\)\.eq\("is_live", false\)\.eq\("language", language\)/);
});

test("the stenography category rules page lists NO tests -- they appear on the per-language page after Start", async () => {
  const page = await read("app/typing/practice/stenography/exams/[slug]/page.tsx");
  assert.doesNotMatch(page, /RealTestGrid|getStenographyCategoryNavigator/);
});

test("the per-language stenography page fetches that language's navigator list and renders it via RealTestGrid above the generic sample link", async () => {
  const page = await read("app/typing/practice/stenography/exams/[slug]/[language]/page.tsx");
  assert.match(page, /import \{ getStenographyCategoryNavigator \} from "@\/lib\/stenography-category-navigator-server";/);
  assert.match(page, /import \{ RealTestGrid \} from "\.\.\/real-test-grid";/);
  assert.match(page, /await getStenographyCategoryNavigator\(category\.slug, language\)/);
  assert.match(page, /<RealTestGrid tests=\{tests\} language=\{language\} total=\{total\}/);
  assert.match(page, /if \(!category \|\| !language\) notFound\(\)/);
});

test("getStenographyCategoryNavigator orders oldest-first, matching the Take Tests practice navigator's own convention", async () => {
  const source = await read("lib/stenography-category-navigator-server.ts");
  assert.match(source, /query\.order\("published_at", \{ ascending: true \}\)\.order\("id", \{ ascending: true \}\);/);
});

// Real reported request: replace the ‹ Test X of Y ▾ › dropdown navigator
// with the same numbered-card grid the Exam Simulator's own exercise
// catalogue uses -- easier for a student to scan and pick a specific real
// test directly, instead of stepping through a <select>.
test("RealTestGrid renders a numbered grid of test links, not a dropdown or a prev/next navigator", async () => {
  const grid = await read("app/typing/practice/stenography/exams/[slug]/real-test-grid.tsx");
  assert.doesNotMatch(grid, /aria-label="Previous test"/);
  assert.doesNotMatch(grid, /<select /);
  assert.doesNotMatch(grid, /router\.push/);
  assert.match(grid, /<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">/);
  assert.match(grid, /\{tests\.map\(\(test, index\) => \(/);
  assert.match(grid, /href=\{`\/tests\/\$\{test\.slug\}`\}/);
  assert.match(grid, /\{startNumber \+ index\}<\/span>/); // the numbered badge (continues across pages), matching the exam category catalogue's own card style
});

test("the per-language stenography page paginates at the shared 50-per-page size with the same Newest/Oldest toggle and Prev/Next nav as the exam catalogue", async () => {
  const page = await read("app/typing/practice/stenography/exams/[slug]/[language]/page.tsx");
  assert.match(page, /import \{ normalizeExamCategoryPage, examCategoryPageBounds, sortExamCategoryNavigatorItems \} from "@\/lib\/exam-category-navigator";/);
  assert.match(page, /const tests = all\.slice\(from, to \+ 1\);/);
  assert.match(page, /aria-label="Sort tests"/);
  assert.match(page, /aria-label="Test pages"/);
  assert.match(page, /startNumber=\{from \+ 1\}/);
});

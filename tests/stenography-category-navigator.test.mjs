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

test("the stenography category rules page fetches and renders both languages' navigator lists via RealTestNavigator, above the generic sample link", async () => {
  const page = await read("app/typing/practice/stenography/exams/[slug]/page.tsx");
  assert.match(page, /import \{ getStenographyCategoryNavigator \} from "@\/lib\/stenography-category-navigator-server";/);
  assert.match(page, /import \{ RealTestNavigator \} from "\.\/real-test-navigator";/);
  assert.match(page, /const \[englishTests, hindiTests\] = await Promise\.all\(\[/);
  assert.match(page, /<RealTestNavigator tests=\{englishTests\} language="English"\/>/);
  assert.match(page, /<RealTestNavigator tests=\{hindiTests\} language="Hindi"\/>/);
});

test("getStenographyCategoryNavigator orders oldest-first, matching the Take Tests practice navigator's own convention", async () => {
  const source = await read("lib/stenography-category-navigator-server.ts");
  assert.match(source, /query\.order\("published_at", \{ ascending: true \}\)\.order\("id", \{ ascending: true \}\);/);
});

// Real reported request: replace the previous stacked-button list (one
// row per real test) with a compact ‹ Test X of Y ▾ › navigator -- the
// exact same arrows+dropdown pattern the in-workspace "Take Tests"
// practice navigator already uses (ExamWorkspace in
// configurable-typing-exam.tsx), for visual/interaction consistency.
test("RealTestNavigator mirrors the in-workspace practice navigator's own ‹ Test X of Y ▾ › pattern -- arrows plus a dropdown, not a stacked list", async () => {
  const navigator = await read("app/typing/practice/stenography/exams/[slug]/real-test-navigator.tsx");
  assert.match(navigator, /aria-label="Previous test"/);
  assert.match(navigator, /aria-label="Next test"/);
  assert.match(navigator, /\{tests\.map\(\(t, i\) => <option key=\{t\.slug\} value=\{t\.slug\} title=\{t\.title\}>\{`Test \$\{i \+ 1\} of \$\{tests\.length\}`\}<\/option>\)\}/);
  assert.doesNotMatch(navigator, /<ul className="mt-2 space-y-1\.5">/); // the old stacked-button list must be gone
  assert.match(navigator, /router\.push\(`\/tests\/\$\{tests\[nextIndex\]\.slug\}`\);/); // selecting/arrowing navigates immediately, same as the in-workspace one
});

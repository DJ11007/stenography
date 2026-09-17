import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real reported bug: matra/halant/gender/vachan are Hindi-grammar categories
// that only a stenography scoring profile ever grades (see
// halfErrorCategories() in lib/typing-test.ts -- those four flags stay
// undefined for a plain typing/exam/learn test, so their counts are always
// exactly 0 there); the CategoryStrip tile grid rendered them for every
// test regardless, cluttering typing results with always-zero stenography
// tiles, while the headline "Full / Half Mistake Breakdown" never showed
// them for stenography, where they actually matter. The two result methods
// were "mixed" between sections instead of staying separate.
// Real reported feedback: after the categories-only fix above, the same
// user reported a real student's stenography attempt still "mixed" typing
// and stenography -- the whole page still used the typing simulator's
// character-count summary cards and 7-tab browsing UI (Combined/Original/
// Typed/Errors/Category/Self Analysis), just with a few extra category
// tiles bolted on. Stenography now gets its own single continuous report
// (pass/fail banner -> word-based Detailed Result -> Speed Details ->
// CategoryStrip -> full corrected passage), built from the same shared
// data/components but not sharing the typing layout or its tabs.
test("stenography renders its own single-report layout (banner + full passage, no tabs), separate from the typing simulator's tabbed layout", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /function ResultBanner\(/);
  assert.match(source, /\{isStenography \? \(/);
  assert.match(source, /<ResultBanner label=\{resultLabel\} passed=\{resultPassed\} title=\{preset\.title\}\/>/);
  assert.match(source, /<DetailedResultBreakdown summary=\{summary\} isStenography\/>\s*<KeyDepressionSpeedDetails summary=\{summary\}\/>\s*<CategoryStrip categories=\{totals\}\/>\s*<ComparisonTextPanel/);
  assert.match(source, /\{!isStenography && <button type="button" onClick=\{createPractice\}/);
});

test("stenography-only grammar categories are excluded from CategoryStrip for non-stenography results, and shown in the headline breakdown only for stenography", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /const isStenography = preset\.category === "stenography";/);
  assert.match(source, /const STENOGRAPHY_ONLY_CATEGORY_KEYS = new Set\(\["matra", "halant", "gender", "vachan"\]\);/);
  assert.match(source, /const totals = resultCategoryTotals\(score, backspaces, preset\.scoringProfile\)\.filter\(\(item\) => isStenography \|\| !STENOGRAPHY_ONLY_CATEGORY_KEYS\.has\(item\.key\)\);/);
  assert.match(source, /<DetailedResultBreakdown summary=\{summary\} isStenography=\{isStenography\}\/>/);
  assert.match(source, /const halfItems: \[string,number\]\[\] = \[\["Capitalization",summary\.halfCategories\.capitalization\],\["Punctuation",summary\.halfCategories\.punctuation\],\["Spacing",summary\.halfCategories\.spacing\],\["Spelling",summary\.halfCategories\.spelling\], \.\.\.\(isStenography \? /);
});

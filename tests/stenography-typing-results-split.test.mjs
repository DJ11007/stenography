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
test("stenography-only grammar categories are excluded from CategoryStrip for non-stenography results, and shown in the headline breakdown only for stenography", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /const isStenography = preset\.category === "stenography";/);
  assert.match(source, /const STENOGRAPHY_ONLY_CATEGORY_KEYS = new Set\(\["matra", "halant", "gender", "vachan"\]\);/);
  assert.match(source, /const totals = resultCategoryTotals\(score, backspaces, preset\.scoringProfile\)\.filter\(\(item\) => isStenography \|\| !STENOGRAPHY_ONLY_CATEGORY_KEYS\.has\(item\.key\)\);/);
  assert.match(source, /<DetailedResultBreakdown summary=\{summary\} isStenography=\{isStenography\}\/>/);
  assert.match(source, /const halfItems: \[string,number\]\[\] = \[\["Capitalization",summary\.halfCategories\.capitalization\],\["Punctuation",summary\.halfCategories\.punctuation\],\["Spacing",summary\.halfCategories\.spacing\],\["Spelling",summary\.halfCategories\.spelling\], \.\.\.\(isStenography \? /);
});

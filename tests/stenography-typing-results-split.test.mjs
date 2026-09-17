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
});

// Real reported feedback, round 3: a reference screenshot the user
// supplied (a real Hindi stenography evaluation tool) showed a candidate/
// matter header, TWO word-based accuracy tables (one counted against the
// full dictated passage, one counted only against what was actually
// typed), and the detailed category/self-analysis breakdown always visible
// -- not hidden behind typing's tab UI. StenographyHeader and
// StenographyStatsTables add the header and dual tables (derived purely
// from buildResultSummary's existing passageWords/totalWordsTyped/
// correctWordsTyped, no new scoring logic); Category Analysis and Self
// Analysis (previously dropped for stenography entirely, along with the
// Practice Mistakes button that populates the latter) are back as their
// own always-visible sections.
test("stenography's report includes a candidate header, dual word-based accuracy tables, and always-visible Category/Self Analysis sections with Practice Mistakes restored", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /function StenographyHeader\(/);
  assert.match(source, /function StenographyStatsTables\(/);
  assert.match(source, /const student = useTypingStudent\(\);/);
  assert.match(source, /<StenographyHeader title=\{preset\.title\} studentName=\{student\.name\}\/>/);
  assert.match(source, /<StenographyStatsTables summary=\{summary\}\/>/);
  assert.match(source, /Accuracy against full passage/);
  assert.match(source, /Accuracy against typed words/);
  assert.match(source, /<h2 className="text-xl font-black">Category Analysis<\/h2>.*<CategoryAnalysis categories=\{categories\}/s);
  assert.match(source, /<h2 className="text-xl font-black">Self Analysis<\/h2>.*<SelfAnalysis repeated=\{score\.analysis\.topRepeatedMistakes\}/s);
  // Practice Mistakes is unconditional again now that Self Analysis is
  // always rendered for stenography too, not gated behind a "self" tab
  // that stenography no longer has.
  assert.doesNotMatch(source, /\{!isStenography && <button type="button" onClick=\{createPractice\}/);
  assert.match(source, /<button type="button" onClick=\{createPractice\} className="rounded-xl bg-purple-700/);
});

// Real reported request, deep research follow-up: "apply [Rajasthan HC
// Steno's researched exam pattern] to our typing" -- StenographyCategoryDefinition
// had no penalty-override fields at all, so the "up to 5% mistakes are
// free" rule already documented in rajasthan-hc-steno's patternNotes was
// pure prose: every stenography category always scored on the generic
// 1/0.5 penalty with zero relaxation, both for the built-in Exam Simulator
// presets (typing-curriculum.ts) and for admin-created tests tied to a
// stenography category (admin-tests.ts's managedVersionToPreset, which
// only ever read EXAM_CATEGORIES, never STENOGRAPHY_CATEGORIES).
test("Rajasthan HC Steno's researched 5%-mistakes-free rule is wired into actual scoring, for both the built-in preset and admin-created tests", async () => {
  const categories = await read("lib/stenography-categories.ts");
  assert.match(categories, /fullErrorPenalty\?: number;\s*halfErrorPenalty\?: number;\s*errorRelaxationPercent\?: number;/);
  assert.match(categories, /slug: "rajasthan-hc-steno".*?errorRelaxationPercent: 5,/s);
  const curriculum = await read("lib/typing-curriculum.ts");
  assert.match(curriculum, /const penaltyOverride = \{ fullErrorPenalty: category\.fullErrorPenalty, halfErrorPenalty: category\.halfErrorPenalty, errorRelaxationPercent: category\.errorRelaxationPercent \};/);
  assert.match(curriculum, /scoringProfile: profile\(category\.dictationSpeedEnglish, penaltyOverride\)/);
  assert.match(curriculum, /scoringProfile: profile\(category\.dictationSpeedHindi, penaltyOverride\)/);
  const adminTests = await read("lib/admin-tests.ts");
  assert.match(adminTests, /const stenoCategoryDefinition = version\.mode === "stenography" && version\.stenoCategory \? STENOGRAPHY_CATEGORIES\.find/);
  assert.match(adminTests, /: stenoCategoryDefinition\s*\? \{ fullErrorPenalty: stenoCategoryDefinition\.fullErrorPenalty, halfErrorPenalty: stenoCategoryDefinition\.halfErrorPenalty, errorRelaxationPercent: stenoCategoryDefinition\.errorRelaxationPercent, errorGraceCount: undefined \}/);
});

test("stenography-only grammar categories are excluded from CategoryStrip for non-stenography results, and shown in the headline breakdown only for stenography", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /const isStenography = preset\.category === "stenography";/);
  assert.match(source, /const STENOGRAPHY_ONLY_CATEGORY_KEYS = new Set\(\["matra", "halant", "gender", "vachan"\]\);/);
  assert.match(source, /const totals = resultCategoryTotals\(score, backspaces, preset\.scoringProfile\)\.filter\(\(item\) => isStenography \|\| !STENOGRAPHY_ONLY_CATEGORY_KEYS\.has\(item\.key\)\);/);
  assert.match(source, /<DetailedResultBreakdown summary=\{summary\} isStenography=\{isStenography\}\/>/);
  assert.match(source, /const halfItems: \[string,number\]\[\] = \[\["Capitalization",summary\.halfCategories\.capitalization\],\["Punctuation",summary\.halfCategories\.punctuation\],\["Spacing",summary\.halfCategories\.spacing\],\["Spelling",summary\.halfCategories\.spelling\], \.\.\.\(isStenography \? /);
});

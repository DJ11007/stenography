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
  assert.match(source, /<ResultBanner label=\{resultLabel\} passed=\{resultPassed\} title=\{preset\.title\} requiredWpm=\{preset\.speedRequirement\} achievedWpm=\{summary\.netWpm\} requiredAccuracy=\{preset\.accuracyRequirement\} achievedAccuracy=\{summary\.accuracy\}\/>\}/);
  assert.match(source, /<DetailedResultBreakdown summary=\{summary\} isStenography\/>\s*<KeyDepressionSpeedDetails summary=\{summary\} profile=\{preset\.scoringProfile\}\/>\s*<CategoryStrip categories=\{totals\}\/>\s*<ComparisonTextPanel/);
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
  // DetailedResultBreakdown is now stenography-only (the non-stenography
  // branch dropped it entirely as part of the results-simplification pass
  // below), so its own isStenography prop is hardcoded true rather than a
  // ternary -- assert that instead of a call site that no longer exists.
  assert.match(source, /<DetailedResultBreakdown summary=\{summary\} isStenography\/>/);
  assert.match(source, /const halfItems: \[string,number\]\[\] = \[\["Capitalization",summary\.halfCategories\.capitalization\],\["Punctuation",summary\.halfCategories\.punctuation\],\["Spacing",summary\.halfCategories\.spacing\],\["Spelling",summary\.halfCategories\.spelling\], \.\.\.\(isStenography \? /);
});

// Real reported feedback: a typing result showed the character-based
// summary cards, the word-based Detailed Result + mistake-breakdown boxes,
// and the category tile strip all at once, alongside a Summary tab that
// duplicated the same numbers YET AGAIN via two separate calculation
// methods -- "mix match everything... this is waste". Non-stenography
// exam-simulator results show only the pass/fail banner and the WPM/KDPH-
// toggle Speed Details panel before the tabs; the redundant sections and
// the Summary tab are gone entirely, for every typing mode. Practice
// results were later changed again (see practice-results-drop-pass-fail
// test below): practice isn't following any specific exam's official
// pass/fail rule, so it gets its own Keystroke/Word method tabs instead
// of the banner, while exam-simulator keeps the original banner+Speed
// Details pairing unchanged.
test("typing (exam simulator) results drop the redundant character cards, Detailed Result block, category tile strip, and Summary tab -- keeping only the pass/fail banner and Speed Details", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /\{marksResult \? <><RssbSpeedDetails summary=\{summary\}\/><ComparisonTextPanel entries=\{displayEntries\} fontFamily=\{fontFamily\} textLanguage=\{textLanguage\} onSelect=\{setSelectedError\}\/><\/> : mode === "practice" \? <MethodBasedSpeedDetails summary=\{summary\} passage=\{passage\} typedText=\{typedText\} backspaces=\{backspaces\} language=\{inputSystem\.language\}\/> : <>\{insufficientAttempt \? <InsufficientAttemptBanner title=\{preset\.title\} minimumStrokes=\{minimumStrokesRequired\} achievedStrokes=\{score\.totalCharacters\}\/> : <ResultBanner label=\{resultLabel\} passed=\{resultPassed\} title=\{preset\.title\} requiredWpm=\{preset\.speedRequirement\} achievedWpm=\{summary\.netWpm\} requiredAccuracy=\{preset\.accuracyRequirement\} achievedAccuracy=\{summary\.accuracy\}\/>\}<KeyDepressionSpeedDetails summary=\{summary\} profile=\{preset\.scoringProfile\}\/><\/>\}/);
  assert.doesNotMatch(source, /function ScreenshotResultSummary/);
  assert.doesNotMatch(source, /function Summary\(/);
  assert.doesNotMatch(source, /function CalculationTable\(/);
  assert.doesNotMatch(source, /"summary"/);
});

// Real reported bug: a practice attempt showed a Pass/Fail banner judged
// against a benchmark the student was never trying to meet -- practice
// isn't an official exam. Replaced with two switchable, informal method
// tabs (Keystroke Based / Word Based) showing the same attempt's speed
// both ways, reusing the already-computed, wordMethod-independent
// buildResultSummary fields (grossCharactersPerMinute/netCharactersPerMinute
// for keystroke, grossWordsPerMinute/netWordsPerMinute for word) -- no
// rescoring needed.
test("practice typing results drop the pass/fail banner entirely and show Keystroke Based / Word Based method tabs instead", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source, /function MethodBasedSpeedDetails\(\{ summary, passage, typedText, backspaces, language \}: \{ summary: ReturnType<typeof buildResultSummary>; passage: string; typedText: string; backspaces: number; language: "English" \| "Hindi" \}\) \{/);
  assert.match(source, /const grossWpm = method === "word" \? summary\.grossWordsPerMinute : summary\.grossCharactersPerMinute \/ 5;/);
  assert.match(source, /const netWpm = method === "word" \? summary\.netWordsPerMinute : summary\.netCharactersPerMinute \/ 5;/);
  assert.match(source, />Keystroke Based Result</);
  assert.match(source, />Word Based Result</);
});

// Real requested follow-up: after the Pass/Fail banner was replaced with
// Keystroke/Word method tabs, the next ask was previewing this exact same
// practice attempt against a REAL exam category's own rules -- "all the
// exams... central level exams and state level... only rajasthan
// government all typing exam". A third "Preview by Exam" tab lets the
// student pick any of the 25 researched categories (grouped Central vs
// Rajasthan State) and reuses that category's already-built
// scoringProfile/marksMethod (via getExamPreset) against the practice
// attempt's own typed text -- no new scoring logic, and no exam category
// is hardcoded to central or state (isRajasthanCategory classifies by slug).
test("practice results offer a third 'Preview by Exam' tab that scores the same attempt under any of the 25 exam categories' real rules, grouped Central vs Rajasthan State",async()=>{
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(source,/import \{ getExamPreset, type ExamPreset \} from "@\/lib\/typing-curriculum";/);
  assert.match(source,/import \{ EXAM_CATEGORIES, examCategoryPresetId, type ExamCategoryDefinition \} from "@\/lib\/exam-categories";/);
  assert.match(source,/const isRajasthanCategory = \(category: ExamCategoryDefinition\) => category\.slug\.startsWith\("rajasthan-"\) \|\| category\.slug\.startsWith\("rssb-"\);/);
  assert.match(source,/>Preview by Exam</);
  assert.match(source,/<optgroup label="Central Level Exams">/);
  assert.match(source,/<optgroup label="Rajasthan State Level Exams">/);
  assert.match(source,/const categoryPreset = getExamPreset\(examCategoryPresetId\(category\.slug, language\)\);/);
  assert.match(source,/const categoryScore = calculateTypingScore\(\{ typedText, passage, elapsedSeconds: summary\.elapsedSeconds, wordMethod: categoryPreset\.wordMethod, scoringProfile: categoryPreset\.scoringProfile, includeUntypedWords: true \}\);/);
  assert.match(source,/categoryResult\.categoryMarks && categoryPreset\.marksMethod/);
});

// Real reported feedback, follow-up on the RSSB marks-method path
// specifically: "Typing Details" (the word-count breakdown: passage words,
// total/correct/incorrect words, backspaces, ...) rendered as its own
// section above "Speed Details" (the WPM/KPM-toggle speed figures) --
// "image first details should come in wpm section... if anyone click on
// kpm all the information should there". Merged into one RssbSpeedDetails
// section: the word-count breakdown is always visible under both units,
// only the speed-specific metrics switch between WPM and KPM/KDPH.
test("RssbSpeedDetails always shows the word-count breakdown regardless of the WPM/KPM toggle, replacing the separate Typing Details section", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.doesNotMatch(source, /function RssbTypingDetails/);
  assert.doesNotMatch(source, /<RssbTypingDetails/);
  assert.match(source, /function RssbSpeedDetails\(/);
  const componentStart = source.indexOf("function RssbSpeedDetails(");
  const componentBody = source.slice(componentStart, source.indexOf("\nfunction ", componentStart + 1));
  assert.match(componentBody, /const speedMetrics = unit === "wpm"/);
  assert.match(componentBody, /const overviewRows = \[\["Passage words",summary\.passageWords\],\["Total words typed",summary\.totalWordsTyped\],\["Fully correct words",summary\.correctWordsTyped\],\["Remaining \/ unattempted words",summary\.remainingWords\],\["Backspaces",summary\.backspaces\]\] as const;/);
  // speedMetrics dl (unit-dependent), the overviewRows dl, and the two
  // MistakeBreakdown cards (always shown) all follow the toggle in order --
  // see the dedicated Full/Half grouping test below for why the mistake
  // breakdown moved in here instead of staying a flat, unlabeled row.
  const toggleIndex = componentBody.indexOf('aria-label="Speed unit"');
  const speedDl = componentBody.indexOf("speedMetrics.map", toggleIndex);
  const overviewDl = componentBody.indexOf("overviewRows.map", toggleIndex);
  const mistakeBreakdown = componentBody.indexOf("<MistakeBreakdown", toggleIndex);
  assert.ok(toggleIndex >= 0 && toggleIndex < speedDl && speedDl < overviewDl && overviewDl < mistakeBreakdown);
});

// Real reported feedback: the Speed Details word-count grid used to list
// Substitutions, Additions, Repeated words, Omitted words, and
// Half-mistake words all in one flat row alongside neutral counts like
// Passage words and Backspaces, with no way to tell which numbers were
// full mistakes, which were half mistakes, and which weren't mistakes at
// all. RssbSpeedDetails now reuses the same MistakeBreakdown cards (red
// "Full mistakes" / purple "Half mistakes", each with its own total and
// itemized sub-breakdown) already used elsewhere in this file, instead of
// a standalone RssbMistakeDetails component shown a second time in a tab.
test("RssbSpeedDetails groups mistakes into labeled Full/Half MistakeBreakdown cards instead of one flat, unlabeled word-count row", async () => {
  const source = await read("app/typing/_components/advanced-typing-results.tsx");
  const componentStart = source.indexOf("function RssbSpeedDetails(");
  const componentBody = source.slice(componentStart, source.indexOf("\nfunction ", componentStart + 1));
  assert.match(componentBody, /<MistakeBreakdown title="Full mistakes" total=\{summary\.fullMistakes\} items=\{\[\["Substitutions",summary\.fullCategories\.substitutions\],\["Additions",summary\.fullCategories\.additions\],\["Repetitions",summary\.fullCategories\.repetitions\],\["Omissions",summary\.fullCategories\.omissions\]\]\} tone="red"\/>/);
  assert.match(componentBody, /<MistakeBreakdown title="Half mistakes" total=\{summary\.halfMistakes\} items=\{\[\["Capitalization",summary\.halfCategories\.capitalization\],\["Punctuation",summary\.halfCategories\.punctuation\],\["Spacing",summary\.halfCategories\.spacing\],\["Spelling",summary\.halfCategories\.spelling\]\]\} tone="purple"\/>/);
  assert.doesNotMatch(source, /function RssbMistakeDetails/);
});

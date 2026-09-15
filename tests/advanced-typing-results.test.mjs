import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EXAM_PRESETS, HINDI_KRUTI_DEV } from "../lib/typing-curriculum.ts";
import { getInputSystemPassage, getScoringText } from "../lib/typing-language.ts";
import { buildRequirementResults, buildResultCalculations, buildResultSummary, categoryTotalsReconcile, comparisonWordDisplay, resultCategoryTotals } from "../lib/typing-results.ts";
import { calculateTypingScore } from "../lib/typing-test.ts";

function resultFor(preset, inputSystem = preset.inputSystems[0]) {
  const passage = getInputSystemPassage(inputSystem, preset.passage);
  const score = calculateTypingScore({ typedText: passage, passage, elapsedSeconds: 60, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  return { passage, score };
}

test("dual result calculations support English and Hindi typing plus English and Hindi stenography", () => {
  for (const id of ["rssb-ldc-english", "rssb-ldc-hindi", "english-stenography", "hindi-stenography"]) {
    const preset = EXAM_PRESETS.find((item) => item.id === id);
    assert.ok(preset);
    const { passage } = resultFor(preset);
    const calculations = buildResultCalculations({ passage, typedText: passage, elapsedSeconds: 60, scoringProfile: preset.scoringProfile });
    assert.deepEqual(calculations.map((item) => item.method), ["characters", "spaces"]);
    assert.ok(calculations.every((item) => item.score.accuracy === 100));
  }
});

test("Kruti Dev results are scored on decoded Unicode text, so score.analysis.entries is already display-ready and the results component must not re-decode it", () => {
  // Regression guard for a real bug: calculateTypingScore() now receives
  // getScoringText()-decoded (Unicode) text for Kruti Dev tests, not raw
  // legacy bytes (see typing-language.ts). If the results component still
  // ran entry.original/entry.typed through krutiDevToUnicode() a second
  // time -- the previous behavior -- any legacy-significant character that
  // survived into the decoded text (e.g. a literal comma, which the legacy
  // dictionary maps to "ए") gets corrupted: "ज्ञान," becomes "ज्ञानए".
  const preset = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-hindi");
  const passage = getInputSystemPassage(HINDI_KRUTI_DEV, preset.passage);
  assert.equal(passage, HINDI_KRUTI_DEV.passageOverride);
  const decodedPassage = getScoringText(passage, HINDI_KRUTI_DEV);
  const score = calculateTypingScore({ typedText: decodedPassage, passage: decodedPassage, elapsedSeconds: 60, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  assert.equal(score.accuracy, 100);
  assert.match(score.analysis.entries[0].original, /[ऀ-ॿ]/u); // already real Devanagari, not raw legacy bytes
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /krutiDevToUnicode/);
  assert.match(component, /const displayEntries = score\.analysis\.entries;/);
});

test("passage-derived analysis values receive the selected font and language explicitly", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /const fontFamily = inputSystem\.inputEncoding === "krutidev-legacy" \? '\"Nirmala UI\"/);
  assert.match(component, /const textLanguage = inputSystem\.language === "Hindi" \? "hi" : "en"/);
  for (const componentName of ["PassageFlow", "CategoryAnalysis", "SelfAnalysis", "ErrorDetail"]) {
    assert.match(component, new RegExp(`<${componentName}[^>]+fontFamily=\\{fontFamily\\}[^>]+textLanguage=\\{textLanguage\\}`));
  }
  assert.match(component, /function PassageValue[^\n]+style=\{\{fontFamily\}\} lang=\{textLanguage\}/);
  assert.match(component, /Expected: <b style=\{\{fontFamily\}\} lang=\{textLanguage\}>\{row\.expected\}<\/b>/);
  assert.match(component, /<span style=\{\{fontFamily\}\} lang=\{textLanguage\}>\{item\.text\}<\/span>/);
  assert.match(component, /Focused practice passage<\/h3><p[^>]+style=\{\{fontFamily\}\} lang=\{textLanguage\}/);
  for (const heading of ["Repeated mistakes", "Weak words", "Weak characters", "Recommended next-practice words", "Focused practice passage", "Full Errors", "Half Errors"]) {
    assert.match(component, new RegExp(`(?:title=|title: |>)"?${heading}`));
  }
  assert.doesNotMatch(component, /role="tabpanel"[^>]+style=\{\{ fontFamily \}\}/);
});

test("Kruti Dev analysis keeps raw encoded scoring values while result display conversion is separate", () => {
  const preset = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-hindi");
  assert.ok(preset);
  const passage = getInputSystemPassage(HINDI_KRUTI_DEV, preset.passage);
  const rawWords = passage.split(/\s+/u).slice(0, 5);
  const typedText = `${rawWords[0]} ${rawWords[1]} gSA ${rawWords[3]} ${rawWords[4]}`;
  const score = calculateTypingScore({ typedText, passage, elapsedSeconds: 60, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  assert.ok(score.analysis.entries.some((entry) => entry.typed === "gSA"));
  assert.equal(score.analysis.entries.filter((entry) => entry.status !== "correct" && entry.status !== "remaining").length > 0, true);
  assert.equal(score.analysis.counts.correct + score.analysis.counts.substituted + score.analysis.counts.extra + score.analysis.counts.repeated + score.analysis.counts.halfError, 5);
});

test("category counts and penalties reconcile with the scoring-engine total", () => {
  const preset = EXAM_PRESETS[0];
  const score = calculateTypingScore({ typedText: "hello Wurld extra", passage: "Hello world missing", elapsedSeconds: 60, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  const totals = resultCategoryTotals(score, 3, preset.scoringProfile);
  assert.equal(totals.find((item) => item.key === "full").count, score.analysis.fullErrors);
  assert.equal(totals.find((item) => item.key === "half").count, score.analysis.halfErrors);
  assert.equal(categoryTotalsReconcile(score, preset.scoringProfile), true);
});

test("pass and fail explanations report each requirement independently", () => {
  const score = resultFor(EXAM_PRESETS[0]).score;
  const requirements = buildRequirementResults(score, score.netWpm + 1, 101);
  assert.deepEqual(requirements.map((item) => item.key), ["speed", "accuracy"]);
  assert.ok(requirements.every((item) => item.passed === false));
});

test("result calculations exclude untouched remaining words from incorrect totals", () => {
  const preset = EXAM_PRESETS[0];
  const calculations = buildResultCalculations({ passage: "one two three four", typedText: "one", elapsedSeconds: 60, scoringProfile: preset.scoringProfile });
  assert.ok(calculations.every((item) => item.incorrectWords === 0));
  assert.ok(calculations.every((item) => item.score.analysis.remainingWords === 3));
  assert.ok(calculations.every((item) => item.score.analysis.totalPenalty === 0));
});

// Real reported confusion: the Summary tab showed a "Net WPM" computed as
// Gross WPM minus a combined error penalty, right alongside the Speed
// Details card's "Net Speed (WPM)" computed as correct words / time --
// two different numbers under the same name on the same results page.
// RSMSSB has no negative marking (confirmed by research), so for a
// marks-method-configured test only the correct-words/time definition is
// real; buildResultCalculations must use it -- and everything derived
// from it (efficiency, qualification) -- whenever hasMarksMethod is set,
// while leaving every other (non-RSSB) preset's penalty-based Net WPM
// untouched.
test("buildResultCalculations uses the correct-words/time Net WPM for marks-method tests, not the generic gross-minus-penalty figure", () => {
  const preset = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-english");
  assert.ok(preset);
  const passage = "one two three four five six seven eight";
  const typedText = "One two three four five Sixx seven eight";
  const elapsedSeconds = 60;
  const withoutFlag = buildResultCalculations({ passage, typedText, elapsedSeconds, scoringProfile: preset.scoringProfile });
  const withFlag = buildResultCalculations({ passage, typedText, elapsedSeconds, scoringProfile: preset.scoringProfile, hasMarksMethod: true });
  for (const calculation of withoutFlag) {
    assert.equal(calculation.netWpm, calculation.score.netWpm);
    assert.match(calculation.netWpmFormula, /combined error penalty/);
  }
  for (const calculation of withFlag) {
    assert.equal(calculation.netWpm, Math.round(calculation.correctWords / (elapsedSeconds / 60)));
    assert.notEqual(calculation.netWpm, calculation.score.netWpm);
    assert.match(calculation.netWpmFormula, /RSMSSB has no negative marking/);
    assert.equal(calculation.efficiency, calculation.score.grossWpm > 0 ? Math.min(100, Math.round((calculation.netWpm / calculation.score.grossWpm) * 100)) : 100);
    assert.equal(calculation.qualified, calculation.netWpm >= preset.scoringProfile.passNetWpm && calculation.score.accuracy >= preset.scoringProfile.passAccuracy);
  }
});

test("comparison display pairs substitutions and half mistakes with originals only", () => {
  const entry = (status, original, typed, halfErrorCategories = []) => ({ id: status, status, original, typed, halfErrorCategories, separatorAfter: " " });
  assert.deepEqual(comparisonWordDisplay(entry("substituted", "young", "Yong")), { text: "Yong", expected: "young" });
  for (const category of ["capitalization", "minorSpelling", "spacing", "punctuation"]) {
    assert.deepEqual(comparisonWordDisplay(entry("half-error", "their", "THEIR", [category])), { text: "THEIR", expected: "their" });
  }
  assert.deepEqual(comparisonWordDisplay(entry("missing", "skipped", undefined)), { text: "", expected: "skipped" });
  assert.deepEqual(comparisonWordDisplay(entry("extra", undefined, "bonus")), { text: "bonus", expected: undefined });
  assert.deepEqual(comparisonWordDisplay(entry("repeated", undefined, "again")), { text: "again", expected: undefined });
  assert.deepEqual(comparisonWordDisplay(entry("remaining", "later", undefined)), { text: "later", expected: undefined });
});

test("result summary percentages and totals reconcile with the scoring engine", () => {
  const preset = EXAM_PRESETS[0];
  const passage = "Hello, one two three four";
  const score = calculateTypingScore({ typedText: "hello one bonus three three", passage, elapsedSeconds: 60, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  const summary = buildResultSummary(passage, score, 4);
  assert.equal(summary.typedCharacters, score.totalCharacters);
  assert.equal(summary.rightCharacters + summary.wrongCharacters, summary.typedCharacters);
  assert.equal(summary.errorPercentage, Math.min(100, Math.max(0, 100 - score.accuracy)));
  assert.ok(summary.errorPercentage >= 0 && summary.errorPercentage <= 100);
  assert.equal(summary.incorrectWordsTyped, score.analysis.counts.substituted + score.analysis.counts.extra + score.analysis.counts.repeated);
  assert.equal(summary.omittedWords, score.analysis.counts.missing);
  assert.equal(summary.fullMistakes, Object.values(summary.fullCategories).reduce((total, value) => total + value, 0));
  assert.equal(summary.halfMistakes, Object.values(summary.halfCategories).reduce((total, value) => total + value, 0));
  assert.equal(summary.remainingWords, score.analysis.remainingWords);
  assert.equal(summary.passed, score.passed);
  assert.equal(summary.totalWordsTyped, summary.correctWordsTyped + summary.substitutedWords + summary.addedWords + summary.repeatedWords + summary.halfMistakeWords);
  assert.equal(summary.passageWords, summary.correctWordsTyped + summary.substitutedWords + summary.halfMistakeWords + summary.omittedWords + summary.remainingWords);
  assert.equal(summary.accuracy + summary.errorPercentage, 100);
  assert.equal(summary.grossWordsPerMinute, summary.totalWordsTyped);
  assert.equal(summary.grossCharactersPerMinute, summary.typedCharacters);
  assert.equal(summary.netWordsPerMinute, summary.correctWordsTyped);
  assert.equal(summary.netCharactersPerMinute, summary.rightCharacters);
  assert.equal(summary.grossKeystrokesPerHour, summary.grossCharactersPerMinute * 60);
  assert.equal(summary.netKeystrokesPerHour, summary.netCharactersPerMinute * 60);
  assert.equal(summary.penaltyAdjustedNetWpm, score.netWpm);
});

test("aw reference shape keeps 330 interior omissions separate from 39 remaining words", () => {
  const preset = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-english");
  assert.ok(preset);
  const passage = Array.from({ length: 500 }, (_, index) => `word${index + 1}`).join(" ");
  const base = calculateTypingScore({ typedText: "word1", passage, elapsedSeconds: 220, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  const score = {
    ...base,
    totalCharacters: 900,
    correctCharacters: 850,
    incorrectCharacters: 50,
    accuracy: 850 / 9,
    analysis: {
      ...base.analysis,
      counts: { correct: 125, substituted: 1, missing: 330, extra: 0, repeated: 0, halfError: 5, remaining: 39 },
      categoryCounts: { capitalization: 2, punctuation: 1, spacing: 1, minorSpelling: 1 },
      fullErrors: 331,
      halfErrors: 5,
      remainingWords: 39,
    },
  };
  const summary = buildResultSummary(passage, score, 0);
  assert.deepEqual({ correct: summary.correctWordsTyped, substitutions: summary.substitutedWords, half: summary.halfMistakeWords, omitted: summary.omittedWords, remaining: summary.remainingWords, typed: summary.totalWordsTyped }, { correct: 125, substitutions: 1, half: 5, omitted: 330, remaining: 39, typed: 131 });
  assert.equal(summary.totalWordsTyped, summary.correctWordsTyped + summary.substitutedWords + summary.addedWords + summary.repeatedWords + summary.halfMistakeWords);
  assert.equal(summary.passageWords, summary.correctWordsTyped + summary.substitutedWords + summary.halfMistakeWords + summary.omittedWords + summary.remainingWords);
  assert.equal(summary.rightCharacters + summary.wrongCharacters, summary.typedCharacters);
  assert.equal(summary.accuracy + summary.errorPercentage, 100);
});

test("speed and reconciliation formulas apply to English, Hindi Unicode, and Kruti Dev", () => {
  const cases = [
    [EXAM_PRESETS.find((item) => item.id === "rssb-ldc-english"), undefined],
    [EXAM_PRESETS.find((item) => item.id === "rssb-ldc-hindi"), undefined],
    [EXAM_PRESETS.find((item) => item.id === "rssb-ldc-hindi"), HINDI_KRUTI_DEV],
  ];
  for (const [preset, system] of cases) {
    assert.ok(preset);
    const passage = getInputSystemPassage(system ?? preset.inputSystems[0], preset.passage);
    const typedText = passage.split(/\s+/u).slice(0, 12).join(" ");
    const score = calculateTypingScore({ typedText, passage, elapsedSeconds: 120, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
    const summary = buildResultSummary(passage, score, 0);
    assert.equal(summary.grossWordsPerMinute, summary.totalWordsTyped / 2);
    assert.equal(summary.grossCharactersPerMinute, summary.typedCharacters / 2);
    assert.equal(summary.netWordsPerMinute, summary.correctWordsTyped / 2);
    assert.equal(summary.netCharactersPerMinute, summary.rightCharacters / 2);
    assert.equal(summary.fullMistakes, Object.values(summary.fullCategories).reduce((sum, count) => sum + count, 0));
    assert.equal(summary.halfMistakes, Object.values(summary.halfCategories).reduce((sum, count) => sum + count, 0));
    assert.equal(summary.rightCharacters + summary.wrongCharacters, summary.typedCharacters);
  }
});

// Real reported request: a WPM/KPM toggle in Speed Details so a student
// isn't shown both unit families' cards at once -- WPM shows Gross/Net
// Speed (WPM) only, KPM shows Gross/Net Speed (CPM/KPM) plus the KDPH
// figures (which have no WPM equivalent), defaulting to WPM.
test("Speed Details offers a WPM/KPM toggle instead of always showing every speed metric at once", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /const \[unit, setUnit\] = useState<"wpm" \| "kpm">\("wpm"\);/);
  assert.match(component, /role="group" aria-label="Speed unit"/);
  assert.match(component, /aria-pressed=\{unit === "wpm"\} onClick=\{\(\) => setUnit\("wpm"\)\}/);
  assert.match(component, /aria-pressed=\{unit === "kpm"\} onClick=\{\(\) => setUnit\("kpm"\)\}/);
  assert.match(component, /unit === "wpm"\s*\n\s*\? \[\["Gross Speed \(WPM\)", `\$\{summary\.grossWordsPerMinute\.toFixed\(2\)\} WPM`\], \["Net Speed \(WPM\)", `\$\{summary\.netWordsPerMinute\.toFixed\(2\)\} WPM`\]\]/);
});

// Real reported request: RSSB's configured marks method (Rajasthan LDC,
// Rajasthan DEO) has no negative marking, so the penalty-based "Half
// mistake / Full mistake" scoring guide misstates its real rules and must
// not render for any test using that marks method.
test("the penalty-based Error Scoring Guide is hidden for RSSB marks-method tests, shown otherwise", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /\{!marksResult && <ErrorScoringGuide profile=\{preset\.scoringProfile\} textLanguage=\{textLanguage\} entries=\{score\.analysis\.entries\} savedPenalty=\{score\.analysis\.totalPenalty\}\/>\}/);
});

test("the Summary tab's calculations are told whether this preset uses the RSSB marks method, so its Net WPM formula can switch", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /buildResultCalculations\(\{ passage, typedText, elapsedSeconds: score\.elapsedSeconds, scoringProfile: preset\.scoringProfile, hasMarksMethod: Boolean\(preset\.marksMethod\) \}\)/);
  assert.match(component, /\["Net WPM",String\(calculation\.netWpm\),calculation\.netWpmFormula\]/);
  assert.match(component, /\["Efficiency",`\$\{calculation\.efficiency\}%`/);
});

test("the shared result exposes every accessible view and interactive error details", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /export function AdvancedTypingResults\(/);
  for (const label of ["Summary", "Combined Analysis", "Original Passage", "Typed Passage", "Errors Only", "Category Analysis", "Self Analysis"]) assert.match(component, new RegExp(label));
  assert.match(component, /role="tablist"/);
  assert.match(component, /Show error details/);
  assert.match(component, /Print \/ Save PDF/);
  assert.match(component, /bg-orange-100/);
  assert.match(component, /line-through/);
  for (const label of ["Total Chars", "Typed Chars", "Right Chars", "Wrong Chars", "Character Accuracy", "Gross Speed", "Net Speed", "Error", "Result", "Time Taken", "Backspace", "Remaining"]) assert.match(component, new RegExp(label));
  assert.match(component, /result-overview-title/);
  assert.match(component, /summary\.remainingWords/);
  assert.match(component, /summary\.remainingCharacters/);
  assert.match(component, /<PassageFlow entries=\{entries\} onSelect=\{onSelect\} fontFamily=\{fontFamily\} textLanguage=\{textLanguage\} compact\/>/);
  assert.match(component, /missing: "rounded border border-red-200/);
  assert.match(component, /extra: "font-bold text-red-700 line-through/);
  assert.match(component, /"half-error": "font-bold text-blue-700 underline/);
  assert.match(component, /remaining: "text-slate-500"/);
  assert.match(component, /text-green-700/);
  assert.match(component, /\[\{display\.expected\}\]/);
  for (const label of ["Detailed Result", "Total words typed", "Correct words typed", "Incorrect words typed", "Omitted / skipped words", "Full mistakes", "Half mistakes"]) assert.match(component, new RegExp(label));
  for (const label of ["Configured Marks Method", "Maximum Marks", "Minimum Passing Marks", "Marks Obtained", "Correct words used for marks", "Rules and Instructions"]) assert.match(component, new RegExp(label));
  for (const label of ["Typing Details", "Speed Details", "Full / Half Mistake Breakdown", "Detailed Passage Comparison", "Gross Speed (CPM / KPM)", "Net Speed (CPM / KPM)"]) assert.ok(component.includes(label));
  assert.match(component, /result\.durationWarning/);
  assert.doesNotMatch(component, /MARKS INVALID|Marks Invalid|>Invalid</);
  const ordered = ["<RssbMarksPanel", "<RssbTypingDetails", "<RssbSpeedDetails", "<ComparisonTextPanel", "role=\"tablist\""];
  assert.ok(ordered.every((needle, index) => index === 0 || component.indexOf(ordered[index - 1]) < component.indexOf(needle)));
  // Real reported request: Full / Half Mistake Breakdown moved off the
  // always-visible summary and into the "Errors Only" tab specifically,
  // alongside the mistakes-only PassageFlow -- not shown unconditionally
  // above the tabs any more.
  assert.ok(component.indexOf("role=\"tablist\"") < component.indexOf("<RssbMistakeDetails"));
  assert.match(component, /\{tab === "errors" && <>\{marksResult && <RssbMistakeDetails summary=\{summary\}\/>\}<PassageFlow entries=\{mistakes\}/);
  assert.doesNotMatch(component, /Configured method · not officially verified/);
  assert.doesNotMatch(component, /Marks qualification uses/);
  assert.doesNotMatch(component, /<sup/);
  assert.doesNotMatch(component, /\[expected:/);
});

test("the blue identity and requirement summary panel is completely removed", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  for (const removed of ["Guest / local learner", "Test date", "Category / topic", "Font / keyboard", "Actual {item.actual}", "benchmark {item.required}", "Final status", "function Meta("]) assert.doesNotMatch(component, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(component, /from-blue-950 via-blue-800 to-blue-600/);
  assert.match(component, /\[&>:first-child\]:mt-0/);
  assert.match(component, /buildResultSummary\(passage, score, backspaces\)/);
  assert.match(component, /calculateConfiguredRssbMarks\(score, preset\.marksMethod\)/);
});

test("all result consumers import the exact shared module and named export", () => {
  for (const path of ["../app/typing/_components/configurable-typing-exam.tsx", "../app/typing/_components/lesson-workspace.tsx"]) {
    const consumer = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(consumer, /import \{ AdvancedTypingResults \} from "\.\/advanced-typing-results"/);
    assert.match(consumer, /<AdvancedTypingResults/);
    assert.doesNotMatch(consumer, /AdvancedTypingResult(?:\s|<)/);
  }
});

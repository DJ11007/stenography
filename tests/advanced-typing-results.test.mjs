import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EXAM_PRESETS, HINDI_KRUTI_DEV } from "../lib/typing-curriculum.ts";
import { getInputSystemPassage, getScoringText } from "../lib/typing-language.ts";
import { buildRequirementResults, buildResultCalculations, buildResultSummary, categoryTotalsReconcile, comparisonWordDisplay, requiredWpmForMarksMethod, resultCategoryTotals } from "../lib/typing-results.ts";
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

// Real reported bug: the Summary tab's "Qualification" row compared netWpm
// against scoringProfile.passNetWpm -- the category's FULL-marks pace (e.g.
// Rajasthan LDC English's 35/50 WPM), not RSMSSB's actual, much lower
// qualifying threshold (9 minimum marks / 0.05 per word = 180 correct words,
// 18 WPM over a 10-minute attempt). An attempt with plenty of correct words
// but a below-full-marks pace could show "Not qualified" here while the
// Configured Marks Method panel right above it -- built from the same
// correct-word count -- already said "Qualified", a visible contradiction on
// one results page. Passing marksMethod must make the two agree.
test("buildResultCalculations' Qualification mirrors calculateConfiguredRssbMarks exactly when a marksMethod is supplied, instead of the full-marks-pace WPM threshold", () => {
  const preset = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-english");
  assert.ok(preset);
  assert.ok(preset.marksMethod);
  const passage = Array.from({ length: 200 }, () => "word").join(" ");
  const typedText = passage;
  const elapsedSeconds = 600; // a full 10-minute attempt, so RSMSSB's marks scheme applies cleanly
  const withoutMarksMethod = buildResultCalculations({ passage, typedText, elapsedSeconds, scoringProfile: preset.scoringProfile, hasMarksMethod: true });
  const withMarksMethod = buildResultCalculations({ passage, typedText, elapsedSeconds, scoringProfile: preset.scoringProfile, hasMarksMethod: true, marksMethod: preset.marksMethod });
  for (const calculation of withoutMarksMethod) {
    assert.equal(calculation.netWpm, 20); // 200 correct words / 10 minutes
    assert.equal(calculation.qualified, false); // 20 < scoringProfile.passNetWpm (35) -- the bug
    assert.match(calculation.qualifiedFormula, /Both net-speed and accuracy/);
  }
  for (const calculation of withMarksMethod) {
    assert.equal(calculation.netWpm, 20);
    assert.equal(calculation.qualified, true); // 200 * 0.05 = 10 marks >= 9 minimum -- the fix
    assert.match(calculation.qualifiedFormula, /RSMSSB's real, time-independent qualifying rule/);
  }
});

test("requiredWpmForMarksMethod derives the real qualifying pace from the marks scheme, distinct from the category's full-marks pace", () => {
  const english = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-english");
  const hindi = EXAM_PRESETS.find((item) => item.id === "rssb-ldc-hindi");
  assert.equal(requiredWpmForMarksMethod(english.marksMethod), 18); // 9 / 0.05 = 180 words / 10 min
  assert.equal(requiredWpmForMarksMethod(hindi.marksMethod), 14.4); // 9 / 0.0625 = 144 words / 10 min
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

// Real reported request: several boards (NCERT, SSC, DDA...) publish their
// speed requirement in KDPH, not just WPM (e.g. NCERT's "35 WPM = 10,500
// KDPH", the 5-key-depressions-per-word convention), so non-RSSB results
// need a WPM/KDPH view too -- derived from summary.grossWpm/netWpm (the
// same, already-penalty-aware numbers shown as Gross/Net Speed elsewhere
// on this exact results screen), not a second, different "net speed"
// formula.
// Real reported feedback, follow-up: the character-based summary cards
// (which used to cover Practice's speed display) were removed as
// redundant with this panel -- so this is now the ONLY speed source for
// every mode, including Practice, not hidden there any more.
test("non-RSSB results offer a WPM/KDPH Speed Details panel derived from summary.grossWpm/netWpm, shown for every mode including Practice", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /function KeyDepressionSpeedDetails\(/);
  assert.match(component, /const \[unit, setUnit\] = useState<"wpm" \| "kdph">\("wpm"\);/);
  assert.match(component, /\["Gross Speed \(WPM\)", `\$\{number\(summary\.grossWpm\)\} WPM`\], \["Net Speed \(WPM\)", `\$\{number\(summary\.netWpm\)\} WPM`\]/);
  assert.match(component, /\["Gross Speed \(KDPH\)", number\(summary\.grossWpm \* 300\)\], \["Net Speed \(KDPH\)", number\(summary\.netWpm \* 300\)\]/);
  assert.match(component, /<><ResultBanner label=\{resultLabel\} passed=\{resultPassed\} title=\{preset\.title\}\/><KeyDepressionSpeedDetails summary=\{summary\}\/><\/>/);
  assert.doesNotMatch(component, /mode !== "practice" && <KeyDepressionSpeedDetails/);
});

// Real reported request: RSSB's configured marks method (Rajasthan LDC,
// Rajasthan DEO) has no negative marking, so the penalty-based "Half
// mistake / Full mistake" scoring guide misstates its real rules and must
// not render for any test using that marks method.
test("the penalty-based Error Scoring Guide is hidden for RSSB marks-method tests and for Practice attempts, shown otherwise", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /\{!marksResult && mode !== "practice" && <ErrorScoringGuide profile=\{preset\.scoringProfile\} textLanguage=\{textLanguage\} entries=\{score\.analysis\.entries\} savedPenalty=\{score\.analysis\.totalPenalty\}\/>\}/);
});

// Real reported request: the exact penalty weight ("Applied penalty" column
// showing 1 / 0.5) is specific to each exam's own official rules, which get
// researched and configured one exam at a time (see RSSB's marks method) --
// asserting a generic 1/0.5 for every exam misrepresents exams that haven't
// been researched yet, so it now shows "-" until that exam's real rule is
// implemented. Practice isn't following any specific exam's rules at all,
// so it drops the whole guide instead (see the test above), rather than
// showing it with every value blanked.
test("the Error Scoring Guide shows \"-\" for Applied penalty instead of asserting a generic 1/0.5 for every exam", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /\{number\(definition\.penalty\)\}/);
  assert.match(component, /className="p-3 font-black" title="Not yet configured for this exam's official rules">-<\/td>/);
  assert.match(component, /\{definition\.kind==="full"\?"Full mistake":"Half mistake"\} · -<\/span>/);
});

// Real reported feedback: the Summary tab's two "Character-based
// calculation" / "Space-separated word calculation" reconciliation panels
// duplicated the same accuracy/speed numbers the WPM/KDPH-toggle Speed
// Details panel already reports authoritatively -- "what is the need of
// this two result... this is waste" -- so the Summary tab (and the
// buildResultCalculations-driven Summary/CalculationTable components that
// rendered it) was removed entirely, not just reordered.
test("the redundant Summary tab and its dual calculation-method panels are removed from the typing results component", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /function Summary\(/);
  assert.doesNotMatch(component, /function CalculationTable\(/);
  assert.doesNotMatch(component, /buildResultCalculations/);
  assert.doesNotMatch(component, /categoryTotalsReconcile/);
  assert.doesNotMatch(component, /requiredWpmForMarksMethod/);
  assert.doesNotMatch(component, /"summary"/);
  assert.match(component, /const \[tab, setTab\] = useState<ResultTab>\("combined"\);/);
});

test("the shared result exposes every accessible view and interactive error details", () => {
  const component = readFileSync(new URL("../app/typing/_components/advanced-typing-results.tsx", import.meta.url), "utf8");
  assert.match(component, /export function AdvancedTypingResults\(/);
  for (const label of ["Combined Analysis", "Original Passage", "Typed Passage", "Errors Only", "Category Analysis", "Self Analysis"]) assert.match(component, new RegExp(label));
  assert.match(component, /role="tablist"/);
  assert.match(component, /Show error details/);
  assert.match(component, /Print \/ Save PDF/);
  assert.match(component, /bg-orange-100/);
  assert.match(component, /line-through/);
  // Real reported feedback: the character-based summary cards ("Total
  // Chars"/"Character Accuracy"/...) duplicated the word-based Detailed
  // Result and the WPM/KDPH Speed Details panel -- removed entirely for
  // typing, along with their result-overview-title heading.
  assert.doesNotMatch(component, /Total Chars/);
  assert.doesNotMatch(component, /Character Accuracy/);
  assert.doesNotMatch(component, /result-overview-title/);
  assert.match(component, /summary\.remainingWords/);
  assert.match(component, /<PassageFlow entries=\{entries\} onSelect=\{onSelect\} fontFamily=\{fontFamily\} textLanguage=\{textLanguage\} compact\/>/);
  assert.match(component, /missing: "rounded border border-red-200/);
  assert.match(component, /extra: "font-bold text-red-700 line-through/);
  assert.match(component, /"half-error": "font-bold text-blue-700 underline/);
  assert.match(component, /remaining: "text-slate-500"/);
  assert.match(component, /text-green-700/);
  assert.match(component, /\[\{display\.expected\}\]/);
  for (const label of ["Detailed Result", "Total words typed", "Correct words typed", "Incorrect words typed", "Omitted / skipped words", "Full mistakes", "Half mistakes"]) assert.match(component, new RegExp(label));
  for (const label of ["Configured Marks Method", "Maximum Marks", "Minimum Passing Marks", "Marks Obtained", "Correct words used for marks", "Rules and Instructions"]) assert.match(component, new RegExp(label));
  for (const label of ["Speed Details", "Full / Half Mistake Breakdown", "Detailed Passage Comparison", "Gross Speed (CPM / KPM)", "Net Speed (CPM / KPM)"]) assert.ok(component.includes(label));
  assert.match(component, /result\.durationWarning/);
  assert.doesNotMatch(component, /MARKS INVALID|Marks Invalid|>Invalid</);
  // Real reported feedback: "Typing Details" (the word-count breakdown) was
  // a separate section above Speed Details -- merged into RssbSpeedDetails
  // itself so the breakdown is always visible under either unit toggle
  // (see the dedicated merge test below), so that heading/component no
  // longer exists on its own.
  assert.doesNotMatch(component, /id="typing-details-title"/);
  assert.doesNotMatch(component, /function RssbTypingDetails/);
  // Stenography's own report (see isStenography branch) renders an earlier,
  // independent <ComparisonTextPanel> before any of this -- so the
  // ordering check below locates the ONE that follows <RssbSpeedDetails>
  // (inside the RSSB marks-method branch) rather than the first occurrence
  // in the file.
  const marksPanelIndex = component.indexOf("<RssbMarksPanel");
  const speedDetailsIndex = component.indexOf("<RssbSpeedDetails");
  const comparisonAfterSpeedDetails = component.indexOf("<ComparisonTextPanel", speedDetailsIndex);
  const tablistIndex = component.indexOf("role=\"tablist\"");
  assert.ok(marksPanelIndex >= 0 && marksPanelIndex < speedDetailsIndex);
  assert.ok(speedDetailsIndex < comparisonAfterSpeedDetails);
  assert.ok(comparisonAfterSpeedDetails < tablistIndex);
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

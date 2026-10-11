import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getExamCategory, examCategoryPresetId, defaultExamCategoryRules } from "../lib/exam-categories.ts";
import { getExamPreset, DELHI_POLICE_HCM_ENGLISH_MARKS_METHOD, DELHI_POLICE_HCM_HINDI_MARKS_METHOD } from "../lib/typing-curriculum.ts";
import { calculateSpeedBandMarks } from "../lib/typing-results.ts";
import { calculateTypingScore } from "../lib/typing-test.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Delhi Police HCM's notification clause "Typing Test on Computer (Maximum 25
// marks)": 10 minutes, 30 WPM English / 25 WPM Hindi to qualify, a banded
// WPM-to-marks table, and actual speed = tentative speed - 1 WPM per mistake.
const fakeScore = (netWpm, elapsedSeconds = 600) => ({ netWpm, grossWpm: netWpm + 5, elapsedSeconds });

test("Delhi Police HCM has no accuracy gate -- the clause gates only on actual speed", () => {
  const category = getExamCategory("delhi-police-hcm");
  assert.equal(category.accuracy, 0);
  for (const language of ["English", "Hindi"]) {
    const preset = getExamPreset(examCategoryPresetId("delhi-police-hcm", language));
    assert.equal(preset.scoringProfile.passAccuracy, 0);
    assert.equal(preset.durationSeconds, 600);
  }
  assert.equal(getExamPreset(examCategoryPresetId("delhi-police-hcm", "English")).scoringProfile.passNetWpm, 30);
  assert.equal(getExamPreset(examCategoryPresetId("delhi-police-hcm", "Hindi")).scoringProfile.passNetWpm, 25);
});

test("each language's preset carries its own banded marks table, and no other category does", () => {
  assert.equal(getExamPreset(examCategoryPresetId("delhi-police-hcm", "English")).speedMarksMethod, DELHI_POLICE_HCM_ENGLISH_MARKS_METHOD);
  assert.equal(getExamPreset(examCategoryPresetId("delhi-police-hcm", "Hindi")).speedMarksMethod, DELHI_POLICE_HCM_HINDI_MARKS_METHOD);
  assert.equal(DELHI_POLICE_HCM_ENGLISH_MARKS_METHOD.maximumMarks, 25);
  assert.equal(DELHI_POLICE_HCM_HINDI_MARKS_METHOD.maximumMarks, 25);
  assert.equal(getExamPreset(examCategoryPresetId("ssc-chsl", "English")).speedMarksMethod, undefined);
  assert.equal(getExamPreset(examCategoryPresetId("rajasthan-ldc", "English")).speedMarksMethod, undefined);
});

test("English marks follow the notification's table at every band edge", () => {
  const expected = [[29, 0, false], [30, 10, true], [31, 12, true], [35, 12, true], [36, 15, true], [40, 15, true], [41, 18, true], [45, 18, true], [46, 21, true], [50, 21, true], [51, 25, true], [90, 25, true]];
  for (const [wpm, marks, qualified] of expected) {
    const result = calculateSpeedBandMarks(fakeScore(wpm), DELHI_POLICE_HCM_ENGLISH_MARKS_METHOD);
    assert.equal(result.marksObtained, marks, `English ${wpm} WPM`);
    assert.equal(result.qualified, qualified, `English ${wpm} WPM qualification`);
  }
});

test("Hindi marks follow the notification's table at every band edge", () => {
  const expected = [[24, 0, false], [25, 10, true], [26, 12, true], [30, 12, true], [31, 15, true], [35, 15, true], [36, 18, true], [40, 18, true], [41, 21, true], [45, 21, true], [46, 25, true], [80, 25, true]];
  for (const [wpm, marks, qualified] of expected) {
    const result = calculateSpeedBandMarks(fakeScore(wpm), DELHI_POLICE_HCM_HINDI_MARKS_METHOD);
    assert.equal(result.marksObtained, marks, `Hindi ${wpm} WPM`);
    assert.equal(result.qualified, qualified, `Hindi ${wpm} WPM qualification`);
  }
});

test("a non-10-minute attempt still gets marks but with a caution", () => {
  const result = calculateSpeedBandMarks(fakeScore(40, 300), DELHI_POLICE_HCM_ENGLISH_MARKS_METHOD);
  assert.equal(result.marksObtained, 15);
  assert.equal(result.durationMatches, false);
  assert.match(result.durationWarning, /10-minute/);
  assert.equal(calculateSpeedBandMarks(fakeScore(40), DELHI_POLICE_HCM_ENGLISH_MARKS_METHOD).durationWarning, null);
});

// The notification's own worked example: 2000 strokes -> 400 words -> 40 WPM
// tentative; 10 mistakes; actual speed 40 - 10 = 30 WPM.
test("the notification's worked example (2000 strokes, 10 mistakes) scores 30 WPM actual and 10 marks, end to end", () => {
  const preset = getExamPreset(examCategoryPresetId("delhi-police-hcm", "English"));
  const words = Array.from({ length: 400 }, (_, index) => `w${String(index).padStart(3, "0")}`);
  const passage = words.join(" ");
  const typed = words.map((word, index) => (index % 40 === 0 ? "zzzz" : word)).join(" ");
  const score = calculateTypingScore({ typedText: typed, passage, elapsedSeconds: 600, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  assert.equal(score.netWpm, 30);
  const result = calculateSpeedBandMarks(score, preset.speedMarksMethod);
  assert.equal(result.actualWpm, 30);
  assert.equal(result.marksObtained, 10);
  assert.equal(result.qualified, true);
});

test("the rules page states the clause's real figures in both languages and no longer claims the marks formula is unknown", () => {
  const category = getExamCategory("delhi-police-hcm");
  const english = defaultExamCategoryRules(category, "English").join("\n");
  const hindi = defaultExamCategoryRules(category, "Hindi").join("\n");
  assert.match(english, /maximum of 25 marks/);
  assert.match(english, /30 WPM = 10, 31-35 = 12, 36-40 = 15, 41-45 = 18, 46-50 = 21, above 50 = 25/);
  assert.match(english, /25 WPM = 10, 26-30 = 12, 31-35 = 15, 36-40 = 18, 41-45 = 21, above 45 = 25/);
  assert.match(english, /40 - 10 = 30 WPM/);
  assert.match(english, /no separate accuracy requirement/);
  assert.doesNotMatch(english, /0% minimum accuracy/);
  assert.doesNotMatch(english, /wasn't found/);
  assert.match(hindi, /अधिकतम 25 अंक/);
  assert.match(hindi, /25 WPM = 10, 26-30 = 12/);
  assert.match(hindi, /अलग से कोई सटीकता सीमा नहीं/);
});

test("the banded marks are stored with the attempt, attached to shared exercises, and shown on the results screen", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /const speedMarksResult = !marksResult && preset\.speedMarksMethod \? calculateSpeedBandMarks\(score, preset\.speedMarksMethod\) : null;/);
  assert.match(actions, /marksQualified: marksResult \? marksResult\.qualified : speedMarksResult \? speedMarksResult\.qualified : null/);
  assert.match(actions, /marksObtained: marksResult \? marksResult\.marksObtained : speedMarksResult \? speedMarksResult\.marksObtained : null/);
  const admin = await read("lib/admin-tests.ts");
  assert.match(admin, /speedMarksMethod: effectiveCategory\?\.slug === "delhi-police-hcm"/);
  const results = await read("app/typing/_components/advanced-typing-results.tsx");
  assert.match(results, /<SpeedBandMarksPanel result=\{speedMarksResult\} method=\{preset\.speedMarksMethod\}\/>/);
  assert.match(results, /categoryResult\.categorySpeedMarks && categoryPreset\.speedMarksMethod/);
});

// Candidate/practice-resource descriptions of the real exam screen say it does
// not colour words or flag mistakes live (the notification itself is silent).
test("Delhi Police HCM shows no live highlight in either language, and says where that comes from", () => {
  assert.equal(getExamCategory("delhi-police-hcm").highlightMode, "none");
  for (const language of ["English", "Hindi"]) {
    assert.equal(getExamPreset(examCategoryPresetId("delhi-police-hcm", language)).highlightMode, "none");
  }
  assert.match(defaultExamCategoryRules(getExamCategory("delhi-police-hcm"), "English").join(" "), /No live highlighting/);
  assert.match(defaultExamCategoryRules(getExamCategory("delhi-police-hcm"), "Hindi").join(" "), /लाइव हाइलाइटिंग नहीं/);
});

// Checked against the official AIIMS CRE-5 notification (Notice 93/2026): the
// Group Code 3 annexure gives LDC/JAA a 15-minute test at 35/30 WPM, per-post
// advertisements give 10,500/9,000 KDPH and often "Time allowed 10 minutes",
// and the shared clause also quotes 12,000/8,000 (8,000 = Data Entry Operator).
test("AIIMS CRE LDC notes state the 15-minute annexure norm, the 10-minute advertisement caveat, the official penalty, and the correct KDPH figures", () => {
  const category = getExamCategory("aiims-cre-ldc");
  assert.equal(category.durationMinutes, 15);
  assert.equal(category.speedEnglish, 35);
  assert.equal(category.speedHindi, 30);
  assert.equal(category.fullErrorPenalty, 10);
  assert.equal(category.halfErrorPenalty, 5);
  const english = defaultExamCategoryRules(category, "English").join(" ");
  const hindi = defaultExamCategoryRules(category, "Hindi").join(" ");
  assert.match(english, /Group Code 3/);
  assert.match(english, /Time allowed 10 minutes/);
  assert.match(english, /50 strokes \(10 words\)/);
  assert.match(english, /10,500 \/ 9,000 KDPH/);
  assert.match(english, /8,000 KDPH is the Data Entry Operator standard/);
  assert.doesNotMatch(english, /\(or 12,000\/8,000 KDPH\)/);
  assert.match(hindi, /ग्रुप कोड 3/);
  assert.match(hindi, /10,500 \/ 9,000 केडीपीएच/);
  assert.doesNotMatch(hindi, /\(या 12,000\/8,000 केडीपीएच\)/);
});

test("a category with no accuracy gate says so instead of printing 0%", async () => {
  const exam = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(exam, /\["Required accuracy", preset\.accuracyRequirement === 0 \? "No separate requirement" : `\$\{preset\.accuracyRequirement\}%`\]/);
  const page = await read("app/typing/exams/category/[slug]/[language]/page.tsx");
  assert.match(page, /category\.accuracy === 0 \? "no separate accuracy requirement"/);
});

// Checked against BSF's own detailed advertisement (Directorate General BSF, ASI
// (Steno)/HC (Ministerial), ref. A.5/101/Pers(Rectt)/Min Staff/BSF/2021): "10%
// mistakes are allowed. For excess mistakes, 10 words for each mistake will be
// subtracted from the total words typed out." -- unlike the 5% other CAPF forces use.
test("BSF HCM uses its own advertisement's 10% mistake allowance and no invented accuracy gate; 400 words with 45 mistakes still qualifies", () => {
  const category = getExamCategory("bsf-hcm");
  assert.equal(category.errorRelaxationPercent, 10);
  assert.equal(category.fullErrorPenalty, 10);
  assert.equal(category.halfErrorPenalty, 5);
  assert.equal(category.accuracy, 0);
  assert.equal(category.speedEnglish, 35);
  assert.equal(category.speedHindi, 30);
  assert.equal(category.durationMinutes, 10);
  assert.equal(getExamCategory("crpf-hcm").errorRelaxationPercent, 5);
  const preset = getExamPreset(examCategoryPresetId("bsf-hcm", "English"));
  assert.equal(preset.scoringProfile.errorRelaxationPercent, 10);
  assert.equal(preset.scoringProfile.passAccuracy, 0);
  const words = Array.from({ length: 400 }, (_, index) => `w${String(index).padStart(3, "0")}`);
  const typed = words.map((word, index) => (index < 45 ? "zzzz" : word)).join(" ");
  const score = calculateTypingScore({ typedText: typed, passage: words.join(" "), elapsedSeconds: 600, wordMethod: preset.wordMethod, scoringProfile: preset.scoringProfile, includeUntypedWords: true });
  assert.equal(score.analysis.fullErrors, 45);
});

test("BSF HCM notes quote the advertisement's mistake rule and KDPH figures and are honest about what it does not state", () => {
  const english = defaultExamCategoryRules(getExamCategory("bsf-hcm"), "English").join(" ");
  const hindi = defaultExamCategoryRules(getExamCategory("bsf-hcm"), "Hindi").join(" ");
  assert.match(english, /10% mistakes are allowed/);
  assert.match(english, /10,500 \/ 9,000 KDPH/);
  assert.match(english, /does not state the passage length, whether Backspace is enabled/);
  assert.match(english, /no separate accuracy requirement/);
  assert.match(hindi, /10,500 \/ 9,000 केडीपीएच/);
  assert.match(hindi, /अलग सटीकता प्रतिशत नहीं/);
  assert.doesNotMatch(english, /confirmed as BSF's own distinct setting/);
});

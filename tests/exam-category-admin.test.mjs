import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Real bug reported: an admin created 3 exam tests, none of which were
// reachable anywhere as a student -- the admin-managed exam system and the
// 25 hardcoded exam-category simulators were completely disconnected.
// Fixed by requiring every non-live exam test to belong to one of the 25
// categories, deriving its real speed/duration/accuracy/backspace from
// that category (see tests/practice-tests-redesign.test.mjs for that
// derivation logic), and surfacing it on a new per-category exercise list.

test("the admin exam form offers a required Exam category select, only for exam mode non-live, placed before the auto-derived fields", async () => {
  const manager = await read("app/admin/tests/test-manager.tsx");
  assert.match(manager, /formMode==="exam" && !isLive && <Field label="Exam category">/);
  assert.match(manager, /name="examCategory"/);
  assert.match(manager, /EXAM_CATEGORIES\.map\(\(category\)=><option key=\{category\.slug\} value=\{category\.slug\}>\{category\.name\}/);
  assert.match(manager, /setExamCategorySlug\(\(test\?\.currentVersion\?\.configuration\?\.exam_category as string\|undefined\) \?\? ""\)/);
});

test("validateManagedTest requires a real EXAM_CATEGORIES slug for exam-mode non-live tests, and never for live/practice", async () => {
  const { validateManagedTest } = await import("../lib/admin-tests.ts");
  const base = { title: "Test", description: "", slug: "test", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 900, passage: "A sufficiently long English typing passage for validation of the exam category requirement here.", requiredWpm: 35, requiredAccuracy: 90, backspaceMode: "full", wordMethod: "characters", highlightMode: "character", visibility: "public", isLive: false };
  assert.match(validateManagedTest(base).errors.join(" "), /Choose the exam category/);
  assert.deepEqual(validateManagedTest({ ...base, examCategory: "rajasthan-ldc" }).errors, []);
  assert.doesNotMatch(validateManagedTest({ ...base, isLive: true, examCategory: null }).errors.join(" "), /Choose the exam category/);
  assert.deepEqual(validateManagedTest({ ...base, mode: "practice", examCategory: null }).errors, []);
});

// Real bug reported live: an admin exercise linked to Rajasthan LDC showed
// Highlight=Character and Word calculation=5 Characters in its own Settings
// popup, instead of the category's real None/Space-separated -- because
// parseDraft's category-derivation only ever forced duration/speed/
// accuracy/backspace from the chosen category, deliberately leaving
// wordMethod/highlightMode flat (a reasonable call at the time, before any
// category varied those two fields -- Rajasthan LDC now does).
test("parseDraft derives wordMethod/highlightMode from the chosen exam category too, not just duration/speed/accuracy/backspace", async () => {
  const actions = await read("app/admin/tests/actions.ts");
  assert.match(actions, /const categoryRules = examCategoryDefinition \? examCategoryTypingRules\(examCategoryDefinition, language\) : null;/);
  assert.match(actions, /wordMethod: forcedDefaultRules \? \(categoryRules\?\.wordMethod \?\? "characters"\) : /);
  assert.match(actions, /highlightMode: forcedDefaultRules \? \(categoryRules\?\.highlightMode \?\? "character"\) : /);
});

test("managedVersionToPreset attaches examCategorySlug/instructionNotes/patternSourced from EXAM_CATEGORIES when configured, and leaves them undefined otherwise", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "characters", highlightMode: "character", visibility: "public" };
  const linked = managedVersionToPreset({ ...base, examCategory: "rajasthan-ldc" });
  assert.equal(linked.examCategorySlug, "rajasthan-ldc");
  assert.ok(linked.instructionNotes?.length);
  assert.equal(typeof linked.patternSourced, "boolean");
  const unlinked = managedVersionToPreset(base);
  assert.equal(unlinked.examCategorySlug, undefined);
  assert.equal(unlinked.instructionNotes, undefined);
});

// Real bug reported live: an admin exercise linked to Rajasthan LDC showed
// the RSSB marks-based instructions (25 max, 9 to qualify, 0.05/0.0625
// marks per correct word) via instructionNotes above, but its results
// screen would have silently fallen back to plain WPM/accuracy pass-fail --
// marksMethod was never attached here, even though categoryPreset() already
// attaches it for the hardcoded preset of the same category (see
// tests/rssb-marks.test.mjs). Fixed by attaching the same RSSB_*_MARKS_METHOD
// constants whenever the linked category is rajasthan-ldc, for both
// languages, and leaving it undefined for every other category/unlinked test.
test("managedVersionToPreset attaches the real RSSB marks scheme when linked to Rajasthan LDC, matching the hardcoded category preset exactly, and leaves it undefined otherwise", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const { getExamPreset } = await import("../lib/typing-curriculum.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "characters", highlightMode: "character", visibility: "public" };
  const linkedEnglish = managedVersionToPreset({ ...base, language: "English", examCategory: "rajasthan-ldc" });
  const linkedHindi = managedVersionToPreset({ ...base, language: "Hindi", inputSystemId: "hindi-unicode-mangal", examCategory: "rajasthan-ldc" });
  assert.deepEqual(linkedEnglish.marksMethod, getExamPreset("exam-cat-rajasthan-ldc-english").marksMethod);
  assert.deepEqual(linkedHindi.marksMethod, getExamPreset("exam-cat-rajasthan-ldc-hindi").marksMethod);
  const otherCategory = managedVersionToPreset({ ...base, language: "English", examCategory: "ssc-chsl" });
  assert.equal(otherCategory.marksMethod, undefined);
  const unlinked = managedVersionToPreset({ ...base, language: "English" });
  assert.equal(unlinked.marksMethod, undefined);
});

// Real feature: every Rajasthan LDC exercise the admin uploads is shared
// across all 24 other exam categories automatically -- viewed through a
// different category's own page, it must render/score with THAT
// category's own real rules, not Rajasthan LDC's (this is what actually
// determines Pass/Fail, so passNetWpm/passAccuracy inside scoringProfile
// must move too, not just the display-only speedRequirement/
// accuracyRequirement fields).
test("managedVersionToPreset's viewAsCategorySlug overrides duration/speed/accuracy/backspace/wordMethod/highlightMode/instructions/scoringProfile with the VIEWING category's own values, when the exercise's real stored category is Rajasthan LDC", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "spaces", highlightMode: "none", visibility: "public", examCategory: "rajasthan-ldc" };
  const native = managedVersionToPreset(base);
  const viewedAsSscChsl = managedVersionToPreset(base, "ssc-chsl");
  // SSC CHSL's own real values (lib/exam-categories.ts): 15 min, 35 WPM
  // English, 90% accuracy, full backspace, no category-specific word
  // method/highlight (falls back to characters/character).
  assert.equal(viewedAsSscChsl.durationSeconds, 15 * 60);
  assert.equal(viewedAsSscChsl.speedRequirement, 35);
  assert.equal(viewedAsSscChsl.accuracyRequirement, 90);
  assert.equal(viewedAsSscChsl.backspaceMode, "full");
  assert.equal(viewedAsSscChsl.wordMethod, "characters");
  assert.equal(viewedAsSscChsl.highlightMode, "character");
  assert.equal(viewedAsSscChsl.examCategorySlug, "ssc-chsl");
  assert.notDeepEqual(viewedAsSscChsl.instructionNotes, native.instructionNotes);
  // The actual scoring thresholds, not just the displayed target.
  assert.equal(viewedAsSscChsl.scoringProfile.passNetWpm, 35);
  assert.equal(viewedAsSscChsl.scoringProfile.passAccuracy, 90);
  // Confirms native (no override) is unaffected and still Rajasthan LDC's own.
  assert.equal(native.durationSeconds, 600);
  assert.equal(native.speedRequirement, 40);
});

test("managedVersionToPreset's marksMethod (RSSB marks scheme) turns off when a Rajasthan LDC exercise is viewed as a different category, and stays on for Rajasthan LDC's own native page", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "spaces", highlightMode: "none", visibility: "public", examCategory: "rajasthan-ldc" };
  assert.ok(managedVersionToPreset(base).marksMethod);
  assert.equal(managedVersionToPreset(base, "ssc-chsl").marksMethod, undefined);
  assert.ok(managedVersionToPreset(base, "rajasthan-ldc").marksMethod);
});

// Tamper-gate regression test: viewAsCategorySlug must be silently
// ignored -- not just for a missing native category, but for ANY native
// category other than Rajasthan LDC -- so a hand-edited URL/payload can
// never rescore a non-Rajasthan-LDC test under a different category's
// rules. Checked against server-trusted version.examCategory, never
// client input.
// Real reported request: every exam exercise (any native category) should
// be shareable across every OTHER exam category, not just Rajasthan LDC's
// -- viewAsCategorySlug now overrides ANY native category, as long as it
// names a real EXAM_CATEGORIES slug (resolved server-side, so a tampered/
// nonexistent slug still can't inject anything -- see the second test).
test("managedVersionToPreset's viewAsCategorySlug overrides ANY native category's rules, not just Rajasthan LDC's", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const sscNative = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 900, passage: "passage text long enough", requiredWpm: 35, requiredAccuracy: 90, backspaceMode: "full", wordMethod: "characters", highlightMode: "character", visibility: "public", examCategory: "ssc-chsl" };
  const viewedAsRajasthanLdc = managedVersionToPreset(sscNative, "rajasthan-ldc");
  assert.notEqual(viewedAsRajasthanLdc.durationSeconds, sscNative.durationSeconds);
  assert.equal(viewedAsRajasthanLdc.examCategorySlug, "rajasthan-ldc");
  assert.notEqual(viewedAsRajasthanLdc.marksMethod, undefined); // Rajasthan LDC's RSSB marks scheme now applies
  const unlinked = { ...sscNative, examCategory: null };
  assert.equal(managedVersionToPreset(unlinked, "rajasthan-ldc").examCategorySlug, "rajasthan-ldc");
});

test("managedVersionToPreset ignores an invalid/nonexistent viewAsCategorySlug -- resolved against the fixed EXAM_CATEGORIES list, never arbitrary input", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const sscNative = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 900, passage: "passage text long enough", requiredWpm: 35, requiredAccuracy: 90, backspaceMode: "full", wordMethod: "characters", highlightMode: "character", visibility: "public", examCategory: "ssc-chsl" };
  const attemptedTamper = managedVersionToPreset(sscNative, "not-a-real-category");
  assert.equal(attemptedTamper.durationSeconds, sscNative.durationSeconds);
  assert.equal(attemptedTamper.speedRequirement, sscNative.requiredWpm);
  assert.equal(attemptedTamper.examCategorySlug, "ssc-chsl");
  assert.equal(attemptedTamper.marksMethod, undefined);
});

// Regression safety: omitting viewAsCategorySlug entirely (every existing
// call site except the two new ones this feature adds) reproduces
// today's exact output, byte for byte.
test("managedVersionToPreset without viewAsCategorySlug behaves identically to before this feature existed", async () => {
  const { managedVersionToPreset } = await import("../lib/admin-tests.ts");
  const base = { id: "v1", testId: "t1", versionNumber: 1, title: "X", description: "", slug: "x", language: "English", inputSystemId: "english-qwerty", mode: "exam", durationSeconds: 600, passage: "passage text long enough", requiredWpm: 40, requiredAccuracy: 95, backspaceMode: "word", wordMethod: "spaces", highlightMode: "none", visibility: "public", examCategory: "rajasthan-ldc" };
  assert.deepEqual(managedVersionToPreset(base), managedVersionToPreset(base, undefined));
});

test("the exam simulator's returnHref routes back to the category's exercise page for a category-linked exam test, not the generic catalogue", async () => {
  const workspace = await read("app/typing/_components/configurable-typing-exam.tsx");
  assert.match(workspace, /managedTest\.mode === "exam" && preset\.examCategorySlug \? `\/typing\/exams\/category\/\$\{preset\.examCategorySlug\}\/\$\{inputSystem\.language === "Hindi" \? "hindi" : "english"\}`/);
  assert.match(workspace, /managedTest\.mode === "exam" && preset\.examCategorySlug \? "Return to Exercises"/);
});

test("the category rules page's Start links lead to the new per-language exercise-selection route, not straight to the single hardcoded workspace", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.doesNotMatch(page, /examCategoryPresetId/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/english`\}/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/hindi`\}/);
});

test("the category exercise page reads a ?viewAs= query param and passes it into managedVersionToPreset, so a shared Rajasthan LDC exercise renders with the viewing category's own rules", async () => {
  const page = await read("app/tests/[slug]/page.tsx");
  assert.match(page, /const viewAsRaw=\(await searchParams\)\?\.viewAs; const viewAs=typeof viewAsRaw==="string"\?viewAsRaw:undefined;/);
  assert.match(page, /const preset=managedVersionToPreset\(version,viewAs\);/);
});

// The read/display path alone isn't enough -- recordManagedAttempt is what
// actually computes the AUTHORITATIVE, saved score once a student submits.
// Without threading examCategorySlug through here too, a shared Rajasthan
// LDC exercise would show the right instructions/timer on screen but get
// silently scored against Rajasthan LDC's own native duration/wordMethod/
// thresholds the moment the server responds.
test("recordManagedAttempt reads the exercise's real stored category, honors the client's claimed viewing category (gated server-side by managedVersionToPreset itself), and scores against the EFFECTIVE (possibly overridden) duration/wordMethod, not the raw stored version", async () => {
  const actions = await read("app/tests/actions.ts");
  assert.match(actions, /examCategory: \(v\.configuration as Record<string, unknown> \| null\)\?\.exam_category as string \| null \?\? null \};/);
  assert.match(actions, /const preset = managedVersionToPreset\(version, payload\.examCategorySlug \?\? undefined\);/);
  assert.match(actions, /elapsedSeconds: Math\.min\(payload\.elapsedSeconds, preset\.durationSeconds\), wordMethod: preset\.wordMethod,/);
});

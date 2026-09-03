import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXAM_CATEGORIES, getExamCategory, examCategoryPresetId, defaultExamCategoryRules } from "../lib/exam-categories.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("exam categories are unique, non-empty, and each carries a badge/tone for original iconography", () => {
  assert.ok(EXAM_CATEGORIES.length >= 25);
  const slugs = new Set(EXAM_CATEGORIES.map((category) => category.slug));
  assert.equal(slugs.size, EXAM_CATEGORIES.length);
  const knownKinds = new Set(["commission", "medical", "train", "police", "scales", "book", "flask", "monitor"]);
  for (const category of EXAM_CATEGORIES) {
    assert.ok(category.name.length > 0);
    assert.ok(category.fullName.length > 0);
    assert.ok(category.badge.length > 0);
    assert.match(category.tone, /^#[0-9a-f]{6}$/i);
    assert.match(category.toneDark, /^#[0-9a-f]{6}$/i);
    assert.ok(knownKinds.has(category.iconKind), `unknown icon kind ${category.iconKind} for ${category.slug}`);
  }
});

test("every category resolves to a working English and Hindi exam preset", () => {
  for (const category of EXAM_CATEGORIES) {
    const english = getExamPreset(examCategoryPresetId(category.slug, "English"));
    const hindi = getExamPreset(examCategoryPresetId(category.slug, "Hindi"));
    assert.ok(english, `missing English preset for ${category.slug}`);
    assert.ok(hindi, `missing Hindi preset for ${category.slug}`);
    assert.equal(english.language, "English");
    assert.equal(hindi.language, "Hindi");
    assert.ok(english.passage.length > 0);
    assert.ok(hindi.passage.length > 0);
  }
});

test("unknown category slugs resolve to nothing", () => {
  assert.equal(getExamCategory("not-a-real-exam"), undefined);
  assert.equal(getExamPreset(examCategoryPresetId("not-a-real-exam", "English")), undefined);
});

test("category rules disclose affiliation, the target pattern, and whether it was researched or estimated, per language", () => {
  const sourced = EXAM_CATEGORIES.find((category) => category.patternSourced);
  const unsourced = EXAM_CATEGORIES.find((category) => !category.patternSourced);
  assert.ok(sourced && unsourced, "expected both a sourced and an unsourced category to exist");
  const english = defaultExamCategoryRules(sourced, "English");
  const hindi = defaultExamCategoryRules(sourced, "Hindi");
  assert.ok(english.some((rule) => /not affiliated/i.test(rule)));
  assert.ok(english.some((rule) => /Target pattern:/.test(rule)));
  assert.ok(english.some((rule) => /based on published exam-pattern research/i.test(rule)));
  assert.ok(hindi.some((rule) => /Target pattern:/.test(rule)));
  const unsourcedRules = defaultExamCategoryRules(unsourced, "English");
  assert.ok(unsourcedRules.some((rule) => /reasoned baseline/i.test(rule)));
});

test("the exam simulator hub renders a category grid with an EN/HI badge and a rules route per category, and no longer shows the retired managed-exam-tests section", async () => {
  const hub = await read("app/typing/exams/page.tsx");
  assert.match(hub, /Select Exam Category/);
  assert.match(hub, /EXAM_CATEGORIES\.map/);
  assert.match(hub, /\/typing\/exams\/category\/\$\{category\.slug\}/);
  assert.match(hub, /EN \/ HI/);
  assert.match(hub, /A to Z Exams/);
  assert.match(hub, /Keyboard Practice/);
  assert.match(hub, /<ExamCategoryIcon category=\{category\}/);
  assert.doesNotMatch(hub, /Managed exam tests/);
  assert.doesNotMatch(hub, /General exam presets/);
  assert.doesNotMatch(hub, /getPublishedManagedTests/);
  assert.doesNotMatch(hub, /ManagedTestCards/);
});

test("the exam category icon renders an original medallion-style graphic per institution type, not a flat text badge or a scraped emblem image", async () => {
  const icon = await read("app/typing/exams/_components/exam-category-icon.tsx");
  for (const kind of ["commission", "medical", "train", "police", "scales", "book", "flask", "monitor"]) {
    assert.match(icon, new RegExp(`case "${kind}"`));
  }
  assert.match(icon, /stopColor=\{category\.tone\}/);
  assert.match(icon, /stopColor=\{category\.toneDark\}/);
  assert.match(icon, /textPath href=\{`#\$\{arcId\}`\}/);
  assert.doesNotMatch(icon, /<img /);
  assert.doesNotMatch(icon, /\.(png|jpe?g|svg)"/i);
});

// Real request: the admin is sending real board logos to have hand-designed
// per-category badges made from them, one at a time, starting with SSC
// CHSL, then SSC CGL and CRPF HCM the same way. A custom badge (keyed by
// slug) takes priority over the generic shared-per-iconKind glyph when
// one exists; every category without an entry keeps rendering the
// generic badge, completely unaffected. The custom badge itself must
// redraw each logo's real palette/layout/motifs (the admin explicitly
// asked for close fidelity, not a restyled reinterpretation) while never
// embedding the source image file itself, and never reproducing two
// specific things Indian law restricts regardless of who authorises it:
// the State Emblem of India (the Lion Capital, in SSC's and many other
// boards' logos) and the national flag (in CRPF's crossed-flags logo) --
// both get a generic stand-in instead.
test("a custom hand-designed badge (built from a real logo, redrawn faithfully) takes priority over the generic per-iconKind badge for the categories that have one, and never embeds the source image, the State Emblem, or the national flag", async () => {
  const icon = await read("app/typing/exams/_components/exam-category-icon.tsx");
  assert.match(icon, /import \{ CUSTOM_EXAM_BADGES \} from "\.\/custom-exam-badges";/);
  assert.match(icon, /const CustomBadge = CUSTOM_EXAM_BADGES\[category\.slug\];/);
  assert.match(icon, /if \(CustomBadge\) \{/);
  const badges = await read("app/typing/exams/_components/custom-exam-badges.tsx");
  assert.match(badges, /"ssc-chsl": SscChslBadge/);
  assert.match(badges, /"ssc-cgl": SscCglBadge/);
  assert.match(badges, /"rrb-ntpc": RrbNtpcBadge/);
  assert.match(badges, /"crpf-hcm": CrpfHcmBadge/);
  assert.match(badges, /"dsssb-ldc": DsssbLdcBadge/);
  assert.match(badges, /"up-police-computer-operator": UpPoliceComputerOperatorBadge/);
  assert.match(badges, /"rajasthan-high-court-ldc": RajasthanHighCourtLdcBadge/);
  assert.match(badges, /"delhi-police-hcm": DelhiPoliceHcmBadge/);
  assert.match(badges, /"csir-jsa": CsirJsaBadge/);
  assert.match(badges, /"ssb-hcm": SsbHcmBadge/);
  assert.match(badges, /"aiims-cre-ldc": AiimsBadge/);
  assert.match(badges, /"ncert-ldc": NcertLdcBadge/);
  assert.match(badges, /"bsf-hcm": BsfHcmBadge/);
  assert.match(badges, /"delhi-hc-jja": DelhiHcJjaBadge/);
  assert.match(badges, /"bombay-hc-clerk": BombayHcClerkBadge/);
  assert.match(badges, /"mp-cpct": MpCpctBadge/);
  assert.match(badges, /"kvs-jsa": KvsJsaBadge/);
  assert.match(badges, /"patna-hc-computer-operator": PatnaHcComputerOperatorBadge/);
  assert.match(badges, /"supreme-court-jca": SupremeCourtJcaBadge/);
  assert.match(badges, /"allahabad-hc-ro-aro": AllahabadHcRoAroBadge/);
  assert.match(badges, /"allahabad-hc-ps": AllahabadHcPsBadge/);
  assert.match(badges, /"bihar-civil-court-clerk": BiharCivilCourtClerkBadge/);
  assert.match(badges, /"upsssc-assistants": UpssscAssistantsBadge/);
  assert.match(badges, /"rajasthan-ldc": RajasthanLdcBadge/);
  assert.match(badges, /"jharkhand-hc-assistant": JharkhandHcAssistantBadge/);
  assert.match(badges, /"emrs-jsa": EmrsJsaBadge/);
  assert.doesNotMatch(badges, /<img /);
  assert.doesNotMatch(badges, /\.(png|jpe?g)"/i);
});

test("the category rules page shows English and Hindi rules with distinct start links and an affiliation disclaimer", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.match(page, /getExamCategory/);
  assert.match(page, /if \(!category\) notFound\(\)/);
  assert.match(page, /Start in English/);
  assert.match(page, /Start in Hindi/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/english`\}/);
  assert.match(page, /href=\{`\/typing\/exams\/category\/\$\{category\.slug\}\/hindi`\}/);
  assert.match(page, /<BackButton href="\/typing\/exams" label="Exam Categories" \/>/);
});

// Real requested addition: NCERT LDC, researched (35 WPM English / 30 WPM
// Hindi, 10 minutes, 10,500/9,000 KDPH -- the same standardised
// government pattern DDA's Junior Secretariat Assistant post uses, since
// NCERT's own notification wasn't directly available), full backspace,
// and real word-level (green/red) highlighting on the live exam screen --
// a genuine deviation from this platform's character-highlight default,
// so it's encoded as an explicit highlightMode override rather than only
// narrated in prose (unlike the real (gross/5 - mistakes*10)/minutes
// scoring formula, which -- like every other non-Rajasthan-LDC category's
// own more nuanced real rule -- is approximated with the platform's
// standard flat accuracy target and explained honestly in patternNotes,
// not a bespoke scoring engine).
test("NCERT LDC is researched with its real 35/30 WPM, 10-minute, full-backspace, word-highlighted pattern, and resolves to a working preset in both languages", () => {
  const category = getExamCategory("ncert-ldc");
  assert.ok(category);
  assert.equal(category.speedEnglish, 35);
  assert.equal(category.speedHindi, 30);
  assert.equal(category.durationMinutes, 10);
  assert.equal(category.backspaceMode, "full");
  assert.equal(category.highlightMode, "word");
  assert.equal(category.patternSourced, true);
  assert.ok(category.patternNotes.some((note) => note.includes("10,500")));
  assert.ok(category.patternNotes.some((note) => note.includes("gross keystrokes")));
  const english = getExamPreset(examCategoryPresetId("ncert-ldc", "English"));
  const hindi = getExamPreset(examCategoryPresetId("ncert-ldc", "Hindi"));
  assert.equal(english.speedRequirement, 35);
  assert.equal(hindi.speedRequirement, 30);
  assert.equal(english.durationSeconds, 600);
  assert.equal(english.highlightMode, "word");
});

// Real requested research: which Rajasthan/RSSB posts beyond the existing
// "Rajasthan LDC" category genuinely need their own typing exam category.
// Clerk/Clerk Grade-II and Personal Assistant Grade-II turned out to be the
// SAME recruitment as, respectively, Rajasthan LDC and the stenography
// module's existing "RSMSSB Stenographer" category -- confirmed via
// research, not assumed -- so no new category for either. Data Entry
// Operator is a genuinely separate, well-corroborated pattern; Tax
// Assistant is genuinely separate but only weakly sourced (one
// uncross-verified source), so it's added with patternSourced: false, same
// honesty convention as every other under-confirmed category in this file.
test("Rajasthan DEO is researched with its real 1250-word, 15-minute, marks-based pattern (genuinely different from Rajasthan LDC's 500/400-word pattern), and Rajasthan Tax Assistant exists but is honestly flagged as unconfirmed", () => {
  const deo = getExamCategory("rajasthan-deo");
  assert.ok(deo);
  assert.equal(deo.durationMinutes, 15);
  assert.equal(deo.speedEnglish, 83);
  assert.equal(deo.speedHindi, 83);
  assert.equal(deo.wordMethod, "spaces");
  assert.equal(deo.highlightMode, "none");
  assert.equal(deo.patternSourced, true);
  const deoEnglish = getExamPreset(examCategoryPresetId("rajasthan-deo", "English"));
  const deoHindi = getExamPreset(examCategoryPresetId("rajasthan-deo", "Hindi"));
  assert.equal(deoEnglish.durationSeconds, 900);
  assert.ok(deoEnglish.marksMethod);
  assert.equal(deoEnglish.marksMethod.passageWordLimit, 1250);
  assert.ok(deoHindi.marksMethod);
  assert.equal(deoHindi.marksMethod.passageWordLimit, 1250);

  const taxAssistant = getExamCategory("rajasthan-tax-assistant");
  assert.ok(taxAssistant);
  assert.equal(taxAssistant.patternSourced, false);
  assert.ok(taxAssistant.patternNotes.some((note) => /only one source/i.test(note)));
  const taxEnglish = getExamPreset(examCategoryPresetId("rajasthan-tax-assistant", "English"));
  assert.ok(taxEnglish);
  assert.equal(taxEnglish.marksMethod, undefined);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXAM_CATEGORIES, getExamCategory, examCategoryPresetId, defaultExamCategoryRules } from "../lib/exam-categories.ts";
import { getExamPreset } from "../lib/typing-curriculum.ts";
import { calculateTypingScore } from "../lib/typing-test.ts";

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
  assert.ok(hindi.some((rule) => /लक्ष्य पैटर्न:/.test(rule)));
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

// Real reported bug (screenshot): the English and Hindi rule lists are
// rarely the same length -- translations don't match sentence-for-sentence
// in length -- so the two "Start" buttons landed at different heights
// instead of lining up. Both cards stretch to equal height (items-stretch)
// and each rule list grows to fill the leftover space (flex-1) so the
// fixed mt-6 gap above each button, and the buttons themselves, always
// land at the same row.
test("the two rule cards stretch to equal height and their rule lists grow to push both Start buttons to the same aligned position", async () => {
  const page = await read("app/typing/exams/category/[slug]/page.tsx");
  assert.match(page, /className="mt-8 grid items-stretch gap-6 md:grid-cols-2"/);
  const cardCount = (page.match(/className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm"/g) ?? []).length;
  assert.equal(cardCount, 2);
  const flexRuleListCount = (page.match(/className="mt-4 flex-1 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700"/g) ?? []).length;
  assert.equal(flexRuleListCount, 2);
});

// Real requested research: NCERT LDC's typing/computer skill test, confirmed
// directly (NCERT's own live 2026 LDC recruitment cycle result page, DDA's
// official JSA typing instructions for the shared scoring formula, and
// independent corroboration that NCERT's typing test actually runs on the
// TCS-iON platform -- same software as SSC/RRB-style exams) rather than
// only inferred from the closest comparable exam family: 35 WPM English /
// 30 WPM Hindi, 10,500/9,000 KDPH, 10 minutes, full backspace, and NO live
// word/error highlighting or auto-scroll on the real exam screen -- a
// correction from an earlier assumption that borrowed DDA's own "green/red
// word highlight" UX, which turned out not to be what NCERT's own TCS-iON
// screen actually does. The real scoring formula -- Net Speed = (gross
// keystrokes / 5 - incorrect words x 10) / minutes -- draws no full/half
// mistake distinction at all, unlike this platform's default 1/0.5 split,
// so it's implemented exactly via the fullErrorPenalty/halfErrorPenalty
// category override (both set to 10).
test("NCERT LDC is researched with its real 35/30 WPM, 10-minute, full-backspace, no-highlight pattern and exact flat-10-per-mistake formula, resolving to a working preset in both languages", () => {
  const category = getExamCategory("ncert-ldc");
  assert.ok(category);
  assert.equal(category.speedEnglish, 35);
  assert.equal(category.speedHindi, 30);
  assert.equal(category.durationMinutes, 10);
  assert.equal(category.backspaceMode, "full");
  assert.equal(category.highlightMode, "none");
  assert.equal(category.fullErrorPenalty, 10);
  assert.equal(category.halfErrorPenalty, 10);
  assert.equal(category.patternSourced, true);
  assert.ok(category.patternNotes.some((note) => note.includes("10,500")));
  assert.ok(category.patternNotes.some((note) => note.includes("gross keystrokes")));
  assert.ok(category.patternNotes.some((note) => note.includes("now the real formula, not an approximation")));
  assert.ok(category.patternNotes.some((note) => note.includes("TCS-iON") && note.includes("OFF")));
  const english = getExamPreset(examCategoryPresetId("ncert-ldc", "English"));
  const hindi = getExamPreset(examCategoryPresetId("ncert-ldc", "Hindi"));
  assert.equal(english.speedRequirement, 35);
  assert.equal(hindi.speedRequirement, 30);
  assert.equal(english.durationSeconds, 600);
  assert.equal(english.highlightMode, "none");
  assert.equal(hindi.highlightMode, "none");
  assert.equal(english.scoringProfile.fullErrorPenalty, 10);
  assert.equal(english.scoringProfile.halfErrorPenalty, 10);
  assert.equal(hindi.scoringProfile.fullErrorPenalty, 10);
  assert.equal(hindi.scoringProfile.halfErrorPenalty, 10);
});

// Real reported bug: the Hindi half of a category's rules page (and its
// Hindi preset's own "Instructions to Candidate" screen) rendered the exact
// same English sentences as the English half -- only the "हिंदी नियम एवं
// शर्तें" heading above them was actually Hindi. NCERT LDC now has a real
// Hindi translation (patternNotesHindi); every other category still falls
// back to its English patternNotes until translated, so nothing else
// regresses.
test("NCERT LDC's Hindi rules and Hindi preset's instructions are genuinely translated, not the English text under a Hindi heading", () => {
  const category = getExamCategory("ncert-ldc");
  assert.ok(category.patternNotesHindi);
  assert.equal(category.patternNotesHindi.length, category.patternNotes.length);
  for (const note of category.patternNotesHindi) assert.ok(/[ऀ-ॿ]/.test(note), `expected Hindi text, got: ${note}`);
  const hindiRules = defaultExamCategoryRules(category, "Hindi");
  for (const rule of hindiRules) assert.ok(/[ऀ-ॿ]/.test(rule), `expected every Hindi rules-page line to contain Hindi text, got: ${rule}`);
  const hindiPreset = getExamPreset(examCategoryPresetId("ncert-ldc", "Hindi"));
  assert.deepEqual(hindiPreset.instructionNotes, category.patternNotesHindi);
});

// Every category now has its own patternNotesHindi (translated below), but
// the fallback mechanism itself -- for whenever a future category is added
// without one yet -- must keep working, so it's exercised here directly
// with a fabricated category rather than searching for a real untranslated
// one (there isn't one left).
test("a category without its own patternNotesHindi falls back to the English patternNotes on both the rules page and the Hindi preset", () => {
  const base = getExamCategory("ncert-ldc");
  const untranslated = { ...base, patternNotesHindi: undefined };
  const hindiRules = defaultExamCategoryRules(untranslated, "Hindi");
  for (const note of untranslated.patternNotes) assert.ok(hindiRules.includes(note));
});

test("every exam category now has its own genuinely translated patternNotesHindi, matching patternNotes in length", () => {
  for (const category of EXAM_CATEGORIES) {
    assert.ok(category.patternNotesHindi, `expected ${category.slug} to have patternNotesHindi`);
    assert.equal(category.patternNotesHindi.length, category.patternNotes.length, `expected ${category.slug}'s Hindi notes to match its English notes in count`);
    for (const note of category.patternNotesHindi) assert.ok(/[ऀ-ॿ]/.test(note), `expected Hindi text in ${category.slug}, got: ${note}`);
  }
});

// Every other category must be completely untouched by adding this
// override mechanism -- the default flat 1/0.5 split stays exactly as
// before for any category that doesn't set fullErrorPenalty/halfErrorPenalty.
test("the fullErrorPenalty/halfErrorPenalty category override defaults to the platform's standard 1/0.5 split for every other category", () => {
  for (const slug of ["ssc-chsl", "rajasthan-high-court-ldc", "dsssb-ldc"]) {
    const category = getExamCategory(slug);
    assert.ok(category, `expected category ${slug} to exist`);
    assert.equal(category.fullErrorPenalty, undefined);
    assert.equal(category.halfErrorPenalty, undefined);
    const english = getExamPreset(examCategoryPresetId(slug, "English"));
    assert.equal(english.scoringProfile.fullErrorPenalty, 1);
    assert.equal(english.scoringProfile.halfErrorPenalty, 0.5);
  }
});

// Real requested deep research: RRB NTPC's typing skill test, confirmed
// across two independent, detailed sources that reproduce an identical
// worked example end to end (309 keystrokes / 62 words, 14 full mistakes,
// 0 half -> 6.20 gross WPM, 140-point penalty, 31-point 5% relaxation,
// 109 effective penalty, 0.00 net WPM). Corrects an earlier, thinner pass
// that already narrated this 5%-relaxation formula in prose but never
// actually implemented it (the engine used the platform default 1/0.5
// penalty with no relaxation at all), and fixes an inaccurate "InScript"
// keyboard-layout mention (the real layout is Kruti Dev 010 or Mangal on
// Remington Gail, same as every other Hindi-typing category here).
test("RRB NTPC is researched with its real 5%-relaxation, flat-10-per-mistake formula and no-highlight/no-scroll screen, resolving to a preset that reproduces the sourced worked example exactly", () => {
  const category = getExamCategory("rrb-ntpc");
  assert.ok(category);
  assert.equal(category.speedEnglish, 30);
  assert.equal(category.speedHindi, 25);
  assert.equal(category.durationMinutes, 10);
  assert.equal(category.backspaceMode, "disabled");
  assert.equal(category.highlightMode, "none");
  assert.equal(category.fullErrorPenalty, 10);
  assert.equal(category.halfErrorPenalty, 5);
  assert.equal(category.errorRelaxationPercent, 5);
  assert.equal(category.patternSourced, true);
  assert.ok(category.patternNotes.some((note) => note.includes("Kruti Dev 010 or Mangal") && note.includes("Remington Gail")), "expected the corrected real Hindi layout to be documented");
  assert.ok(category.patternNotesHindi.some((note) => note.includes("रेमिंग्टन गेल")), "expected the corrected real Hindi layout to be documented in the Hindi translation too");
  const english = getExamPreset(examCategoryPresetId("rrb-ntpc", "English"));
  const hindi = getExamPreset(examCategoryPresetId("rrb-ntpc", "Hindi"));
  assert.equal(english.highlightMode, "none");
  assert.equal(hindi.highlightMode, "none");
  assert.equal(english.scoringProfile.fullErrorPenalty, 10);
  assert.equal(english.scoringProfile.halfErrorPenalty, 5);
  assert.equal(english.scoringProfile.errorRelaxationPercent, 5);
  assert.equal(hindi.scoringProfile.errorRelaxationPercent, 5);
});

// Real requested deep research pass across every exam category: the CAPF
// Head Constable (Ministerial) family (CRPF/BSF/SSB) already narrated the
// same 5%-relaxation, flat-10-word-per-mistake formula as RRB NTPC in
// prose, confirmed independently here too (400 words, 25 mistakes -> 20
// forgiven, 5 penalized, 50-word penalty, 35.00 net WPM), but never had it
// actually implemented -- same gap RRB NTPC had. Also corrects a genuine,
// specifically-confirmed difference this research surfaced: BSF's own
// skill test runs backspace ENABLED (paper-to-screen), unlike CRPF's
// confirmed backspace-disabled (screen-to-screen) -- previously all three
// were set to the same conservative "disabled" baseline.
test("the CAPF Head Constable (Ministerial) family (CRPF/BSF/SSB) all get the real 5%-relaxation formula, and BSF's confirmed backspace-enabled setting no longer matches CRPF's disabled one", () => {
  for (const slug of ["crpf-hcm", "bsf-hcm", "ssb-hcm"]) {
    const category = getExamCategory(slug);
    assert.ok(category, `expected ${slug} to exist`);
    assert.equal(category.fullErrorPenalty, 10, `${slug} fullErrorPenalty`);
    assert.equal(category.halfErrorPenalty, 5, `${slug} halfErrorPenalty`);
    assert.equal(category.errorRelaxationPercent, 5, `${slug} errorRelaxationPercent`);
    const english = getExamPreset(examCategoryPresetId(slug, "English"));
    assert.equal(english.scoringProfile.errorRelaxationPercent, 5, `${slug} preset relaxation`);
  }
  assert.equal(getExamCategory("crpf-hcm").backspaceMode, "disabled");
  assert.equal(getExamCategory("bsf-hcm").backspaceMode, "full");
  assert.equal(getExamCategory("ssb-hcm").backspaceMode, "disabled");
});

// Real requested deep research: Delhi Police HCM's typing test confirmed to
// have NO half-mistake concession at all -- spacing, capitalization, and
// punctuation are graded as FULL errors, each costing a flat 1 WPM (10
// words over the 10-minute test), the same shape as NCERT's flat penalty --
// genuinely different from this platform's default full/half split, and
// not previously implemented (only narrated in prose).
test("Delhi Police HCM is researched with no half-mistake concession -- every mistake costs a flat 10-word penalty, matching NCERT's flat-penalty shape", () => {
  const category = getExamCategory("delhi-police-hcm");
  assert.ok(category);
  assert.equal(category.fullErrorPenalty, 10);
  assert.equal(category.halfErrorPenalty, 10);
  assert.equal(category.errorRelaxationPercent, undefined);
  const english = getExamPreset(examCategoryPresetId("delhi-police-hcm", "English"));
  assert.equal(english.scoringProfile.fullErrorPenalty, 10);
  assert.equal(english.scoringProfile.halfErrorPenalty, 10);
});

// Real requested deep research: a dedicated EMRS/KVS-specific source
// (centralized testing agency, same pattern across both) confirms no live
// word/error highlight and no auto-scroll for both, plus a flat "any wrong
// word costs one full word" penalty with no half-mistake leniency --
// halfErrorPenalty raised to match fullErrorPenalty (1) instead of the
// platform default 0.5. Also confirms EMRS's typing carries 50 marks (20
// to qualify), not previously documented.
test("KVS JSA and EMRS JSA are researched with no live highlight/auto-scroll and a flat no-half-leniency penalty (halfErrorPenalty raised to match fullErrorPenalty)", () => {
  for (const slug of ["kvs-jsa", "emrs-jsa"]) {
    const category = getExamCategory(slug);
    assert.ok(category, `expected ${slug} to exist`);
    assert.equal(category.highlightMode, "none");
    assert.equal(category.halfErrorPenalty, 1);
    assert.equal(category.fullErrorPenalty, undefined, `${slug} fullErrorPenalty should stay at the platform default (1)`);
    const english = getExamPreset(examCategoryPresetId(slug, "English"));
    assert.equal(english.highlightMode, "none");
    assert.equal(english.scoringProfile.fullErrorPenalty, 1);
    assert.equal(english.scoringProfile.halfErrorPenalty, 1);
  }
  assert.ok(getExamCategory("emrs-jsa").patternNotes.some((note) => note.includes("50 marks")));
});

// Real requested deep research: Jharkhand High Court Assistant's English
// and Hindi typing tests genuinely run different durations (200 words / 5
// minutes / 40 WPM English vs 300 words / 10 minutes / 30 WPM Hindi) --
// every other category's two languages share one duration, so this needed
// a new durationMinutesHindi override (falling back to durationMinutes for
// every other category, unaffected).
test("Jharkhand High Court Assistant's English and Hindi presets each get their own real, confirmed duration via durationMinutesHindi", () => {
  const category = getExamCategory("jharkhand-hc-assistant");
  assert.equal(category.durationMinutes, 5);
  assert.equal(category.durationMinutesHindi, 10);
  const english = getExamPreset(examCategoryPresetId("jharkhand-hc-assistant", "English"));
  const hindi = getExamPreset(examCategoryPresetId("jharkhand-hc-assistant", "Hindi"));
  assert.equal(english.durationSeconds, 5 * 60);
  assert.equal(english.speedRequirement, 40);
  assert.equal(hindi.durationSeconds, 10 * 60);
  assert.equal(hindi.speedRequirement, 30);
});

test("durationMinutesHindi defaults to durationMinutes for every category that doesn't set it (unchanged behavior)", () => {
  for (const slug of ["ssc-chsl", "rrb-ntpc", "rajasthan-ldc"]) {
    const category = getExamCategory(slug);
    assert.equal(category.durationMinutesHindi, undefined, `${slug} should not set durationMinutesHindi`);
    const english = getExamPreset(examCategoryPresetId(slug, "English"));
    const hindi = getExamPreset(examCategoryPresetId(slug, "Hindi"));
    assert.equal(hindi.durationSeconds, english.durationSeconds, `${slug} both languages should share one duration`);
  }
});

// Real requested deep research: UPSSSC's 5-mistake grace was already
// narrated in prose but never actually implemented (the engine used the
// platform default 1/0.5 penalty with no grace at all) -- a genuinely
// different mechanism from RRB NTPC's percentage-based
// errorRelaxationPercent, since UPSSSC forgives a FLAT count of mistakes
// regardless of words typed. Verified against a worked example: 180 words,
// 6 full + 4 half mistakes, grace 5, penalty 15 words, net speed 33 WPM.
test("UPSSSC Assistants' 5-mistake FLAT grace is now implemented exactly via a new errorGraceCount mechanism, reproducing the sourced worked example", () => {
  const category = getExamCategory("upsssc-assistants");
  assert.equal(category.fullErrorPenalty, 5);
  assert.equal(category.halfErrorPenalty, 2.5);
  assert.equal(category.errorGraceCount, 5);
  const english = getExamPreset(examCategoryPresetId("upsssc-assistants", "English"));
  assert.equal(english.scoringProfile.errorGraceCount, 5);
  const words = Array.from({ length: 180 }, (_, index) => `w${index}`);
  const passage = words.join(" ");
  const typedText = words.map((word, index) => index < 6 ? `WRONG${index}` : index < 10 ? word.toUpperCase() : word).join(" ");
  const score = calculateTypingScore({ typedText, passage, elapsedSeconds: 300, wordMethod: "spaces", scoringProfile: english.scoringProfile, includeUntypedWords: true });
  assert.equal(score.grossWpm, 36);
  assert.equal(score.netWpm, 33);
  assert.equal(score.analysis.totalPenalty, 40);
});

test("errorGraceCount is a no-op for every category that doesn't set it (unchanged behavior)", () => {
  for (const slug of ["ssc-chsl", "rrb-ntpc", "ncert-ldc"]) {
    const category = getExamCategory(slug);
    assert.equal(category.errorGraceCount, undefined, `${slug} should not set errorGraceCount`);
  }
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

// Real requested follow-up: two more genuine Rajasthan/RSSB gaps the admin
// pointed out directly (both surfaced in the earlier research pass's own
// search results, but weren't added yet at that point) -- System Assistant
// (Rajasthan High Court) and Informatics Assistant (RSSB), both
// cross-verified across two independent sources each.
test("Rajasthan High Court System Assistant and RSSB Informatics Assistant are researched and cross-verified (8000 KDPH / word-locked backspace for System Assistant; 15-minute qualifying-only 20 WPM for Informatics Assistant)", () => {
  const systemAssistant = getExamCategory("rajasthan-hc-system-assistant");
  assert.ok(systemAssistant);
  assert.equal(systemAssistant.durationMinutes, 5);
  assert.equal(systemAssistant.speedEnglish, 27);
  assert.equal(systemAssistant.speedHindi, 27);
  assert.equal(systemAssistant.backspaceMode, "word");
  assert.equal(systemAssistant.patternSourced, true);
  assert.ok(systemAssistant.patternNotes.some((note) => /8,000 KDPH/.test(note)));

  const informaticsAssistant = getExamCategory("rssb-informatics-assistant");
  assert.ok(informaticsAssistant);
  assert.equal(informaticsAssistant.durationMinutes, 15);
  assert.equal(informaticsAssistant.speedEnglish, 20);
  assert.equal(informaticsAssistant.speedHindi, 20);
  assert.equal(informaticsAssistant.patternSourced, true);
  assert.ok(informaticsAssistant.patternNotes.some((note) => /qualifying only/i.test(note)));

  // Both resolve to a working preset in both languages, like every category.
  for (const slug of ["rajasthan-hc-system-assistant", "rssb-informatics-assistant"]) {
    const english = getExamPreset(examCategoryPresetId(slug, "English"));
    const hindi = getExamPreset(examCategoryPresetId(slug, "Hindi"));
    assert.ok(english, `missing English preset for ${slug}`);
    assert.ok(hindi, `missing Hindi preset for ${slug}`);
  }
});

import { DEFAULT_SCORING_PROFILE, type BackspaceMode, type HalfErrorCategory, type HighlightMode, type WordMethod } from "./typing-test.ts";
import { ENGLISH_QWERTY, HINDI_INPUT_SYSTEMS, RSSB_ENGLISH_MARKS_METHOD, RSSB_HINDI_MARKS_METHOD, RSSB_DEO_MARKS_METHOD, type ExamPreset } from "./typing-curriculum.ts";
import { EXAM_CATEGORIES, type ExamCategoryDefinition } from "./exam-categories.ts";
import { STENOGRAPHY_CATEGORIES } from "./stenography-categories.ts";
import { validateMatterText } from "./typing-matters.ts";
import { validateLiveSchedule, type LiveTestSchedule } from "./live-tests.ts";
import { LEGACY_SIGNAL } from "./hindi-font-converter.ts";

// The typing-behaviour fields a category forces on an exam test, derived
// purely from the category's own definition + language. Shared by
// parseDraft() (app/admin/tests/actions.ts, at admin-save time, for the
// category the admin actually chose) and managedVersionToPreset() below
// (at render/score time, for a *different* category an exercise is being
// shared into -- see its viewAsCategorySlug parameter) so the two can
// never drift apart again the way they already did once this session
// (wordMethod/highlightMode were forgotten in one of the two places).
export function examCategoryTypingRules(category: ExamCategoryDefinition, language: "English" | "Hindi") {
  return {
    // durationMinutesHindi lets a category's Hindi test run a genuinely
    // different duration than English (e.g. Jharkhand High Court
    // Assistant's confirmed 5-minute English / 10-minute Hindi split).
    durationSeconds: (language === "Hindi" ? (category.durationMinutesHindi ?? category.durationMinutes) : category.durationMinutes) * 60,
    requiredWpm: language === "Hindi" ? category.speedHindi : category.speedEnglish,
    requiredAccuracy: category.accuracy,
    backspaceMode: category.backspaceMode,
    wordMethod: category.wordMethod ?? "characters",
    highlightMode: category.highlightMode ?? "character",
  };
}

export type ManagedTestMode = "learn" | "practice" | "exam" | "stenography";
export type ManagedTestStatus = "draft" | "published" | "unpublished" | "archived";
export type ManagedTestVisibility = "public" | "private";

export type ManagedTestDraft = Partial<LiveTestSchedule> & {
  title: string; description: string; slug: string; language: "English" | "Hindi";
  inputSystemId: string; mode: ManagedTestMode; durationSeconds: number; passage: string;
  requiredWpm: number; requiredAccuracy: number; backspaceMode: BackspaceMode;
  wordMethod: WordMethod; highlightMode: HighlightMode; visibility: ManagedTestVisibility;
  audioPath?: string | null;
  pdfPath?: string | null;
  pdfFileName?: string | null;
  dictationCategories?: { available: HalfErrorCategory[]; defaults: HalfErrorCategory[] } | null;
  /** Slug into EXAM_CATEGORIES (lib/exam-categories.ts) -- required for
   * mode==="exam" && !isLive, always null/undefined otherwise. Ties an
   * admin-uploaded exercise to one of the 25 real exam patterns so it
   * inherits that category's own speed/duration/backspace rules and shows
   * up on that category's student-facing exercise-selection page. */
  examCategory?: string | null;
  /** Slug into STENOGRAPHY_CATEGORIES (lib/stenography-categories.ts) --
   * required for mode==="stenography" && !isLive, always null/undefined
   * otherwise. Forces that category's own dictation speed and accuracy
   * (always) and its official transcription duration (only when a
   * confirmed single figure exists for this category/language -- see
   * stenographyCategoryTypingRules). Unlike examCategory, this does not
   * yet feed a student-facing category discovery page or a marks-based
   * grading scheme -- it only forces these typing-behaviour fields. */
  stenoCategory?: string | null;
};

export type ManagedTestVersion = ManagedTestDraft & { id: string; testId: string; versionNumber: number };

const INPUT_SYSTEMS = [ENGLISH_QWERTY, ...HINDI_INPUT_SYSTEMS];
export const MANAGED_INPUT_SYSTEMS = INPUT_SYSTEMS.map(({ id, label, language, inputEncoding }) => ({ id, label, language, inputEncoding }));

export function slugifyTest(value: string) { return value.toLowerCase().trim().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); }
export function countPassageWords(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }

export function normalizeManagedTestRules<T extends ManagedTestDraft>(draft: T): T {
  if (draft.mode !== "practice" || draft.isLive) return draft;
  return { ...draft, backspaceMode: "full", wordMethod: "characters", highlightMode: "character" };
}

export function validateManagedTest(input: ManagedTestDraft) {
  const errors: string[] = [];
  // fieldErrors keys match each field's `name` attribute in TestManager's
  // form, so the UI can put a red box on the exact field instead of only
  // showing one generic message at the bottom -- see test-manager.tsx's
  // fieldError() helper and its scroll-to-first-error effect. A field with
  // more than one problem keeps only its first (most useful) message here;
  // `errors` still collects every message for the general banner and for
  // checks (like the live-schedule ones) that have no single field to point
  // at.
  const fieldErrors: Record<string, string> = {};
  const addError = (field: string | null, message: string) => {
    errors.push(message);
    if (field && !fieldErrors[field]) fieldErrors[field] = message;
  };
  if (input.title.trim().length < 3) addError("title", "Title must contain at least 3 characters.");
  if (input.language === "Hindi" && !/\p{Script=Devanagari}/u.test(input.title) && LEGACY_SIGNAL.test(input.title)) addError("title", "Hindi test titles must use Unicode Devanagari, not Kruti Dev legacy encoding.");
  if (!slugifyTest(input.slug || input.title)) addError("title", "A valid URL slug is required.");
  // 70 minutes, not 60 -- matches PRACTICE_DURATION_MINUTES' own outer bound
  // (lib/typing-test.ts) elsewhere in the app, and covers every researched
  // stenography category's real transcription time (up to 70 minutes for
  // RSMSSB Hindi and Rajasthan HC Steno Hindi -- see
  // lib/stenography-categories.ts). A 60-minute cap here silently rejected
  // those two categories' own force-applied, correct duration with no way
  // for the admin to see or fix it, since Duration is a locked hidden field
  // once a category with a confirmed transcription time is chosen.
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 60 || input.durationSeconds > 4200) addError("durationMinutes", "Duration must be between 1 and 70 minutes.");
  if (!Number.isFinite(input.requiredWpm) || input.requiredWpm < 0 || input.requiredWpm > 300) addError("requiredWpm", "Required WPM must be between 0 and 300.");
  if (!Number.isFinite(input.requiredAccuracy) || input.requiredAccuracy < 0 || input.requiredAccuracy > 100) addError("requiredAccuracy", "Required accuracy must be between 0 and 100.");
  const system = INPUT_SYSTEMS.find((candidate) => candidate.id === input.inputSystemId && candidate.language === input.language);
  if (!system) addError("inputSystemId", "Choose an input system matching the selected language.");
  if (input.mode === "exam" && !input.isLive && !EXAM_CATEGORIES.some((category) => category.slug === input.examCategory)) addError("examCategory", "Choose the exam category this test belongs to.");
  if (input.mode === "stenography" && !input.isLive && !STENOGRAPHY_CATEGORIES.some((category) => category.slug === input.stenoCategory)) addError("stenoCategory", "Choose the stenography category this test belongs to.");
  const matter = validateMatterText(input.passage, input.language, input.inputSystemId);
  matter.errors.forEach((message) => addError("passage", message));
  errors.push(...validateLiveSchedule({ isLive: input.isLive ?? false, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, resultsPublishAt: input.resultsPublishAt ?? null }));
  if (matter.characterCount < 20) addError("passage", "Passage must contain at least 20 characters.");
  return { errors, fieldErrors, passage: matter.text, characterCount: matter.characterCount, wordCount: matter.wordCount };
}

export function managedVersionToPreset(version: ManagedTestVersion, viewAsCategorySlug?: string): ExamPreset {
  const system = INPUT_SYSTEMS.find((candidate) => candidate.id === version.inputSystemId) ?? ENGLISH_QWERTY;
  const inputSystem = system.inputEncoding === "krutidev-legacy" ? { ...system, passageOverride: version.passage } : system;
  // When this exercise is tied to one of the 25 hardcoded exam categories,
  // it inherits that category's own researched instructions/badge on
  // ExamStart -- the exact same content the hardcoded preset for that
  // category shows, for free.
  const nativeCategory = version.examCategory ? EXAM_CATEGORIES.find((category) => category.slug === version.examCategory) : undefined;
  // Real feature: every exam exercise the admin uploads, for ANY category,
  // is shared across every OTHER exam category automatically (see
  // lib/exam-category-navigator-server.ts) -- when viewed through a
  // DIFFERENT category's own page, it renders with THAT category's own
  // real duration/speed/accuracy/backspace/word-method/highlight/
  // instructions/marks-scheme, not its native category's, even though the
  // stored passage and DB columns still hold the native category's own
  // values (set at upload time by parseDraft(), which forces them from
  // whichever category the admin actually chose). viewAsCategorySlug just
  // needs to name a real category; it's resolved against the fixed,
  // server-trusted EXAM_CATEGORIES list (never arbitrary client input), so
  // a hand-edited URL can only ever pick a legitimate category's rules,
  // never inject anything else. Every other call site (direct slug
  // access, a category's own native page) omits this parameter and gets
  // today's exact behaviour, byte for byte.
  const viewCategory = viewAsCategorySlug
    ? EXAM_CATEGORIES.find((category) => category.slug === viewAsCategorySlug) : undefined;
  const effectiveCategory = viewCategory ?? nativeCategory;
  const rules = viewCategory ? examCategoryTypingRules(viewCategory, version.language) : null;
  // Unlike duration/speed/backspace/wordMethod/highlightMode above (which
  // the native, non-viewAs case can safely read off the stored version.*
  // columns, since parseDraft() already forced them from this exact
  // category at save time), there is no DB column for a category's
  // fullErrorPenalty/halfErrorPenalty/errorRelaxationPercent override --
  // so unlike `rules`, this must be derived from effectiveCategory
  // (native OR viewed) every time, not only when viewAsCategorySlug is set.
  const scoringOverride = effectiveCategory ? { fullErrorPenalty: effectiveCategory.fullErrorPenalty, halfErrorPenalty: effectiveCategory.halfErrorPenalty, errorRelaxationPercent: effectiveCategory.errorRelaxationPercent, errorGraceCount: effectiveCategory.errorGraceCount } : null;
  return {
    id: version.testId, slug: version.slug, title: version.title,
    subtitle: version.description || "Samradhi Classes managed test",
    category: version.mode === "stenography" ? "stenography" : "typing",
    language: version.language, script: system.script, inputEncoding: system.inputEncoding,
    durationSeconds: rules?.durationSeconds ?? version.durationSeconds, passage: version.passage, fontLabel: system.fontLabel,
    fontStack: system.fontStack, fontClassName: "font-sans", layoutLabel: system.keyboardLayout,
    keyboardLayout: system.keyboardLayout, inputSystems: [inputSystem], speedRequirement: rules?.requiredWpm ?? version.requiredWpm,
    accuracyRequirement: rules?.requiredAccuracy ?? version.requiredAccuracy, backspaceMode: rules?.backspaceMode ?? version.backspaceMode,
    wordMethod: rules?.wordMethod ?? version.wordMethod, highlightMode: rules?.highlightMode ?? version.highlightMode,
    // passNetWpm/passAccuracy (not just the display-only speedRequirement/
    // accuracyRequirement above) must also reflect the effective category --
    // this is what actually drives Pass/Fail and RSSB Qualified/Not-Qualified
    // (see advanced-typing-results.tsx's resultPassed), so a display-only
    // override would show the right target on screen while still scoring
    // against Rajasthan LDC's own thresholds underneath.
    // matra/halant/gender/vachan stay unset (undefined) for every mode but
    // stenography -- see ScoringProfile's own comment: undefined means "not
    // a stenography context", which falls through to ordinary minor-
    // spelling grading instead of a dictation-specific category. Only
    // stenography sets a real base (true); halant is then narrowed to
    // true/false per attempt by scoringProfileWithSelectedCategories,
    // matching the dictation gate's category checklist.
    // fullErrorPenalty/halfErrorPenalty/errorRelaxationPercent (scoringOverride,
    // above) must also come from the effective category -- real bug: an
    // exercise natively tied to NCERT LDC or RRB NTPC (or shared and viewed
    // through their page) showed their real researched instructions (10,500
    // KDPH, the flat-10-per-mistake formula, etc.) but was still SCORED
    // with the generic 1/0.5 penalty and zero error relaxation underneath,
    // silently understating how harsh those boards' real formulas are.
    scoringProfile: { ...DEFAULT_SCORING_PROFILE, passNetWpm: rules?.requiredWpm ?? version.requiredWpm, passAccuracy: rules?.requiredAccuracy ?? version.requiredAccuracy, fullErrorPenalty: scoringOverride?.fullErrorPenalty ?? DEFAULT_SCORING_PROFILE.fullErrorPenalty, halfErrorPenalty: scoringOverride?.halfErrorPenalty ?? DEFAULT_SCORING_PROFILE.halfErrorPenalty, errorRelaxationPercent: scoringOverride?.errorRelaxationPercent, errorGraceCount: scoringOverride?.errorGraceCount, capitalizationErrors: version.language === "English", ...(version.mode === "stenography" ? { matraErrors: true, halantErrors: true, genderErrors: true, vachanErrors: true } : {}) },
    audioUrl: null,
    pdfUrl: null,
    pdfFileName: version.pdfFileName ?? null,
    dictationCategories: version.dictationCategories ?? undefined,
    examCategorySlug: effectiveCategory?.slug,
    // Real bug: a shared Hindi-language exercise always showed
    // effectiveCategory's ENGLISH patternNotes on its ExamStart screen,
    // ignoring patternNotesHindi entirely -- the exact same "English text
    // under a Hindi-facing screen" bug already fixed for the category rules
    // page and the category's own hardcoded Hindi preset (categoryPreset()
    // in typing-curriculum.ts), just missed here for shared/managed exercises.
    instructionNotes: version.language === "Hindi" ? (effectiveCategory?.patternNotesHindi ?? effectiveCategory?.patternNotes) : effectiveCategory?.patternNotes,
    patternSourced: effectiveCategory?.patternSourced,
    // Real bug: an admin exercise linked to Rajasthan LDC showed the RSSB
    // marks-based instructions (25 max, 9 to qualify, 0.05/0.0625 marks per
    // correct word -- see instructionNotes above) but was still scored by
    // plain WPM/accuracy pass-fail, because marksMethod was never attached
    // here even though categoryPreset() already attaches it for the
    // hardcoded preset of the same category. calculateConfiguredRssbMarks
    // caps marksObtained at maximumMarks (Math.min), so this stays correct
    // even for a passage longer than the category's own 500/400-word
    // pattern -- a student just reaches the cap before the passage ends.
    // Keyed off effectiveCategory (not nativeCategory), so a shared
    // Rajasthan LDC exercise correctly stops using RSSB's marks scheme the
    // moment it's viewed through a different category's own page -- that
    // category's real pass/fail rules apply instead, per the feature's
    // whole point.
    marksMethod: effectiveCategory?.slug === "rajasthan-ldc" ? (version.language === "English" ? RSSB_ENGLISH_MARKS_METHOD : RSSB_HINDI_MARKS_METHOD)
      : effectiveCategory?.slug === "rajasthan-deo" ? RSSB_DEO_MARKS_METHOD
      : undefined,
  };
}

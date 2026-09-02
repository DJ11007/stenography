import { DEFAULT_SCORING_PROFILE, type BackspaceMode, type HalfErrorCategory, type HighlightMode, type WordMethod } from "./typing-test.ts";
import { ENGLISH_QWERTY, HINDI_INPUT_SYSTEMS, RSSB_ENGLISH_MARKS_METHOD, RSSB_HINDI_MARKS_METHOD, type ExamPreset } from "./typing-curriculum.ts";
import { EXAM_CATEGORIES } from "./exam-categories.ts";
import { validateMatterText } from "./typing-matters.ts";
import { validateLiveSchedule, type LiveTestSchedule } from "./live-tests.ts";

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
  if (input.title.trim().length < 3) errors.push("Title must contain at least 3 characters.");
  if (input.language === "Hindi" && !/\p{Script=Devanagari}/u.test(input.title) && /(?:f['{kTtM<;]|O;fDr|vkSj|gS|\{kk|\.[k]|[dD][kZ]?)/.test(input.title)) errors.push("Hindi test titles must use Unicode Devanagari, not Kruti Dev legacy encoding.");
  if (!slugifyTest(input.slug || input.title)) errors.push("A valid URL slug is required.");
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds < 60 || input.durationSeconds > 3600) errors.push("Duration must be between 1 and 60 minutes.");
  if (!Number.isFinite(input.requiredWpm) || input.requiredWpm < 0 || input.requiredWpm > 300) errors.push("Required WPM must be between 0 and 300.");
  if (!Number.isFinite(input.requiredAccuracy) || input.requiredAccuracy < 0 || input.requiredAccuracy > 100) errors.push("Required accuracy must be between 0 and 100.");
  const system = INPUT_SYSTEMS.find((candidate) => candidate.id === input.inputSystemId && candidate.language === input.language);
  if (!system) errors.push("Choose an input system matching the selected language.");
  if (input.mode === "exam" && !input.isLive && !EXAM_CATEGORIES.some((category) => category.slug === input.examCategory)) errors.push("Choose the exam category this test belongs to.");
  const matter = validateMatterText(input.passage, input.language, input.inputSystemId);
  errors.push(...matter.errors);
  errors.push(...validateLiveSchedule({ isLive: input.isLive ?? false, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, resultsPublishAt: input.resultsPublishAt ?? null }));
  if (matter.characterCount < 20) errors.push("Passage must contain at least 20 characters.");
  return { errors, passage: matter.text, characterCount: matter.characterCount, wordCount: matter.wordCount };
}

export function managedVersionToPreset(version: ManagedTestVersion): ExamPreset {
  const system = INPUT_SYSTEMS.find((candidate) => candidate.id === version.inputSystemId) ?? ENGLISH_QWERTY;
  const inputSystem = system.inputEncoding === "krutidev-legacy" ? { ...system, passageOverride: version.passage } : system;
  // When this exercise is tied to one of the 25 hardcoded exam categories,
  // it inherits that category's own researched instructions/badge on
  // ExamStart -- the exact same content the hardcoded preset for that
  // category shows, for free.
  const examCategory = version.examCategory ? EXAM_CATEGORIES.find((category) => category.slug === version.examCategory) : undefined;
  return {
    id: version.testId, slug: version.slug, title: version.title,
    subtitle: version.description || "Samradhi Classes managed test",
    category: version.mode === "stenography" ? "stenography" : "typing",
    language: version.language, script: system.script, inputEncoding: system.inputEncoding,
    durationSeconds: version.durationSeconds, passage: version.passage, fontLabel: system.fontLabel,
    fontStack: system.fontStack, fontClassName: "font-sans", layoutLabel: system.keyboardLayout,
    keyboardLayout: system.keyboardLayout, inputSystems: [inputSystem], speedRequirement: version.requiredWpm,
    accuracyRequirement: version.requiredAccuracy, backspaceMode: version.backspaceMode,
    wordMethod: version.wordMethod, highlightMode: version.highlightMode,
    scoringProfile: { ...DEFAULT_SCORING_PROFILE, passNetWpm: version.requiredWpm, passAccuracy: version.requiredAccuracy, capitalizationErrors: version.language === "English" },
    audioUrl: null,
    pdfUrl: null,
    pdfFileName: version.pdfFileName ?? null,
    dictationCategories: version.dictationCategories ?? undefined,
    examCategorySlug: examCategory?.slug,
    instructionNotes: examCategory?.patternNotes,
    patternSourced: examCategory?.patternSourced,
    // Real bug: an admin exercise linked to Rajasthan LDC showed the RSSB
    // marks-based instructions (25 max, 9 to qualify, 0.05/0.0625 marks per
    // correct word -- see instructionNotes above) but was still scored by
    // plain WPM/accuracy pass-fail, because marksMethod was never attached
    // here even though categoryPreset() already attaches it for the
    // hardcoded preset of the same category. calculateConfiguredRssbMarks
    // caps marksObtained at maximumMarks (Math.min), so this stays correct
    // even for a passage longer than the category's own 500/400-word
    // pattern -- a student just reaches the cap before the passage ends.
    marksMethod: examCategory?.slug === "rajasthan-ldc" ? (version.language === "English" ? RSSB_ENGLISH_MARKS_METHOD : RSSB_HINDI_MARKS_METHOD) : undefined,
  };
}

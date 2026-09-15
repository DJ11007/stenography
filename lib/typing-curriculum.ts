import type { BackspaceMode, HalfErrorCategory, HighlightMode, ScoringProfile, WordMethod } from "./typing-test";
import { KRUTI_DEV_FONT_ASSET, type InputEncoding, type InputSystem, type TypingLanguage, type TypingScript } from "./typing-language.ts";
import { EXAM_CATEGORIES, examCategoryPresetId, type ExamCategoryDefinition } from "./exam-categories.ts";
import { STENOGRAPHY_CATEGORIES, stenographyCategoryPresetId, type StenographyCategoryDefinition } from "./stenography-categories.ts";

export type TypingLessonCategory =
  | "home-row"
  | "upper-row"
  | "lower-row"
  | "capitals"
  | "numbers"
  | "punctuation"
  | "passages";

export type TypingLesson = {
  id: string;
  order: number;
  title: string;
  shortDescription: string;
  category: TypingLessonCategory;
  targetKeys: string[];
  content: string;
  timedContent: string;
  unlockAccuracy: number;
  slug?: string;
  durationSeconds?: number;
  // The version's input_system_id -- a Hindi lesson is authored in Kruti
  // Dev 010 legacy encoding (see hindiInputSystemsFor: learn mode returns
  // [HINDI_KRUTI_DEV] only), whose bytes are Latin-1 codepoints, not
  // Devanagari. LessonWorkspace needs this to know to load and apply the
  // Kruti Dev font -- a script test on the passage text can't tell,
  // because Kruti Dev text looks like Latin to \p{Script=Devanagari}.
  inputSystemId?: string | null;
};

export type LessonProgress = {
  lessonId: string;
  completed: boolean;
  bestAccuracy: number;
  bestWpm: number;
  attempts: number;
  weakKeys: string[];
};

export type ExamPreset = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: "typing" | "stenography";
  language: TypingLanguage;
  script: TypingScript;
  inputEncoding: InputEncoding;
  durationSeconds: number;
  passage: string;
  fontLabel: string;
  fontStack: string;
  fontClassName: string;
  layoutLabel: string;
  keyboardLayout: string;
  inputSystems: InputSystem[];
  speedRequirement: number;
  accuracyRequirement: number;
  backspaceMode: BackspaceMode;
  wordMethod: WordMethod;
  highlightMode?: HighlightMode;
  /** Signed, time-limited URL for a real dictation recording. When present, the stenography
   * workspace plays this audio (with adjustable speed) instead of showing the Original Passage
   * panel; the passage text is still used for scoring exactly as before. */
  audioUrl?: string | null;
  /** Signed, time-limited URL for an admin-uploaded question-paper PDF, plus
   * its original file name for the download link's label. Distinct from the
   * Print/PDF toolbar button (which prints the typed passage text itself,
   * generated on the fly) -- this is a ready-made file the admin attached. */
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  /** Admin-configured menu for the dictation gate's pre-typing checklist:
   * which half-error categories are offered to the student at all
   * (`available`), and which start pre-checked (`defaults`, always a
   * subset of `available`). Undefined means "not configured" -- the
   * dictation gate falls back to offering every category, all on, which
   * is the same as today's behavior for every test an admin hasn't set
   * this for. */
  dictationCategories?: { available: HalfErrorCategory[]; defaults: HalfErrorCategory[] };
  /** For exam-category presets only: the board-specific typing rules researched for this
   * post (marking scheme, right/wrong-word grading, backspace policy, on-screen highlighting
   * behaviour), shown on the exam simulator's start screen. Undefined for the four base
   * presets and every stenography preset, which have no specific recruiting-authority pattern
   * to cite and keep the generic instructions instead. */
  instructionNotes?: string[];
  /** Mirrors ExamCategoryDefinition.patternSourced for the same category -- whether
   * instructionNotes above are researched from published exam-pattern guidance (true) or a
   * reasoned estimate because no confirmed official pattern was found (false). Undefined
   * alongside instructionNotes for non-category presets. */
  patternSourced?: boolean;
  /** For an admin-managed exam test tied to one of the 25 hardcoded exam categories
   * (lib/exam-categories.ts) -- the category slug, used by ConfigurableTypingExam's
   * returnHref to route "Return to Tests" back to that category's exercise-selection
   * page instead of the generic Exam Simulators catalogue. Undefined for every
   * hardcoded preset and for any admin-managed test not tied to a category. */
  examCategorySlug?: string;
  scoringProfile: ScoringProfile;
  marksMethod?: {
    id: "configured-rssb-ldc";
    maximumMarks: number;
    minimumPassingMarks: number;
    marksPerCorrectWord: number;
    requiredDurationSeconds: number;
    passageWordLimit: number;
  };
};

// Exported so a student's chosen passage-length preference can resample any
// resolved passage (hardcoded or admin-authored) client-side in
// ConfigurableTypingExam -- works generically on arbitrary text, already
// proven below on both ENGLISH_PASSAGE/HINDI_PASSAGE and an unrelated Kruti
// Dev legacy-encoded string.
export function repeatPassageToExactWordCount(passage: string, wordCount: number) {
  const sourceWords = passage.trim().split(/\s+/u);
  if (!sourceWords.length) throw new Error("A configured typing passage cannot be empty.");
  return Array.from({ length: wordCount }, (_, index) => sourceWords[index % sourceWords.length]).join(" ");
}

export const ENGLISH_QWERTY: InputSystem = { id: "english-qwerty", label: "English — QWERTY", language: "English", script: "Latin", inputEncoding: "unicode", fontLabel: "System English", fontStack: "Arial, Helvetica, sans-serif", keyboardLayout: "QWERTY keyboard" };
export const HINDI_UNICODE_MANGAL: InputSystem = { id: "hindi-unicode-mangal", label: "Mangal Unicode", language: "Hindi", script: "Devanagari", inputEncoding: "unicode", fontLabel: "Mangal / Nirmala UI", fontStack: '"Nirmala UI", Mangal, "Noto Sans Devanagari", sans-serif', keyboardLayout: "Unicode Hindi phonetic/default layout" };
export const HINDI_UNICODE_REMINGTON: InputSystem = { ...HINDI_UNICODE_MANGAL, id: "hindi-unicode-remington", label: "Hindi Unicode — Remington layout", keyboardLayout: "Remington Unicode layout" };
export const HINDI_UNICODE_REMINGTON_GAIL: InputSystem = { ...HINDI_UNICODE_MANGAL, id: "hindi-unicode-remington-gail", label: "Remington GAIL", keyboardLayout: "Remington GAIL Unicode layout" };
export const HINDI_UNICODE_REMINGTON_CBI: InputSystem = { ...HINDI_UNICODE_MANGAL, id: "hindi-unicode-remington-cbi", label: "Remington CBI", keyboardLayout: "Remington CBI Unicode layout" };
export const HINDI_UNICODE_INSCRIPT: InputSystem = { ...HINDI_UNICODE_MANGAL, id: "hindi-unicode-inscript", label: "Hindi Unicode — InScript layout", keyboardLayout: "InScript Unicode layout" };
// Shared source text for the Kruti Dev legacy-encoded passage override --
// pulled out so it can be resampled to a different word count (see
// krutiDevInputSystemForWordCount below) without duplicating the raw
// encoded string. 400 words matches the LDC/RSSB-family word count every
// category has needed until Rajasthan DEO's genuinely longer 1250-word
// passage.
const KRUTI_DEV_SOURCE_TEXT = "f'k{kk O;fDr ds thou esa egRoiw.kZ Hkwfedk fuHkkrh gSA fu;fer vH;kl ls Vkbfiax dh xfr vkSj 'kq)rk esa lq/kkj gksrk gSA";
export const HINDI_KRUTI_DEV: InputSystem = { id: "hindi-krutidev-010", label: "Kruti Dev 010 — legacy encoding", language: "Hindi", script: "Devanagari", inputEncoding: "krutidev-legacy", fontLabel: "Kruti Dev 010 (licensed asset required)", fontStack: '"Kruti Dev 010", sans-serif', keyboardLayout: "Remington / Kruti Dev legacy layout", requiredFontAsset: KRUTI_DEV_FONT_ASSET, passageOverride: repeatPassageToExactWordCount(KRUTI_DEV_SOURCE_TEXT, 400) };
export const HINDI_INPUT_SYSTEMS = [HINDI_KRUTI_DEV, HINDI_UNICODE_MANGAL, HINDI_UNICODE_REMINGTON_GAIL, HINDI_UNICODE_REMINGTON_CBI, HINDI_UNICODE_INSCRIPT, HINDI_UNICODE_REMINGTON];
// Rajasthan DEO's Hindi passage is 1250 words, not the 400 every other
// Hindi category (including Rajasthan LDC) has used -- Kruti Dev's
// passageOverride is otherwise a single fixed 400-word constant shared by
// every Hindi category, so a longer category needs its own resampled
// variant of the same source text rather than reusing HINDI_KRUTI_DEV
// as-is (which would fail preset()'s build-time word-count check).
function krutiDevInputSystemForWordCount(wordCount: number): InputSystem {
  return { ...HINDI_KRUTI_DEV, passageOverride: repeatPassageToExactWordCount(KRUTI_DEV_SOURCE_TEXT, wordCount) };
}

// At the admin's explicit request: the general Typing section (Learn Typing
// and Practice Tests) offers Kruti Dev 010 only for Hindi -- Mangal/InScript/
// Remington GAIL/CBI stay available everywhere else (Exam Simulators,
// Stenography), since those sections were deliberately left untouched.
// Confirmed against live data before this shipped: every existing Hindi
// Learn/Practice test already used Kruti Dev exclusively, so nothing was
// orphaned by narrowing this.
export function hindiInputSystemsFor(mode: "learn" | "practice" | "exam" | "stenography"): InputSystem[] {
  return mode === "learn" || mode === "practice" ? [HINDI_KRUTI_DEV] : HINDI_INPUT_SYSTEMS;
}

// Learning lessons are now created and published by administrators.
export const ENGLISH_LESSONS: TypingLesson[] = [];

const ENGLISH_PASSAGE = `Education and regular practice play an important role in success in competitive examinations. A candidate who prepares with discipline can gradually improve knowledge, confidence, typing speed, accuracy, and time management. In a typing examination, speed alone is not enough because unnecessary mistakes can reduce the final performance. Students should therefore develop correct keyboard habits and learn to type without looking at the keyboard whenever possible. Regular practice also helps students understand common spelling mistakes, punctuation, spacing, and the correct use of capital letters. A good typing practice routine should begin with accuracy and then gradually increase speed. Candidates should sit comfortably, keep their fingers in the correct position, and maintain a steady rhythm while typing. They should avoid unnecessary movement and should not become nervous when they make a mistake. Continuous practice with different passages can improve concentration and help candidates become familiar with words of different lengths. Competitive examinations often require candidates to complete a task within a fixed period. Time management therefore becomes an important part of preparation. Students should regularly take timed tests and carefully examine their results after every test. The result should not be judged only by gross speed. Accuracy, errors, correct characters, incorrect characters, and net speed are also important indicators of performance. A disciplined student can improve gradually by identifying weak areas and working on them every day. Reading newspapers, books, articles, and educational material can also improve vocabulary and familiarity with sentence structures. However, typing practice should remain consistent because speed develops through repeated and correct keyboard movement. The objective of a typing test is to measure practical typing ability under a limited time condition. Candidates should remain calm, read the passage carefully, and maintain a comfortable rhythm throughout the examination. Regular mock tests can help students understand the test environment and reduce unnecessary pressure on the examination day. With patience, consistent practice, and careful analysis of mistakes, students can steadily improve their typing performance and become better prepared for competitive examinations.`;

const HINDI_PASSAGE = `शिक्षा व्यक्ति के जीवन में महत्वपूर्ण भूमिका निभाती है। नियमित अभ्यास से विद्यार्थियों में आत्मविश्वास और कार्य करने की क्षमता बढ़ती है। प्रतियोगी परीक्षाओं की तैयारी करने वाले विद्यार्थियों के लिए सही दिशा में किया गया अभ्यास बहुत उपयोगी होता है। टाइपिंग परीक्षा में गति के साथ शुद्धता का भी विशेष महत्व है। इसलिए अभ्यर्थी को पहले सही टाइप करना सीखना चाहिए और उसके बाद धीरे धीरे अपनी गति बढ़ानी चाहिए। नियमित परीक्षण से गलतियों को समझने और उन्हें सुधारने में सहायता मिलती है।`;

const ENGLISH_STENO_PASSAGE = `The committee met in the morning to review the public service report. The chairperson requested a clear record of every recommendation, financial estimate, and deadline. Members agreed that accurate transcription is essential because even a small change can alter the meaning of an official statement.`;
const HINDI_STENO_PASSAGE = `समिति ने जनसेवा से संबंधित प्रतिवेदन पर विचार करने के लिए प्रातः बैठक की। अध्यक्ष ने प्रत्येक सुझाव, अनुमान और समय सीमा का स्पष्ट अभिलेख तैयार करने का निर्देश दिया। सदस्यों ने माना कि शुद्ध प्रतिलेखन आवश्यक है क्योंकि छोटी त्रुटि भी कथन का अर्थ बदल सकती है।`;

const profile = (speed: number, penaltyOverride?: { fullErrorPenalty?: number; halfErrorPenalty?: number; errorRelaxationPercent?: number }): ScoringProfile => ({ fullErrorPenalty: penaltyOverride?.fullErrorPenalty ?? 1, halfErrorPenalty: penaltyOverride?.halfErrorPenalty ?? 0.5, minorSpellingMaxDistance: 1, passNetWpm: speed, passAccuracy: 90, errorRelaxationPercent: penaltyOverride?.errorRelaxationPercent });
const preset = (value: Omit<ExamPreset, "script" | "inputEncoding" | "fontLabel" | "fontStack" | "fontClassName" | "layoutLabel" | "keyboardLayout">): ExamPreset => {
  const system = value.inputSystems[0];
  if (value.marksMethod) {
    const passageWords = value.passage.trim().split(/\s+/u).length;
    const overrideCounts = value.inputSystems.filter((item) => item.passageOverride).map((item) => item.passageOverride!.trim().split(/\s+/u).length);
    if (value.durationSeconds !== value.marksMethod.requiredDurationSeconds || passageWords !== value.marksMethod.passageWordLimit || overrideCounts.some((count) => count !== value.marksMethod!.passageWordLimit)) throw new Error(`Invalid ${value.id} marks-method preset configuration.`);
  }
  // matra/halant/gender/vachan only ever apply to a stenography preset --
  // see ScoringProfile's own comment for why leaving them undefined for
  // "typing" presets (instead of false) matters.
  return { ...value, scoringProfile: { ...value.scoringProfile, capitalizationErrors: value.language === "English", ...(value.category === "stenography" ? { matraErrors: true, halantErrors: true, genderErrors: true, vachanErrors: true } : {}) }, script: system.script, inputEncoding: system.inputEncoding, fontLabel: system.fontLabel, fontStack: system.fontStack, fontClassName: "font-sans", layoutLabel: system.keyboardLayout, keyboardLayout: system.keyboardLayout };
};

// Exported so an admin-managed exam test tied to the "rajasthan-ldc"
// category can carry the exact same marks scheme as the hardcoded preset
// for that category -- see managedVersionToPreset() in lib/admin-tests.ts.
export const RSSB_ENGLISH_MARKS_METHOD = { id: "configured-rssb-ldc", maximumMarks: 25, minimumPassingMarks: 9, marksPerCorrectWord: 0.05, requiredDurationSeconds: 600, passageWordLimit: 500 } as const;
export const RSSB_HINDI_MARKS_METHOD = { id: "configured-rssb-ldc", maximumMarks: 25, minimumPassingMarks: 9, marksPerCorrectWord: 0.0625, requiredDurationSeconds: 600, passageWordLimit: 400 } as const;
// Rajasthan DEO's real pattern (see lib/exam-categories.ts's "rajasthan-deo"
// patternNotes): a 1250-word passage in EACH language, 15 minutes, 25 max
// marks per language, 10.5 to qualify -- symmetric across English and
// Hindi, unlike Rajasthan LDC's differing 500/400-word split, so this is
// one shared constant rather than an English/Hindi pair.
export const RSSB_DEO_MARKS_METHOD = { id: "configured-rssb-ldc", maximumMarks: 25, minimumPassingMarks: 10.5, marksPerCorrectWord: 0.02, requiredDurationSeconds: 900, passageWordLimit: 1250 } as const;

export const EXAM_PRESETS: ExamPreset[] = [
  preset({ id: "rssb-ldc-english", slug: "english-typing", title: "English Typing", subtitle: "Independent typing practice simulation", category: "typing", language: "English", durationSeconds: 600, passage: repeatPassageToExactWordCount(ENGLISH_PASSAGE, 500), inputSystems: [ENGLISH_QWERTY], speedRequirement: 35, accuracyRequirement: 90, backspaceMode: "full", wordMethod: "characters", scoringProfile: profile(35), marksMethod: RSSB_ENGLISH_MARKS_METHOD }),
  preset({ id: "rssb-ldc-hindi", slug: "hindi-typing", title: "Hindi Typing", subtitle: "Independent Hindi typing practice simulation", category: "typing", language: "Hindi", durationSeconds: 600, passage: repeatPassageToExactWordCount(HINDI_PASSAGE, 400), inputSystems: HINDI_INPUT_SYSTEMS, speedRequirement: 30, accuracyRequirement: 90, backspaceMode: "full", wordMethod: "characters", scoringProfile: profile(30), marksMethod: RSSB_HINDI_MARKS_METHOD }),
  preset({ id: "english-stenography", slug: "english-stenography", title: "English Stenography", subtitle: "Independent stenography practice simulation", category: "stenography", language: "English", durationSeconds: 600, passage: ENGLISH_STENO_PASSAGE, inputSystems: [ENGLISH_QWERTY], speedRequirement: 80, accuracyRequirement: 90, backspaceMode: "full", wordMethod: "characters", scoringProfile: profile(80) }),
  preset({ id: "hindi-stenography", slug: "hindi-stenography", title: "Hindi Stenography", subtitle: "Independent stenography practice simulation", category: "stenography", language: "Hindi", durationSeconds: 600, passage: HINDI_STENO_PASSAGE, inputSystems: HINDI_INPUT_SYSTEMS, speedRequirement: 70, accuracyRequirement: 90, backspaceMode: "full", wordMethod: "characters", scoringProfile: profile(70) }),
];

function categoryPreset(category: ExamCategoryDefinition, language: "English" | "Hindi"): ExamPreset {
  const id = examCategoryPresetId(category.slug, language);
  const durationSeconds = category.durationMinutes * 60;
  const subtitle = `${category.fullName} (${category.patternSourced ? "researched exam pattern" : "estimated baseline — verify official pattern"})`;
  // Rajasthan LDC/RSMSSB is the one category with a genuinely confirmed,
  // exact marks scheme (25 max, 9 to qualify, 0.05/0.0625 marks per correct
  // word) -- reusing the same RSSB_*_MARKS_METHOD constants the generic
  // english-typing/hindi-typing presets already use, since this category's
  // own duration (10 min) and word-count formula already produce exactly
  // 500 English / 400 Hindi words, satisfying preset()'s build-time check.
  // Rajasthan DEO is the second category with a genuinely confirmed marks
  // scheme (see its patternNotes) -- symmetric across languages, so the
  // same constant covers both, unlike Rajasthan LDC's English/Hindi pair.
  const marksMethod = category.slug === "rajasthan-ldc" ? (language === "English" ? RSSB_ENGLISH_MARKS_METHOD : RSSB_HINDI_MARKS_METHOD)
    : category.slug === "rajasthan-deo" ? RSSB_DEO_MARKS_METHOD
    : undefined;
  if (language === "English") {
    // Rajasthan DEO's real passage is 1250 words regardless of the
    // 500-words-per-10-minutes scaling every other category uses (its own
    // 15-minute duration would otherwise only produce 750) -- required for
    // preset()'s build-time check against RSSB_DEO_MARKS_METHOD's
    // passageWordLimit to pass.
    const wordCount = category.slug === "rajasthan-deo" ? 1250 : Math.max(50, Math.round(500 * (category.durationMinutes / 10)));
    return preset({ id, slug: id, title: `${category.name} — English Typing`, subtitle, category: "typing", language: "English", durationSeconds, passage: repeatPassageToExactWordCount(ENGLISH_PASSAGE, wordCount), inputSystems: [ENGLISH_QWERTY], speedRequirement: category.speedEnglish, accuracyRequirement: category.accuracy, backspaceMode: category.backspaceMode, wordMethod: category.wordMethod ?? "characters", highlightMode: category.highlightMode, scoringProfile: profile(category.speedEnglish, { fullErrorPenalty: category.fullErrorPenalty, halfErrorPenalty: category.halfErrorPenalty, errorRelaxationPercent: category.errorRelaxationPercent }), instructionNotes: category.patternNotes, patternSourced: category.patternSourced, marksMethod });
  }
  const wordCount = category.slug === "rajasthan-deo" ? 1250 : Math.max(50, Math.round(400 * (category.durationMinutes / 10)));
  // Kruti Dev's passageOverride is otherwise a fixed 400-word constant
  // (see HINDI_KRUTI_DEV) -- Rajasthan DEO needs its own 1250-word variant
  // of the same source text, or preset()'s build-time word-count check
  // against RSSB_DEO_MARKS_METHOD.passageWordLimit fails for that one system.
  const hindiInputSystems = category.slug === "rajasthan-deo"
    ? [krutiDevInputSystemForWordCount(wordCount), HINDI_UNICODE_MANGAL, HINDI_UNICODE_REMINGTON_GAIL, HINDI_UNICODE_REMINGTON_CBI, HINDI_UNICODE_INSCRIPT, HINDI_UNICODE_REMINGTON]
    : HINDI_INPUT_SYSTEMS;
  return preset({ id, slug: id, title: `${category.name} — Hindi Typing`, subtitle, category: "typing", language: "Hindi", durationSeconds, passage: repeatPassageToExactWordCount(HINDI_PASSAGE, wordCount), inputSystems: hindiInputSystems, speedRequirement: category.speedHindi, accuracyRequirement: category.accuracy, backspaceMode: category.backspaceMode, wordMethod: category.wordMethod ?? "characters", highlightMode: category.highlightMode, scoringProfile: profile(category.speedHindi, { fullErrorPenalty: category.fullErrorPenalty, halfErrorPenalty: category.halfErrorPenalty, errorRelaxationPercent: category.errorRelaxationPercent }), instructionNotes: category.patternNotesHindi ?? category.patternNotes, patternSourced: category.patternSourced, marksMethod });
}

export const EXAM_CATEGORY_PRESETS: ExamPreset[] = EXAM_CATEGORIES.flatMap((category) => [categoryPreset(category, "English"), categoryPreset(category, "Hindi")]);

function stenographyCategoryPreset(category: StenographyCategoryDefinition, language: "English" | "Hindi"): ExamPreset {
  const id = stenographyCategoryPresetId(category.slug, language);
  const durationSeconds = category.durationMinutes * 60;
  const subtitle = `${category.fullName} (${category.patternSourced ? "researched exam pattern" : "estimated baseline — verify official pattern"})`;
  if (language === "English") {
    return preset({ id, slug: id, title: `${category.name} — English Stenography`, subtitle, category: "stenography", language: "English", durationSeconds, passage: ENGLISH_STENO_PASSAGE, inputSystems: [ENGLISH_QWERTY], speedRequirement: category.dictationSpeedEnglish, accuracyRequirement: category.accuracy, backspaceMode: "full", wordMethod: "characters", scoringProfile: profile(category.dictationSpeedEnglish) });
  }
  return preset({ id, slug: id, title: `${category.name} — Hindi Stenography`, subtitle, category: "stenography", language: "Hindi", durationSeconds, passage: HINDI_STENO_PASSAGE, inputSystems: HINDI_INPUT_SYSTEMS, speedRequirement: category.dictationSpeedHindi, accuracyRequirement: category.accuracy, backspaceMode: "full", wordMethod: "characters", scoringProfile: profile(category.dictationSpeedHindi) });
}

export const STENOGRAPHY_CATEGORY_PRESETS: ExamPreset[] = STENOGRAPHY_CATEGORIES.flatMap((category) => [stenographyCategoryPreset(category, "English"), stenographyCategoryPreset(category, "Hindi")]);

export const getExamPreset = (id: string) => EXAM_PRESETS.find((preset) => preset.id === id || preset.slug === id) ?? EXAM_CATEGORY_PRESETS.find((preset) => preset.id === id || preset.slug === id) ?? STENOGRAPHY_CATEGORY_PRESETS.find((preset) => preset.id === id || preset.slug === id);
export const getLesson = (id: string) => ENGLISH_LESSONS.find((lesson) => lesson.id === id);
export function isLessonUnlocked(lessonId: string, progress: Record<string, LessonProgress>, lessons: TypingLesson[]) {
  const lessonIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (lessonIndex <= 0) return lessonIndex === 0;
  return progress[lessons[lessonIndex - 1].id]?.completed === true;
}

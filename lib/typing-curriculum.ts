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
  /** Admin-configured menu for the dictation gate's pre-typing checklist:
   * which half-error categories are offered to the student at all
   * (`available`), and which start pre-checked (`defaults`, always a
   * subset of `available`). Undefined means "not configured" -- the
   * dictation gate falls back to offering every category, all on, which
   * is the same as today's behavior for every test an admin hasn't set
   * this for. */
  dictationCategories?: { available: HalfErrorCategory[]; defaults: HalfErrorCategory[] };
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

function repeatPassageToExactWordCount(passage: string, wordCount: number) {
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
export const HINDI_KRUTI_DEV: InputSystem = { id: "hindi-krutidev-010", label: "Kruti Dev 010 — legacy encoding", language: "Hindi", script: "Devanagari", inputEncoding: "krutidev-legacy", fontLabel: "Kruti Dev 010 (licensed asset required)", fontStack: '"Kruti Dev 010", sans-serif', keyboardLayout: "Remington / Kruti Dev legacy layout", requiredFontAsset: KRUTI_DEV_FONT_ASSET, passageOverride: repeatPassageToExactWordCount("f'k{kk O;fDr ds thou esa egRoiw.kZ Hkwfedk fuHkkrh gSA fu;fer vH;kl ls Vkbfiax dh xfr vkSj 'kq)rk esa lq/kkj gksrk gSA", 400) };
export const HINDI_INPUT_SYSTEMS = [HINDI_KRUTI_DEV, HINDI_UNICODE_MANGAL, HINDI_UNICODE_REMINGTON_GAIL, HINDI_UNICODE_REMINGTON_CBI, HINDI_UNICODE_INSCRIPT, HINDI_UNICODE_REMINGTON];

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

const profile = (speed: number): ScoringProfile => ({ fullErrorPenalty: 1, halfErrorPenalty: 0.5, minorSpellingMaxDistance: 1, passNetWpm: speed, passAccuracy: 90 });
const preset = (value: Omit<ExamPreset, "script" | "inputEncoding" | "fontLabel" | "fontStack" | "fontClassName" | "layoutLabel" | "keyboardLayout">): ExamPreset => {
  const system = value.inputSystems[0];
  if (value.marksMethod) {
    const passageWords = value.passage.trim().split(/\s+/u).length;
    const overrideCounts = value.inputSystems.filter((item) => item.passageOverride).map((item) => item.passageOverride!.trim().split(/\s+/u).length);
    if (value.durationSeconds !== value.marksMethod.requiredDurationSeconds || passageWords !== value.marksMethod.passageWordLimit || overrideCounts.some((count) => count !== value.marksMethod!.passageWordLimit)) throw new Error(`Invalid ${value.id} marks-method preset configuration.`);
  }
  return { ...value, scoringProfile: { ...value.scoringProfile, capitalizationErrors: value.language === "English" }, script: system.script, inputEncoding: system.inputEncoding, fontLabel: system.fontLabel, fontStack: system.fontStack, fontClassName: "font-sans", layoutLabel: system.keyboardLayout, keyboardLayout: system.keyboardLayout };
};

const RSSB_ENGLISH_MARKS_METHOD = { id: "configured-rssb-ldc", maximumMarks: 25, minimumPassingMarks: 9, marksPerCorrectWord: 0.05, requiredDurationSeconds: 600, passageWordLimit: 500 } as const;
const RSSB_HINDI_MARKS_METHOD = { id: "configured-rssb-ldc", maximumMarks: 25, minimumPassingMarks: 9, marksPerCorrectWord: 0.0625, requiredDurationSeconds: 600, passageWordLimit: 400 } as const;

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
  if (language === "English") {
    const wordCount = Math.max(50, Math.round(500 * (category.durationMinutes / 10)));
    return preset({ id, slug: id, title: `${category.name} — English Typing`, subtitle, category: "typing", language: "English", durationSeconds, passage: repeatPassageToExactWordCount(ENGLISH_PASSAGE, wordCount), inputSystems: [ENGLISH_QWERTY], speedRequirement: category.speedEnglish, accuracyRequirement: category.accuracy, backspaceMode: category.backspaceMode, wordMethod: "characters", scoringProfile: profile(category.speedEnglish) });
  }
  const wordCount = Math.max(50, Math.round(400 * (category.durationMinutes / 10)));
  return preset({ id, slug: id, title: `${category.name} — Hindi Typing`, subtitle, category: "typing", language: "Hindi", durationSeconds, passage: repeatPassageToExactWordCount(HINDI_PASSAGE, wordCount), inputSystems: HINDI_INPUT_SYSTEMS, speedRequirement: category.speedHindi, accuracyRequirement: category.accuracy, backspaceMode: category.backspaceMode, wordMethod: "characters", scoringProfile: profile(category.speedHindi) });
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

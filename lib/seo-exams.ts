// Public, indexable exam pages (/exams, /typing-test/[slug],
// /stenography-test/[slug]) built straight from the exam categories the
// Exam Simulator already uses -- so the SEO pages, the simulator rules and
// the practice tests can never describe a different pattern.
import { EXAM_CATEGORIES, type ExamCategoryDefinition } from "./exam-categories.ts";
import { STENOGRAPHY_CATEGORIES, type StenographyCategoryDefinition } from "./stenography-categories.ts";
import type { Faq } from "./seo.ts";

export type ExamKind = "typing" | "stenography";

export const EXAM_GROUP_ORDER = ["SSC & Central Government", "Railway", "Police & Armed Forces", "Supreme Court & High Courts", "State Government"] as const;
export type ExamGroup = (typeof EXAM_GROUP_ORDER)[number];

const STATE_PATTERN = /Rajasthan|Uttar Pradesh|\bUP\b|Delhi Subordinate|Madhya Pradesh|Bihar/;

function groupOf(category: { iconKind: string; fullName: string }): ExamGroup {
  if (category.iconKind === "scales") return "Supreme Court & High Courts";
  if (category.iconKind === "train") return "Railway";
  if (category.iconKind === "police") return "Police & Armed Forces";
  if (STATE_PATTERN.test(category.fullName)) return "State Government";
  return "SSC & Central Government";
}

/** Central or state level, as students search ("state level typing test"). */
export function levelOf(category: { fullName: string }): "Central" | "State" {
  return STATE_PATTERN.test(category.fullName) || /High Court|District Court|Subordinate Courts|Civil Court/.test(category.fullName) ? "State" : "Central";
}

export const typingExamPath = (slug: string) => `/typing-test/${slug}`;
export const stenographyExamPath = (slug: string) => `/stenography-test/${slug}`;

export type ExamSummary = { kind: ExamKind; slug: string; name: string; fullName: string; group: ExamGroup; level: "Central" | "State"; path: string; speedLabel: string };

export const TYPING_EXAMS = EXAM_CATEGORIES;
export const STENOGRAPHY_EXAMS = STENOGRAPHY_CATEGORIES;

export const ALL_EXAMS: ExamSummary[] = [
  ...EXAM_CATEGORIES.map((c) => ({ kind: "typing" as const, slug: c.slug, name: c.name, fullName: c.fullName, group: groupOf(c), level: levelOf(c), path: typingExamPath(c.slug), speedLabel: `${c.speedEnglish} WPM English · ${c.speedHindi} WPM Hindi` })),
  ...STENOGRAPHY_CATEGORIES.map((c) => ({ kind: "stenography" as const, slug: c.slug, name: c.name, fullName: c.fullName, group: groupOf(c), level: levelOf(c), path: stenographyExamPath(c.slug), speedLabel: `${c.dictationSpeedEnglish} WPM English · ${c.dictationSpeedHindi} WPM Hindi dictation` })),
];

export function examsByGroup(kind?: ExamKind) {
  const list = kind ? ALL_EXAMS.filter((exam) => exam.kind === kind) : ALL_EXAMS;
  return EXAM_GROUP_ORDER.map((group) => ({ group, exams: list.filter((exam) => exam.group === group) })).filter((entry) => entry.exams.length > 0);
}

export const relatedExams = (exam: { slug: string; kind: ExamKind; group: ExamGroup }, limit = 8) =>
  ALL_EXAMS.filter((other) => other.group === exam.group && !(other.slug === exam.slug && other.kind === exam.kind)).slice(0, limit);

export const getTypingExam = (slug: string) => EXAM_CATEGORIES.find((c) => c.slug === slug);
export const getStenographyExam = (slug: string) => STENOGRAPHY_CATEGORIES.find((c) => c.slug === slug);

export function backspaceLabel(mode: ExamCategoryDefinition["backspaceMode"]) {
  if (mode === "disabled") return "Not allowed";
  if (mode === "word") return "Only within the word being typed (locked after Space)";
  return "Allowed";
}
const backspaceLabelHindi = (mode: ExamCategoryDefinition["backspaceMode"]) =>
  mode === "disabled" ? "अनुमति नहीं है" : mode === "word" ? "केवल उसी शब्द में, जो टाइप हो रहा है (स्पेस के बाद लॉक)" : "अनुमति है";

export const accuracyLabel = (accuracy: number) => (accuracy === 0 ? "Qualifying test, no separate accuracy limit" : `${accuracy}% minimum`);

export function typingDurationLabel(c: ExamCategoryDefinition) {
  return c.durationMinutesHindi && c.durationMinutesHindi !== c.durationMinutes
    ? `${c.durationMinutes} minutes (English) · ${c.durationMinutesHindi} minutes (Hindi)`
    : `${c.durationMinutes} minutes`;
}

export function typingExamFaqs(c: ExamCategoryDefinition): Faq[] {
  const hindiMinutes = c.durationMinutesHindi ?? c.durationMinutes;
  return [
    {
      question: `What typing speed is required for the ${c.name} typing test?`,
      answer: `The ${c.fullName} typing test pattern used on SC Typing is ${c.speedEnglish} words per minute in English and ${c.speedHindi} words per minute in Hindi, ${c.accuracy === 0 ? "and it is a qualifying test with no separate accuracy limit" : `with ${c.accuracy}% minimum accuracy`}. Always confirm the speed in the current official notification.`,
    },
    {
      question: `How long is the ${c.name} typing test?`,
      answer: `The test runs for ${typingDurationLabel(c)}. The timer on the SC Typing practice test starts with your first keystroke.`,
    },
    {
      question: `Is backspace allowed in the ${c.name} typing test?`,
      answer: `Backspace: ${backspaceLabel(c.backspaceMode).toLowerCase()}. The ${c.name} practice test on sctyping.com applies the same backspace rule so you practise exactly as in the exam.`,
    },
    {
      question: `Where can I practise the ${c.name} typing test online?`,
      answer: `Samradhi Classes (SC Typing) has an exam-pattern ${c.name} typing test in English and Hindi at sctyping.com. Create a free account to start, with speed, accuracy and mistake analysis after every attempt.`,
    },
    {
      question: `${c.name} टाइपिंग टेस्ट में कितनी स्पीड चाहिए?`,
      answer: `${c.name} टाइपिंग टेस्ट के लिए अंग्रेज़ी में ${c.speedEnglish} शब्द प्रति मिनट और हिंदी में ${c.speedHindi} शब्द प्रति मिनट की स्पीड, ${hindiMinutes} मिनट (हिंदी) का समय, बैकस्पेस ${backspaceLabelHindi(c.backspaceMode)}। इसका अभ्यास sctyping.com पर करें।`,
    },
  ];
}

export function stenographyTranscriptionLabel(c: StenographyCategoryDefinition) {
  if (c.writingMinutesEnglish && c.writingMinutesHindi) return c.writingMinutesEnglish === c.writingMinutesHindi ? `${c.writingMinutesEnglish} minutes` : `${c.writingMinutesEnglish} minutes (English) · ${c.writingMinutesHindi} minutes (Hindi)`;
  if (c.writingMinutesEnglish) return `${c.writingMinutesEnglish} minutes (English)`;
  return "As per the official notification";
}

export function stenographyExamFaqs(c: StenographyCategoryDefinition): Faq[] {
  return [
    {
      question: `What is the dictation speed for the ${c.name} skill test?`,
      answer: `The ${c.fullName} skill test pattern used on SC Typing is dictation at ${c.dictationSpeedEnglish} words per minute in English and ${c.dictationSpeedHindi} words per minute in Hindi for ${c.durationMinutes} minutes, with ${c.accuracy}% minimum accuracy in transcription. Always confirm in the current official notification.`,
    },
    {
      question: `How much time is given for transcription in the ${c.name} exam?`,
      answer: `Transcription time: ${stenographyTranscriptionLabel(c).toLowerCase()}.`,
    },
    {
      question: `Where can I practise ${c.name} dictation and transcription online?`,
      answer: `Samradhi Classes (SC Typing) has exam-pattern ${c.name} stenography practice in English and Hindi at sctyping.com, with transcription checked for speed, accuracy and mistakes.`,
    },
    {
      question: `${c.name} स्टेनो स्किल टेस्ट में डिक्टेशन की स्पीड कितनी होती है?`,
      answer: `${c.name} में अंग्रेज़ी डिक्टेशन ${c.dictationSpeedEnglish} शब्द प्रति मिनट और हिंदी डिक्टेशन ${c.dictationSpeedHindi} शब्द प्रति मिनट, ${c.durationMinutes} मिनट तक, न्यूनतम ${c.accuracy}% सटीकता। इसका अभ्यास sctyping.com पर करें।`,
    },
  ];
}

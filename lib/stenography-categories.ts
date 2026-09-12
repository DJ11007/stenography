import type { ExamCategoryIconKind } from "./exam-categories.ts";

export type StenographyCategoryDefinition = {
  slug: string;
  name: string;
  fullName: string;
  badge: string;
  tone: string;
  toneDark: string;
  iconKind: ExamCategoryIconKind;
  /** Researched (or reasonably estimated) real dictation pattern. Not an exact official copy —
   * a close approximation to make the simulation realistic. See `patternSourced`. */
  dictationSpeedEnglish: number;
  dictationSpeedHindi: number;
  durationMinutes: number;
  /** Real transcription/typing time in minutes, ONLY when a specific single official figure was
   * confirmed for this exact post's English/Hindi paper -- left undefined when nothing more
   * precise than a range was found (e.g. Delhi HC's "50-65 minutes"), or nothing at all. An
   * admin-created test tied to this category (via stenoCategoryTypingRules below) locks its
   * Duration field to this number when present; when absent, Duration stays admin-editable with
   * a warning shown instead, rather than silently guessing a number this codebase can't back up. */
  writingMinutesEnglish?: number;
  writingMinutesHindi?: number;
  accuracy: number;
  /** true = based on a specific recruiting authority's published pattern found during research;
   * false = no confirmed pattern found for this exact post, using a reasoned baseline from the
   * closest comparable exam family. Either way, always verify against the current notification. */
  patternSourced: boolean;
  patternNotes: string[];
};

const TONE_PALETTE: Array<[string, string]> = [
  ["#e11d48", "#9f1239"], ["#ea580c", "#9a3412"], ["#d97706", "#92400e"], ["#65a30d", "#3f6212"],
  ["#059669", "#065f46"], ["#0d9488", "#115e59"], ["#0891b2", "#155e75"], ["#2563eb", "#1e40af"],
  ["#4f46e5", "#3730a3"], ["#7c3aed", "#5b21b6"], ["#c026d3", "#86198f"], ["#db2777", "#9d174d"],
];

const RAW_CATEGORIES: Array<Omit<StenographyCategoryDefinition, "tone" | "toneDark">> = [
  { slug: "ssc-steno-cd", name: "SSC Steno C&D", badge: "SSC", fullName: "Staff Selection Commission — Stenographer Grade 'C' & 'D'", iconKind: "commission",
    dictationSpeedEnglish: 80, dictationSpeedHindi: 80, durationMinutes: 10, writingMinutesEnglish: 50, writingMinutesHindi: 65, accuracy: 90, patternSourced: true,
    patternNotes: ["Grade 'D' dictates at 80 WPM with 50 minutes (English) or 65 minutes (Hindi) to transcribe on computer, up to 10% errors allowed.", "Grade 'C' dictates at 100 WPM with 40 minutes (English) or 55 minutes (Hindi) to transcribe, up to 7% errors allowed.", "This simulation uses the Grade 'D' baseline (80 WPM)."] },
  { slug: "supreme-court-pa", name: "Supreme Court PA", badge: "SC", fullName: "Supreme Court of India — Personal Assistant", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, writingMinutesEnglish: 45, writingMinutesHindi: 45, accuracy: 95, patternSourced: true,
    patternNotes: ["Transcription time is 45 minutes with up to 5% errors permitted.", "A separate Typing Speed Test requires 40 WPM at 97%+ accuracy in 10 minutes.", "Senior PA posts require a higher 110 WPM dictation."] },
  { slug: "delhi-hc-steno", name: "Delhi High Court Steno", badge: "DHC", fullName: "Delhi High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: true,
    patternNotes: ["Depending on the specific post (Stenographer Grade III / PA / Senior PA), real dictation ranges from 80 to 110 WPM.", "Transcription typically takes 50–65 minutes on computer -- too wide a range to lock a single figure here.", "Verify the exact grade and speed against the current Delhi High Court notification."] },
  { slug: "allahabad-hc-steno", name: "Allahabad High Court Steno", badge: "AHC", fullName: "Allahabad High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern (Delhi/Rajasthan HC).", "Verify against the latest Allahabad High Court notification."] },
  { slug: "punjab-haryana-hc-steno", name: "Punjab & Haryana HC Steno", badge: "PHHC", fullName: "Punjab & Haryana High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Punjab & Haryana High Court notification."] },
  { slug: "rajasthan-hc-steno", name: "Rajasthan High Court Steno", badge: "RHC", fullName: "Rajasthan High Court — Stenographer", iconKind: "scales",
    // Corrected after visiting hcraj.nic.in directly and reading the actual
    // notification PDFs (not third-party coaching sites). The previous
    // 80/70 WPM, 6-min dictation, 50-min transcription figures turned out to
    // belong to a DIFFERENT post -- "Stenographer for District Courts and
    // DLSAs" (a subordinate-court post the High Court also administers; see
    // the separate rajasthan-district-court-steno category, which is the
    // correct home for that pattern). The Rajasthan High Court's OWN direct-
    // recruitment stenographer-equivalent post is "Junior Personal
    // Assistant" (JPA) -- confirmed from the actual Scheme of Examination
    // tables in the JPA (English) 2023 and JPA (Hindi) 2024 advertisements
    // (hcraj.nic.in > Recruitment), which is what these figures now reflect.
    // English and Hindi have genuinely different schemes: English is a
    // single 50-mark Shorthand Test; Hindi adds a separate two-part
    // Computer Speed & Efficiency Test on top of a 100-mark Shorthand Test.
    dictationSpeedEnglish: 90, dictationSpeedHindi: 70, durationMinutes: 8, writingMinutesEnglish: 60, writingMinutesHindi: 70, accuracy: 95, patternSourced: true,
    patternNotes: ["This is the Junior Personal Assistant (JPA) post -- Rajasthan High Court's own direct-recruitment stenographer-equivalent role, distinct from the separate Stenographer post for District Courts and DLSAs.", "After an unscored 200-250 word trial passage, the real dictation runs 8 minutes for both languages, followed by 5 minutes reading time. Transcription on computer is then 60 minutes for English (50 marks) or 70 minutes for Hindi (100 marks) -- English and Hindi are separately advertised posts with different schemes, not just different speeds.", "Marks = (correct words x max marks) / total dictated words. Up to 5% mistakes are free; excess beyond that is deducted from the correct-word count. Omissions, substitutions, and misspellings count as full mistakes; punctuation/capitalization/paragraph indentation count as half.", "Hindi JPA (2024 scheme) adds a separate two-part Computer Speed & Efficiency Test: a 10-minute, 50-mark Speed Test requiring 8000 key depressions per hour (roughly 25-27 WPM) in Kruti Dev 010, and a 10-minute, 50-mark word-processing Efficiency Test -- both scored, minimum qualifying 22.5/50 (20/50 for SC/ST/PwD/Ex-Servicemen). The 2023 English JPA scheme had no equivalent computer-test stage.", "Hindi transcription font is Kruti Dev 010; English uses Calibri.", "Ties in merit are broken by age -- the older candidate ranks higher."] },
  { slug: "patna-hc-steno", name: "Patna High Court Steno", badge: "PHC", fullName: "Patna High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Patna High Court notification."] },
  { slug: "bombay-hc-steno", name: "Bombay High Court Steno", badge: "BHC", fullName: "Bombay High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["The real exam tests English and Marathi, not Hindi — Hindi is used here only as the closest supported regional-language option.", "No separately confirmed dictation-speed pattern found; modelled on the common High Court stenographer pattern."] },
  { slug: "calcutta-hc-steno", name: "Calcutta High Court Steno", badge: "CHC", fullName: "Calcutta High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Calcutta High Court notification."] },
  { slug: "central-secretariat-steno", name: "Central Secretariat Steno", badge: "CSSS", fullName: "Central Secretariat Stenographer Service", iconKind: "commission",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, writingMinutesEnglish: 40, writingMinutesHindi: 55, accuracy: 93, patternSourced: true,
    patternNotes: ["Recruited via the SSC Stenographer Grade 'C' exam: 40 minutes (English) or 55 minutes (Hindi) to transcribe, up to 7% errors allowed."] },
  { slug: "income-tax-steno", name: "Income Tax Dept. Steno", badge: "IT", fullName: "Income Tax Department — Stenographer", iconKind: "commission",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common SSC/departmental stenographer pattern."] },
  { slug: "cbi-steno", name: "CBI Steno", badge: "CBI", fullName: "Central Bureau of Investigation — Stenographer", iconKind: "police",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common SSC/departmental stenographer pattern."] },
  { slug: "parliament-reporter", name: "Parliament Reporter", badge: "PARL", fullName: "Lok Sabha / Rajya Sabha Secretariat — Reporter / Stenographer", iconKind: "book",
    dictationSpeedEnglish: 160, dictationSpeedHindi: 160, durationMinutes: 10, accuracy: 95, patternSourced: true,
    patternNotes: ["Parliamentary Reporter (a distinct, senior post from the administrative Stenographer Grade C/D roles) is recruited at a shorthand speed of 160 WPM in English or Hindi.", "This is a materially higher bar than any other post on this list -- treat it as an advanced-speed simulation, not a starting point.", "Verify the exact figure and transcription time against the current Lok Sabha/Rajya Sabha Secretariat recruitment notification, as these change between cycles."] },
  { slug: "rbi-steno", name: "RBI Steno/PA", badge: "RBI", fullName: "Reserve Bank of India — Stenographer / Personal Assistant", iconKind: "commission",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common SSC/departmental stenographer pattern."] },
  { slug: "rsmssb-steno", name: "RSMSSB Stenographer", badge: "RSMSSB", fullName: "Rajasthan Subordinate & Ministerial Services Selection Board — Stenographer", iconKind: "commission",
    // Corrected against the 2024/2025 RSMSSB Stenographer & PA recruitment
    // cycle (Adda247's admit-card page and Oliveboard's syllabus page
    // independently agree on the same duration breakdown: 10 min dictation +
    // 60 min transcription for English, 10 min dictation + 70 min for Hindi,
    // 100 marks each) -- the previous 80/60 WPM figures and "separate 40/35
    // WPM typing test at 95%" note here did not match any source and looked
    // conflated with a different exam.
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, writingMinutesEnglish: 60, writingMinutesHindi: 70, accuracy: 80, patternSourced: true,
    patternNotes: ["Audio is played once with no replay. Transcription is then typed on computer: 60 minutes for the English paper, 70 minutes for the Hindi paper -- 100 marks each, 0.1 marks per correctly transcribed word.", "Candidates are disqualified if errors exceed 20% (the 80% minimum accuracy above); SC/ST candidates get a 5% relaxation.", "The transcription screen uses the Calibri font for English and DevLys 010 for Hindi.", "There is no separate lower-speed typing-test stage -- dictation and transcription are one combined paper per language."] },
  { slug: "rajasthan-district-court-steno", name: "Rajasthan District Court Steno", badge: "DIST", fullName: "Rajasthan Subordinate Courts — Stenographer", iconKind: "scales",
    // Sourced directly from hcraj.nic.in's actual "Joint Recruitment to the
    // post of Stenographer for District Courts and DLSAs" advertisement
    // (Scheme & Syllabus of Examination, Groups A/B/C) -- this is the
    // pattern that was previously (mis)coded under rajasthan-hc-steno; that
    // category now correctly reflects the High Court's OWN "Junior Personal
    // Assistant" post instead, which has a different scheme entirely.
    dictationSpeedEnglish: 80, dictationSpeedHindi: 70, durationMinutes: 6, writingMinutesEnglish: 50, writingMinutesHindi: 50, accuracy: 95, patternSourced: true,
    patternNotes: ["After an unscored 200-250 word trial passage, the real dictation runs 6 minutes for both languages, followed by 5 minutes reading time and 50 minutes computer transcription -- 100 marks per language (Group A English / Group B Hindi).", "Marks = (correct words x 100) / total dictated words. Up to 5% mistakes are free; excess beyond that is deducted from the correct-word count. Omissions, substitutions, and misspellings count as full mistakes; punctuation/capitalization count as half.", "Group C: a separate two-part Computer Test follows -- a 10-minute, 50-mark Speed Test requiring 8000 key depressions per hour (roughly 25-27 WPM), and a 10-minute, 50-mark word-processing Efficiency Test -- both scored, minimum qualifying 22.5/50 (20/50 for SC/ST/PwBD).", "Hindi transcription font is Kruti Dev 010; English uses Calibri.", "An Interview follows (unscored -- solely to confirm the candidate isn't so severely affected by stammering that they cannot read back their own shorthand notes)."] },
  { slug: "dsssb-steno", name: "DSSSB Stenographer", badge: "DSSSB", fullName: "Delhi Subordinate Services Selection Board — Stenographer", iconKind: "commission",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common Delhi-administrative stenographer pattern."] },
  { slug: "epfo-steno", name: "EPFO Stenographer", badge: "EPFO", fullName: "Employees' Provident Fund Organisation — Stenographer", iconKind: "commission",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common SSC/departmental stenographer pattern."] },
  { slug: "ib-steno", name: "Intelligence Bureau Steno", badge: "IB", fullName: "Intelligence Bureau — Stenographer", iconKind: "police",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common SSC/departmental stenographer pattern."] },
  { slug: "gujarat-hc-steno", name: "Gujarat High Court Steno", badge: "GHC", fullName: "Gujarat High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Gujarat High Court notification."] },
  { slug: "mp-hc-steno", name: "MP High Court Steno", badge: "MPHC", fullName: "Madhya Pradesh High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Madhya Pradesh High Court notification."] },
  { slug: "karnataka-hc-steno", name: "Karnataka High Court Steno", badge: "KHC", fullName: "Karnataka High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Karnataka High Court notification."] },
  { slug: "jharkhand-hc-steno", name: "Jharkhand High Court Steno", badge: "JHC", fullName: "Jharkhand High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Jharkhand High Court notification."] },
];

export const STENOGRAPHY_CATEGORIES: StenographyCategoryDefinition[] = RAW_CATEGORIES.map((category, index) => ({
  ...category,
  tone: TONE_PALETTE[index % TONE_PALETTE.length][0],
  toneDark: TONE_PALETTE[index % TONE_PALETTE.length][1],
}));

export function getStenographyCategory(slug: string) {
  return STENOGRAPHY_CATEGORIES.find((category) => category.slug === slug);
}

export function stenographyCategoryPresetId(slug: string, language: "English" | "Hindi") {
  return `steno-cat-${slug}-${language.toLowerCase()}`;
}

// The typing-behaviour fields a category forces on an admin-created
// Stenography test, derived purely from the category's own definition +
// language -- mirrors examCategoryTypingRules() in lib/admin-tests.ts.
// durationSeconds is null when no confirmed single transcription-time
// figure exists for this category/language (see writingMinutesEnglish/Hindi
// above): the caller must then leave Duration admin-editable rather than
// forcing a number this codebase can't back up.
export function stenographyCategoryTypingRules(category: StenographyCategoryDefinition, language: "English" | "Hindi") {
  const writingMinutes = language === "Hindi" ? category.writingMinutesHindi : category.writingMinutesEnglish;
  return {
    durationSeconds: writingMinutes != null ? writingMinutes * 60 : null,
    requiredWpm: language === "Hindi" ? category.dictationSpeedHindi : category.dictationSpeedEnglish,
    requiredAccuracy: category.accuracy,
  };
}

export function defaultStenographyCategoryRules(category: StenographyCategoryDefinition, language: "English" | "Hindi"): string[] {
  const speed = language === "English" ? category.dictationSpeedEnglish : category.dictationSpeedHindi;
  return [
    `This is an independent practice simulation for the ${category.fullName} stenography test, created by Samradhi Classes. It is not affiliated with, endorsed by, or an official product of the concerned recruitment or examination authority.`,
    `Target pattern: ${speed} WPM dictation in ${language}, ${category.accuracy}% minimum accuracy.`,
    category.patternSourced
      ? "These figures are based on published exam-pattern research for this post. Government exam patterns change between recruitment cycles — always cross-check against the current official notification before your real exam."
      : "No confirmed official pattern was found for this exact post; the figures above are a reasoned baseline from the closest comparable exam family, not a verified official pattern. Please tell us the real pattern if you have the official notification, and we will update it.",
    ...category.patternNotes,
    `This simulation currently practises transcription speed and accuracy from a printed passage in ${language}. Audio dictation delivery is not yet configured for this category — an administrator can attach a real dictation recording from the admin test manager.`,
    "The timer starts on your first keystroke, not when the page loads.",
    "Full-screen mode is available from the toolbar for a distraction-free, exam-like environment, with a dedicated button to exit full screen.",
  ];
}

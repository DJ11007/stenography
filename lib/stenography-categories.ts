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
    dictationSpeedEnglish: 80, dictationSpeedHindi: 80, durationMinutes: 10, accuracy: 90, patternSourced: true,
    patternNotes: ["Grade 'D' dictates at 80 WPM with 50 minutes (English) or 65 minutes (Hindi) to transcribe on computer, up to 10% errors allowed.", "Grade 'C' dictates at 100 WPM with 40 minutes (English) or 55 minutes (Hindi) to transcribe, up to 7% errors allowed.", "This simulation uses the Grade 'D' baseline (80 WPM)."] },
  { slug: "supreme-court-pa", name: "Supreme Court PA", badge: "SC", fullName: "Supreme Court of India — Personal Assistant", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 95, patternSourced: true,
    patternNotes: ["Transcription time is 45 minutes with up to 5% errors permitted.", "A separate Typing Speed Test requires 40 WPM at 97%+ accuracy in 10 minutes.", "Senior PA posts require a higher 110 WPM dictation."] },
  { slug: "delhi-hc-steno", name: "Delhi High Court Steno", badge: "DHC", fullName: "Delhi High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: true,
    patternNotes: ["Depending on the specific post (Stenographer Grade III / PA / Senior PA), real dictation ranges from 80 to 110 WPM.", "Transcription typically takes 50–65 minutes on computer.", "Verify the exact grade and speed against the current Delhi High Court notification."] },
  { slug: "allahabad-hc-steno", name: "Allahabad High Court Steno", badge: "AHC", fullName: "Allahabad High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern (Delhi/Rajasthan HC).", "Verify against the latest Allahabad High Court notification."] },
  { slug: "punjab-haryana-hc-steno", name: "Punjab & Haryana HC Steno", badge: "PHHC", fullName: "Punjab & Haryana High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the common High Court stenographer pattern.", "Verify against the latest Punjab & Haryana High Court notification."] },
  { slug: "rajasthan-hc-steno", name: "Rajasthan High Court Steno", badge: "RHC", fullName: "Rajasthan High Court — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 80, dictationSpeedHindi: 70, durationMinutes: 6, accuracy: 90, patternSourced: true,
    patternNotes: ["The real dictation is only 6 minutes (after a short, unscored 200–250 word trial passage), followed by 5 minutes reading time and 50 minutes computer transcription.", "A separate Computer Speed/Efficiency Test requires 8000 key depressions per hour.", "Hindi transcription font is Kruti Dev 010; English uses Calibri."] },
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
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 93, patternSourced: true,
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
    dictationSpeedEnglish: 100, dictationSpeedHindi: 100, durationMinutes: 10, accuracy: 80, patternSourced: true,
    patternNotes: ["Audio is played once with no replay. Transcription is then typed on computer: 60 minutes for the English paper, 70 minutes for the Hindi paper -- 100 marks each, 0.1 marks per correctly transcribed word.", "Candidates are disqualified if errors exceed 20% (the 80% minimum accuracy above); SC/ST candidates get a 5% relaxation.", "The transcription screen uses the Calibri font for English and DevLys 010 for Hindi.", "There is no separate lower-speed typing-test stage -- dictation and transcription are one combined paper per language."] },
  { slug: "rajasthan-district-court-steno", name: "Rajasthan District Court Steno", badge: "DIST", fullName: "Rajasthan Subordinate Courts — Stenographer", iconKind: "scales",
    dictationSpeedEnglish: 80, dictationSpeedHindi: 70, durationMinutes: 10, accuracy: 90, patternSourced: false,
    patternNotes: ["No separately confirmed pattern found; modelled on the Rajasthan High Court stenographer pattern.", "Verify against the specific District Court recruitment notification."] },
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

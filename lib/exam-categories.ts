export type ExamCategoryIconKind = "commission" | "medical" | "train" | "police" | "scales" | "book" | "flask" | "monitor";

export type ExamCategoryDefinition = {
  slug: string;
  name: string;
  fullName: string;
  badge: string;
  tone: string;
  toneDark: string;
  iconKind: ExamCategoryIconKind;
  /** Researched (or reasonably estimated) real exam pattern. Not exact official copies — a
   * close approximation to make the simulation realistic. See `patternSourced`. */
  speedEnglish: number;
  speedHindi: number;
  durationMinutes: number;
  accuracy: number;
  backspaceMode: "full" | "disabled";
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

const RAW_CATEGORIES: Array<Omit<ExamCategoryDefinition, "tone" | "toneDark">> = [
  { slug: "ssc-chsl", name: "SSC CHSL", badge: "CHSL", fullName: "Staff Selection Commission — Combined Higher Secondary Level", iconKind: "commission",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Test duration is 15 minutes (20 minutes for candidates eligible for a scribe).", "The typing/DEST test itself carries no marks toward the final score, but failing it disqualifies the candidate regardless of other marks."] },
  { slug: "ssc-cgl", name: "SSC CGL", badge: "CGL", fullName: "Staff Selection Commission — Combined Graduate Level", iconKind: "commission",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["The DEST is historically measured as about 2000 key depressions in 15 minutes (roughly 27–33 WPM); this simulation uses the standard SSC 35/30 WPM baseline.", "Qualifying only — it does not add to the final score."] },
  { slug: "aiims-cre-ldc", name: "AIIMS CRE LDC", badge: "AIIMS", fullName: "All India Institute of Medical Sciences — Common Recruitment Exam, Lower Division Clerk", iconKind: "medical",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Test duration is 15 minutes.", "Backspace is allowed. Qualifying only."] },
  { slug: "rrb-ntpc", name: "RRB NTPC", badge: "NTPC", fullName: "Railway Recruitment Board — Non-Technical Popular Categories", iconKind: "train",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["A 5% error margin is allowed; beyond that, each mistake is penalised as 10 words.", "Backspace is not permitted in the real exam. Hindi uses the InScript or Remington Gail layout."] },
  { slug: "crpf-hcm", name: "CRPF HCM", badge: "CRPF", fullName: "Central Reserve Police Force — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["The same standard applies across CRPF, BSF, CISF, ITBP, and SSB Head Constable (Ministerial) posts.", "A 5% error margin is allowed; beyond that, each mistake is penalised as 10 words. Paper-to-screen format on centre-provided computers only."] },
  { slug: "dsssb-ldc", name: "DSSSB LDC", badge: "DSSSB", fullName: "Delhi Subordinate Services Selection Board — Lower Division Clerk", iconKind: "commission",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Screen-to-screen mode — the passage is shown on screen, not printed on paper.", "Backspace is generally permitted, but typed text is not highlighted as you go."] },
  { slug: "up-police-computer-operator", name: "UP Police Computer Operator", badge: "UPP", fullName: "Uttar Pradesh Police — Computer Operator", iconKind: "police",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No confirmed pattern found for this exact post; using the common UP-state typing-test baseline as a starting point.", "Verify against the latest UP Police recruitment notification."] },
  { slug: "rajasthan-high-court-ldc", name: "Rajasthan High Court LDC", badge: "RHC", fullName: "Rajasthan High Court — Lower Division Clerk", iconKind: "scales",
    speedEnglish: 40, speedHindi: 35, durationMinutes: 10, accuracy: 95, backspaceMode: "full", patternSourced: false,
    patternNotes: ["Modelled on the Rajasthan LDC/Stenographer typing benchmark of 40 WPM English / 35 WPM Hindi at 95% accuracy.", "Verify against the specific Rajasthan High Court LDC notification."] },
  { slug: "delhi-police-hcm", name: "Delhi Police HCM", badge: "DP", fullName: "Delhi Police — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["The real passage is at least 400 words (2000 strokes) in English or 350 words (1750 strokes) in Hindi.", "Every error reduces the final speed by 1 WPM — there is no partial-mistake concession. Paper-to-screen format."] },
  { slug: "bihar-civil-court-clerk", name: "Bihar Civil Court Clerk", badge: "BCC", fullName: "Bihar Civil Court — Clerk", iconKind: "scales",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No confirmed pattern found for this exact post; using a typical subordinate-court clerk baseline.", "Verify against the latest Bihar Civil Court recruitment notification."] },
  { slug: "rajasthan-ldc", name: "RAJASTHAN LDC", badge: "RSMSSB", fullName: "Rajasthan Subordinate & Ministerial Services Selection Board — Lower Division Clerk", iconKind: "commission",
    speedEnglish: 40, speedHindi: 35, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["Modelled on the RSSB/RSMSSB LDC & Junior Assistant pattern: a 500-word English and 400-word Hindi passage in 10 minutes, marks-based (25 maximum, 9 to qualify), and backspace is strictly not allowed.", "Hindi font: DevLys 010."] },
  { slug: "upsssc-assistants", name: "UPSSSC Assistants", badge: "UPSSSC", fullName: "UP Subordinate Services Selection Commission — Junior Assistant", iconKind: "commission",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 5, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["English and Hindi are tested separately, 5 minutes each, in the real exam (this simulation runs one language for the full duration).", "Backspace may correct only the current word and the one word immediately before it. Hindi is typed in Kruti Dev 010 or Mangal, per the notification."] },
  { slug: "kvs-jsa", name: "KVS JSA", badge: "KVS", fullName: "Kendriya Vidyalaya Sangathan — Junior Secretariat Assistant", iconKind: "book",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["A 5% error tolerance applies — about 5 mistakes per 100 words typed."] },
  { slug: "emrs-jsa", name: "EMRS JSA", badge: "EMRS", fullName: "Eklavya Model Residential Schools — Junior Secretariat Assistant", iconKind: "book",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Backspace use is effectively unlimited in the real exam."] },
  { slug: "supreme-court-jca", name: "Supreme Court JCA", badge: "SC", fullName: "Supreme Court of India — Junior Court Assistant", iconKind: "scales",
    speedEnglish: 35, speedHindi: 35, durationMinutes: 10, accuracy: 97, backspaceMode: "full", patternSourced: true,
    patternNotes: ["English only in the real exam — there is no Hindi typing option for this post.", "Only 3% errors are allowed (97%+ accuracy). The real passage is exactly 1750 keystrokes."] },
  { slug: "allahabad-hc-ro-aro", name: "Allahabad High Court RO/ARO", badge: "AHC", fullName: "Allahabad High Court — Review Officer / Assistant Review Officer", iconKind: "scales",
    speedEnglish: 25, speedHindi: 25, durationMinutes: 20, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["English only, reflecting court/legal drafting work.", "The real scheme deducts 0.1 marks per confirmed error (not a percentage): 25 of 50 marks are needed to qualify, alongside 25+ net WPM independently. No error highlighting while typing; backspace is enabled."] },
  { slug: "allahabad-hc-ps", name: "Allahabad High Court P.S.", badge: "AHC", fullName: "Allahabad High Court — Personal Secretary", iconKind: "scales",
    speedEnglish: 25, speedHindi: 25, durationMinutes: 20, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["Personal Secretary posts usually also require shorthand/stenography skill in addition to typing — check the specific notification.", "Typing baseline modelled on the Allahabad High Court RO/ARO pattern."] },
  { slug: "csir-jsa", name: "CSIR JSA", badge: "CSIR", fullName: "Council of Scientific & Industrial Research — Junior Secretariat Assistant", iconKind: "flask",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Paper-to-screen format — the passage is printed, not shown on screen."] },
  { slug: "jharkhand-hc-assistant", name: "Jharkhand High Court Assistant", badge: "JHC", fullName: "Jharkhand High Court — Assistant", iconKind: "scales",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No confirmed pattern found for this exact post; using a typical High Court assistant baseline.", "Verify against the latest Jharkhand High Court notification."] },
  { slug: "bsf-hcm", name: "BSF HCM", badge: "BSF", fullName: "Border Security Force — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["Same CAPF-wide standard as CRPF, CISF, ITBP, and SSB Head Constable (Ministerial). A 5% error margin is allowed."] },
  { slug: "delhi-hc-jja", name: "Delhi High Court JJA", badge: "DHC", fullName: "Delhi High Court — Junior Judicial Assistant", iconKind: "scales",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No separately confirmed pattern found for Junior Judicial Assistant; using the common Delhi-administrative typing baseline.", "Verify against the latest Delhi High Court notification."] },
  { slug: "bombay-hc-clerk", name: "Bombay High Court Clerk", badge: "BHC", fullName: "Bombay High Court — Clerk", iconKind: "scales",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["The real exam tests English and Marathi, not Hindi — Hindi is used here only as the closest supported regional-language option.", "Personal Assistant/Senior Clerk posts require a higher 40 WPM English. 1 mark is deducted per 4 word mistakes; backspace is disabled; maximum 2% error rate."] },
  { slug: "mp-cpct", name: "MP CPCT", badge: "CPCT", fullName: "Madhya Pradesh — Computer Proficiency Certification Test", iconKind: "monitor",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Each language section (English and Hindi) runs 15 minutes separately in the real exam.", "CPCT scores speed on a scaled percentage rather than a flat pass/fail — higher speeds score higher, not just \"qualify\"."] },
  { slug: "patna-hc-computer-operator", name: "Patna High Court Computer Operator", badge: "PHC", fullName: "Patna High Court — Computer Operator", iconKind: "scales",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No confirmed pattern found for this exact post; using a typical High Court computer-operator baseline.", "Verify against the latest Patna High Court notification."] },
  { slug: "ssb-hcm", name: "SSB HCM", badge: "SSB", fullName: "Sashastra Seema Bal — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["Same CAPF-wide standard as CRPF, BSF, CISF, and ITBP Head Constable (Ministerial)."] },
];

export const EXAM_CATEGORIES: ExamCategoryDefinition[] = RAW_CATEGORIES.map((category, index) => ({
  ...category,
  tone: TONE_PALETTE[index % TONE_PALETTE.length][0],
  toneDark: TONE_PALETTE[index % TONE_PALETTE.length][1],
}));

export function getExamCategory(slug: string) {
  return EXAM_CATEGORIES.find((category) => category.slug === slug);
}

export function examCategoryPresetId(slug: string, language: "English" | "Hindi") {
  return `exam-cat-${slug}-${language.toLowerCase()}`;
}

export function defaultExamCategoryRules(category: ExamCategoryDefinition, language: "English" | "Hindi"): string[] {
  const speed = language === "English" ? category.speedEnglish : category.speedHindi;
  return [
    `This is an independent practice simulation for the ${category.fullName} typing test, created by Samradhi Classes. It is not affiliated with, endorsed by, or an official product of the concerned recruitment or examination authority.`,
    `Target pattern: ${speed} WPM in ${language}, ${category.durationMinutes} minutes, ${category.accuracy}% minimum accuracy, backspace ${category.backspaceMode === "disabled" ? "not allowed" : "allowed"}.`,
    category.patternSourced
      ? "These figures are based on published exam-pattern research for this post. Government exam patterns change between recruitment cycles — always cross-check against the current official notification before your real exam."
      : "No confirmed official pattern was found for this exact post; the figures above are a reasoned baseline from the closest comparable exam family, not a verified official pattern. Please tell us the real pattern if you have the official notification, and we will update it.",
    ...category.patternNotes,
    "The timer starts on your first keystroke, not when the page loads.",
    "Full-screen mode is available from the toolbar for a distraction-free, exam-like environment, with a dedicated button to exit full screen.",
  ];
}

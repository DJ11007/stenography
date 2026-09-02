import type { BackspaceMode } from "./typing-test.ts";

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
  // Widened from "full" | "disabled" to the app's real BackspaceMode when
  // the Rajasthan LDC / RSMSSB category's genuine word-level-lock rule
  // (correct freely within the current word, locked forever once you press
  // Space or Enter -- see its patternNotes) needed the "word" value this
  // type had never allowed for any category before.
  backspaceMode: BackspaceMode;
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

// patternNotes below were researched against typing-test-preparation guides that
// cite each board's own notifications (SSC, RRB, DSSSB, RSMSSB, court
// registries, etc.) as of September 2026, specifically for: the marking/error
// scheme (what counts as a full vs half mistake, marks-per-word where
// applicable), the backspace policy, and whether the real exam screen shows
// any live highlighting. Where sources conflicted or nothing could be
// confirmed, that conflict/gap is stated plainly rather than guessed at --
// see each category's patternSourced flag and the corresponding note.
const RAW_CATEGORIES: Array<Omit<ExamCategoryDefinition, "tone" | "toneDark">> = [
  { slug: "ssc-chsl", name: "SSC CHSL", badge: "CHSL", fullName: "Staff Selection Commission — Combined Higher Secondary Level", iconKind: "commission",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Test duration is 15 minutes (20 minutes for candidates eligible for a scribe).", "The typing/DEST test itself carries no marks toward the final score, but failing it disqualifies the candidate regardless of other marks.", "Backspace is allowed under SSC's current clarification, but every backspace still counts toward your gross keystrokes, so overusing it lowers your net speed.", "Mistakes are split into full mistakes (wrong, omitted, or repeated words; spelling errors) and half mistakes (spacing, capitalization, punctuation, transposition); the combined error percentage must stay within the category-wise limit set in that year's notification — commonly around 7% for general-category candidates."] },
  { slug: "ssc-cgl", name: "SSC CGL", badge: "CGL", fullName: "Staff Selection Commission — Combined Graduate Level", iconKind: "commission",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["The DEST is historically measured as about 2000 key depressions in 15 minutes (roughly 27–33 WPM); this simulation uses the standard SSC 35/30 WPM baseline.", "Qualifying only — it does not add to the final score, but you must clear it to remain in contention.", "Backspace is allowed at any point during the 15 minutes with no usage limit, but you cannot restart the passage from the beginning once you start typing — correct only as you go.", "Mistakes are graded as full mistakes (omitted, substituted, added, or repeated words; spelling errors) and half mistakes (spacing, capitalization, punctuation, transposition), converted to an error percentage of the whole passage. The pass threshold is category- and post-dependent — roughly 20% for general Group C/D posts down to 5% for higher-standard posts such as Tax Assistant or ASO — so always confirm against your specific post's notification."] },
  { slug: "aiims-cre-ldc", name: "AIIMS CRE LDC", badge: "AIIMS", fullName: "All India Institute of Medical Sciences — Common Recruitment Exam, Lower Division Clerk", iconKind: "medical",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Test duration is 15 minutes.", "Backspace is fully enabled — you can correct any earlier mistake at any point in the 15 minutes. Qualifying only.", "Minimum keystrokes to qualify: about 2625 in English or 2250 in Hindi within the 15 minutes, on top of the 35/30 WPM speed requirement."] },
  { slug: "rrb-ntpc", name: "RRB NTPC", badge: "NTPC", fullName: "Railway Recruitment Board — Non-Technical Popular Categories", iconKind: "train",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["A 5% error margin is allowed; beyond that, each mistake is penalised as 10 words.", "Backspace is not permitted in the real exam. Hindi uses the InScript or Remington Gail layout.", "Errors are graded word-by-word as full and half mistakes; the first 5% of mistyped words are ignored, and every mistake past that deducts the equivalent of 10 words (50 keystrokes) from your final score."] },
  { slug: "crpf-hcm", name: "CRPF HCM", badge: "CRPF", fullName: "Central Reserve Police Force — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["The same standard applies across CRPF, BSF, CISF, ITBP, and SSB Head Constable (Ministerial) posts.", "A 5% error margin is allowed; beyond that, each mistake is penalised as 10 words. Paper-to-screen format on centre-provided computers only.", "Backspace is commonly disabled for CRPF and CISF specifically, though the CAPF-wide policy has varied by force and notification cycle (BSF has sometimes allowed it) — this simulation uses backspace disabled as the standard baseline for CRPF. Confirm against your specific force's current notification."] },
  { slug: "dsssb-ldc", name: "DSSSB LDC", badge: "DSSSB", fullName: "Delhi Subordinate Services Selection Board — Lower Division Clerk", iconKind: "commission",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Screen-to-screen mode — the passage is shown on screen, not printed on paper.", "Backspace is permitted, but typed text is not highlighted as you go — the real DSSSB interface shows no live word or error highlighting, and the passage does not auto-scroll for you. Mistakes only become visible after you submit.", "This simulator highlights your current position and auto-scrolls as a training aid, which the real DSSSB screen does not do — practice occasionally with a highlight setting of \"None\" from Settings to get used to typing without that cue."] },
  { slug: "up-police-computer-operator", name: "UP Police Computer Operator", badge: "UPP", fullName: "Uttar Pradesh Police — Computer Operator", iconKind: "police",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 15, accuracy: 85, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Modelled on the UPPRPB Computer Operator pattern: a 500-word English passage in 15 minutes at 30 WPM with 85% accuracy, and a 400-word Hindi passage at 25 WPM with 85% accuracy on the Unicode InScript keyboard.", "Backspace can be used to correct typed words, but frequent use noticeably reduces your gross-to-net speed conversion.", "Wrong, missing, or extra words count as full mistakes; spacing and capitalization count as half mistakes. Net WPM is (total words − full mistakes − half mistakes ÷ 2) ÷ minutes.", "The test is qualifying only, with no live error highlighting in the real interface."] },
  { slug: "rajasthan-high-court-ldc", name: "Rajasthan High Court LDC", badge: "RHC", fullName: "Rajasthan High Court — Lower Division Clerk", iconKind: "scales",
    speedEnglish: 40, speedHindi: 35, durationMinutes: 10, accuracy: 95, backspaceMode: "full", patternSourced: false,
    patternNotes: ["Modelled on the Rajasthan LDC/Stenographer typing benchmark of 40 WPM English / 35 WPM Hindi at 95% accuracy.", "Published sources disagree on the exact scheme — some describe a marks-based test (up to 50 marks, a roughly 25 net-WPM benchmark), others a straightforward speed-and-accuracy qualifying test, and backspace availability is reported both ways.", "Verify against the specific Rajasthan High Court LDC notification before your real exam."] },
  { slug: "delhi-police-hcm", name: "Delhi Police HCM", badge: "DP", fullName: "Delhi Police — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["The real passage is at least 400 words (2000 strokes) in English or 350 words (1750 strokes) in Hindi.", "Every remaining error reduces the final speed by exactly 1 WPM — there is no partial-mistake concession. Paper-to-screen format, maximum 25 marks.", "Backspace is permitted for corrections before you move on, unlike the stricter CAPF Head Constable Ministerial standard above — but since every uncorrected error still costs a full WPM, correct deliberately rather than typing fast and hoping to fix it later."] },
  { slug: "bihar-civil-court-clerk", name: "Bihar Civil Court Clerk", badge: "BCC", fullName: "Bihar Civil Court — Clerk", iconKind: "scales",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No confirmed pattern found for this exact post; using a typical subordinate-court clerk baseline (35 WPM English / 30 WPM Hindi-family benchmark and ~95% accuracy are common across comparable subordinate courts, so treat this simulation's numbers as a gentler starting point, not the ceiling).", "Backspace policy for subordinate-court clerk exams varies significantly by court and notification — some allow free correction, others lock text in permanently. We could not locate a published typing-specific rulebook from Bihar's own recruiting body; verify against the latest Bihar Civil Court recruitment notification."] },
  { slug: "rajasthan-ldc", name: "RAJASTHAN LDC", badge: "RSMSSB", fullName: "Rajasthan Subordinate & Ministerial Services Selection Board — Lower Division Clerk", iconKind: "commission",
    speedEnglish: 40, speedHindi: 35, durationMinutes: 10, accuracy: 95, backspaceMode: "word", patternSourced: true,
    patternNotes: ["Modelled on the RSSB/RSMSSB LDC & Junior Assistant pattern: a 500-word English and 400-word Hindi passage in 10 minutes, marks-based (25 maximum, 9 to qualify). Hindi font: DevLys 010 with the Remington Gail layout.", "Marks are earned per correct word only — 0.05 marks/word in English (need 180 of 500 words correct, 36%, for the 9-mark minimum) and 0.0625 marks/word in Hindi (need 144 of 400 words correct, also 36%). There is no negative marking for wrong words — an incorrect word simply earns nothing.", "The moment you press Space or Enter, the word you just typed is locked forever — backspace only works within the word currently being typed, never on a completed one."] },
  { slug: "upsssc-assistants", name: "UPSSSC Assistants", badge: "UPSSSC", fullName: "UP Subordinate Services Selection Commission — Junior Assistant", iconKind: "commission",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 5, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["English and Hindi are tested separately, 5 minutes each, in the real exam (this simulation runs one language for the full duration).", "Backspace may correct only the current word and the one word immediately before it — a maximum of two words in total; you cannot go back further to fix an earlier mistake. Hindi is typed in Kruti Dev 010 or Mangal, per the notification.", "Each word in the passage is highlighted one at a time as you type it, moving to the next word once you press Space. A grace of up to 5 mistakes is given — if you make 5 or fewer, your speed is calculated on the full word count typed."] },
  { slug: "kvs-jsa", name: "KVS JSA", badge: "KVS", fullName: "Kendriya Vidyalaya Sangathan — Junior Secretariat Assistant", iconKind: "book",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["A 5% error tolerance applies in most notifications — about 5 mistakes per 100 words typed — though some cycles have reported figures as high as 20%, so treat the app's accuracy requirement as a solid practice target rather than a guaranteed official cutoff.", "Backspace is fully enabled with no restriction.", "The real KVS JSA screen shows no live word highlight, no error highlight, and no auto-scroll — unlike this simulator's on-screen aids, you're on your own to track your position."] },
  { slug: "emrs-jsa", name: "EMRS JSA", badge: "EMRS", fullName: "Eklavya Model Residential Schools — Junior Secretariat Assistant", iconKind: "book",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Backspace use is effectively unlimited in the real exam — correcting a mistake costs a few seconds, but an uncorrected one can cost you the qualifying cutoff, so use it freely.", "Typing is Tier-III of the selection process (after a qualifying Tier-I and a merit-determining Tier-II) — it does not add marks to your final merit, it is a pass/fail hurdle you must clear after the written stages.", "Expect roughly 1750+ keystrokes within the 10-minute window at the 35/30 WPM requirement; the exact marks-deduction schedule for wrong words has not been published in the notifications we could find."] },
  { slug: "supreme-court-jca", name: "Supreme Court JCA", badge: "SC", fullName: "Supreme Court of India — Junior Court Assistant", iconKind: "scales",
    speedEnglish: 35, speedHindi: 35, durationMinutes: 10, accuracy: 97, backspaceMode: "full", patternSourced: true,
    patternNotes: ["English only in the real exam — there is no Hindi typing option for this post.", "Only 3% errors are allowed (97%+ accuracy). The real passage is exactly 1750 keystrokes (350 words).", "The typing test carries 50 maximum marks with 25 required to qualify — awarded independently of, and in addition to, the minimum 35 net WPM speed requirement."] },
  { slug: "allahabad-hc-ro-aro", name: "Allahabad High Court RO/ARO", badge: "AHC", fullName: "Allahabad High Court — Review Officer / Assistant Review Officer", iconKind: "scales",
    speedEnglish: 25, speedHindi: 25, durationMinutes: 20, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["English only, reflecting court/legal drafting work.", "The real scheme deducts 0.1 marks per confirmed error (not a percentage): 25 of 50 marks are needed to qualify, alongside 25+ net WPM independently.", "No error highlighting while typing — you must proofread visually as you go, since mistakes are never flagged on screen. Backspace is enabled with no usage penalty."] },
  { slug: "allahabad-hc-ps", name: "Allahabad High Court P.S.", badge: "AHC", fullName: "Allahabad High Court — Personal Secretary", iconKind: "scales",
    speedEnglish: 25, speedHindi: 25, durationMinutes: 20, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["Personal Secretary posts usually also require shorthand/stenography skill in addition to typing — check the specific notification.", "Typing baseline modelled on the Allahabad High Court RO/ARO pattern: 0.1 marks deducted per confirmed error, 25 of 50 marks to qualify, no on-screen error highlighting, backspace enabled."] },
  { slug: "csir-jsa", name: "CSIR JSA", badge: "CSIR", fullName: "Council of Scientific & Industrial Research — Junior Secretariat Assistant", iconKind: "flask",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Paper-to-screen format — the passage is printed, not shown on screen.", "Up to 5% mistakes are ignored for UR/EWS/OBC/SC/OH/VH candidates, and up to 7% for ST/HH/Ex-servicemen candidates, before any further penalty applies.", "You must type the passage from beginning to end within the 10-minute window — there's no separate correction phase once time runs out."] },
  { slug: "jharkhand-hc-assistant", name: "Jharkhand High Court Assistant", badge: "JHC", fullName: "Jharkhand High Court — Assistant", iconKind: "scales",
    speedEnglish: 30, speedHindi: 25, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No confirmed pattern found for this exact post; using a typical High Court assistant baseline.", "We could not locate a published typing-specific rulebook (marking scheme, backspace policy, or highlighting behaviour) for this post — verify against the latest Jharkhand High Court notification."] },
  { slug: "bsf-hcm", name: "BSF HCM", badge: "BSF", fullName: "Border Security Force — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["Same CAPF-wide standard as CRPF, CISF, ITBP, and SSB Head Constable (Ministerial). A 5% error margin is allowed; beyond that, each mistake is penalised as 10 words.", "BSF's own skill test has, in some notification cycles, allowed backspace even where CRPF/CISF disabled it — this simulation keeps backspace disabled to match the conservative CAPF-wide baseline above; confirm against BSF's current notification if you specifically need it enabled."] },
  { slug: "delhi-hc-jja", name: "Delhi High Court JJA", badge: "DHC", fullName: "Delhi High Court — Junior Judicial Assistant", iconKind: "scales",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["No separately confirmed pattern found for Junior Judicial Assistant; using the common Delhi-administrative typing baseline.", "Some sources report a stricter 3% error tolerance (97%+ accuracy) for this post and disagree with each other on whether backspace is enabled — until an official notification is confirmed, this simulation keeps the general baseline above. Verify against the latest Delhi High Court notification."] },
  { slug: "bombay-hc-clerk", name: "Bombay High Court Clerk", badge: "BHC", fullName: "Bombay High Court — Clerk", iconKind: "scales",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["The real exam tests English and Marathi, not Hindi — Hindi is used here only as the closest supported regional-language option.", "Personal Assistant/Senior Clerk posts require a higher 40 WPM English; Junior Clerk/Typist posts (this simulation's baseline) require 35 WPM English / 30 WPM Marathi.", "1 mark is deducted per 4 word mistakes, with a maximum 2% error rate permitted; backspace is disabled."] },
  { slug: "mp-cpct", name: "MP CPCT", badge: "CPCT", fullName: "Madhya Pradesh — Computer Proficiency Certification Test", iconKind: "monitor",
    speedEnglish: 30, speedHindi: 20, durationMinutes: 5, accuracy: 95, backspaceMode: "full", patternSourced: true,
    patternNotes: ["The real CPCT typing component runs only 5 minutes per language (English or Hindi, candidate's choice) — shorter than most other exams on this list.", "A net speed of 30 WPM (English) or 20 WPM (Hindi) at roughly 95% accuracy is the qualifying benchmark; CPCT then converts your actual net speed into a scaled score between 50% and 100%, so a faster, cleaner attempt scores higher rather than just \"pass/fail\".", "CPCT runs an \"Unrestricted Typing\" mode where backspace is fully usable; word highlighting, error highlighting, and auto-scrolling are all enabled on the real screen — one of the few exams on this list where the live interface works much like this simulator's."] },
  { slug: "patna-hc-computer-operator", name: "Patna High Court Computer Operator", badge: "PHC", fullName: "Patna High Court — Computer Operator", iconKind: "scales",
    speedEnglish: 40, speedHindi: 30, durationMinutes: 10, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Passage length is about 400 words in English or 300 words in Hindi (plus or minus 5%), typed within the 10-minute window. English requires roughly 90% accuracy, Hindi roughly 85%.", "Scoring is percentage-based: for example, 40 WPM at 96% accuracy scores about 96 out of 100 for the typing component, rather than a flat pass/fail.", "Candidate reports on backspace availability conflict between recruitment cycles — this simulation keeps backspace enabled as the more commonly reported setting, but confirm against your admit card and exam-day instructions."] },
  { slug: "ssb-hcm", name: "SSB HCM", badge: "SSB", fullName: "Sashastra Seema Bal — Head Constable (Ministerial)", iconKind: "police",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "disabled", patternSourced: true,
    patternNotes: ["Same CAPF-wide standard as CRPF, BSF, and ITBP Head Constable (Ministerial).", "A 5% error margin is allowed before the 10-words-per-mistake penalty applies; backspace is disabled to match the conservative CAPF-wide baseline (some individual forces have allowed it in specific cycles — confirm against SSB's current notification)."] },
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

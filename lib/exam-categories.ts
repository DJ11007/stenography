import type { BackspaceMode, HighlightMode, WordMethod } from "./typing-test.ts";

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
  /** Board-specific overrides for the two typing-behaviour dimensions no category has
   * ever varied before -- undefined for every category except where explicitly
   * researched (e.g. Rajasthan LDC's real word-separated counting and no on-screen
   * highlight). Undefined means categoryPreset() falls back to its long-standing
   * defaults ("characters" word method, no highlight override) exactly as before. */
  wordMethod?: WordMethod;
  highlightMode?: HighlightMode;
  /** Board-specific override for the scoring engine's per-mistake penalty weights (default
   * for every other category: 1 for a full mistake, 0.5 for a half mistake -- a generic
   * approximation). Set only where a board's real, confirmed formula penalizes every
   * incorrect word identically regardless of severity (e.g. NCERT/DDA/SSC's shared
   * "(gross keystrokes / 5 - incorrect words x 10) / minutes" net-speed formula, which
   * draws no full/half distinction at all -- both fields are set to that same 10). */
  fullErrorPenalty?: number;
  halfErrorPenalty?: number;
  /** Hindi translation of patternNotes, shown on the Hindi half of the category rules page and
   * as this category's Hindi preset's own instructionNotes. Undefined for every category except
   * where explicitly translated -- defaultExamCategoryRules() falls back to the English
   * patternNotes (unchanged, pre-existing behavior) until a category gets its own translation. */
  patternNotesHindi?: string[];
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
    // speedEnglish/speedHindi represent the pace needed for full marks
    // (25/25), not a separate qualifying threshold: 500 words / 10 min =
    // exactly 50 WPM English, 400 words / 10 min = exactly 40 WPM Hindi --
    // the same numbers the marks scheme already implies, confirmed directly
    // by the user against RSSB's own published rules.
    speedEnglish: 50, speedHindi: 40, durationMinutes: 10, accuracy: 95, backspaceMode: "word", wordMethod: "spaces", highlightMode: "none", patternSourced: true,
    patternNotes: ["Modelled on the RSSB/RSMSSB LDC & Junior Assistant pattern: a 500-word English and 400-word Hindi passage in 10 minutes, marks-based (25 maximum, 9 to qualify). Hindi font: DevLys 010 with the Remington Gail layout.", "Marks are earned per correct word only — 0.05 marks/word in English (need 180 of 500 words correct, 36%, for the 9-mark minimum) and 0.0625 marks/word in Hindi (need 144 of 400 words correct, also 36%). There is no negative marking for wrong words — an incorrect word simply earns nothing.", "Full marks (25/25) require typing the whole passage correctly within the 10 minutes — 50 WPM in English, 40 WPM in Hindi, both at the 95% accuracy shown above.", "The moment you press Space or Enter, the word you just typed is locked forever — backspace only works within the word currently being typed, never on a completed one.", "There is no on-screen highlighting of your current position, and words are counted by spaces (not the SSC-style 5-characters-per-word convention) — matching the real RSSB screen and its per-word marking scheme."] },
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
  { slug: "ncert-ldc", name: "NCERT LDC", badge: "NCERT", fullName: "National Council of Educational Research and Training — Lower Division Clerk", iconKind: "book",
    speedEnglish: 35, speedHindi: 30, durationMinutes: 10, accuracy: 95, backspaceMode: "full", highlightMode: "none", fullErrorPenalty: 10, halfErrorPenalty: 10, patternSourced: true,
    // Corrected from an earlier assumption: NCERT's typing test actually
    // runs on the TCS-iON platform (the software behind SSC/RRB-style
    // exams), not DDA's own portal, and TCS-iON runs with NO live
    // highlighting and NO auto-scroll at all -- confirmed independently
    // via research, not just the DDA-borrowed "Unrestricted Mode" (green/
    // red word highlighting) previously assumed here since NCERT's own
    // notification wasn't directly machine-readable.
    patternNotes: ["Selection is a Computer-Based Test (CBT) for the merit list, followed by a qualifying-only typing/computer skill test: it adds no marks of its own to the merit list, but failing it disqualifies you regardless of CBT rank. Confirmed directly against NCERT's own 2026 LDC recruitment cycle (result declared, typing test scheduled at NCERT New Delhi), not just the closest comparable exam family.", "35 WPM English or 30 WPM Hindi, corresponding to 10,500 / 9,000 key depressions per hour at 5 depressions per word (including spaces and punctuation), over a 10-minute test — the same widely standardised government pattern SSC and DDA's Junior Secretariat Assistant post use; NCERT's own notification confirms these exact numbers and duration, and only opts you into one language (English in Times New Roman, or Hindi in Unicode/Kruti Dev/Mangal) for the whole attempt.", "The real scoring formula -- confirmed against DDA's official JSA typing instructions, which NCERT's typing test follows the same standard as -- is Net Speed = (gross keystrokes ÷ 5 − incorrect words × 10) ÷ minutes: every incorrect word costs a flat 10-word penalty with no partial credit for a minor slip, unlike this platform's default full/half mistake split. fullErrorPenalty and halfErrorPenalty are both set to 10 here so every mistake category scores identically -- this is now the real formula, not an approximation.", "NCERT's typing test actually runs on the TCS-iON platform (the same software used for SSC/RRB-style exams), not DDA's own portal -- confirmed live word/error highlighting and auto-scrolling are both OFF: the passage shows as static plain text and you track your own position line by line while typing into the blank area below it, matching this platform's own layout. Backspace is fully enabled to fix a mistake at any point.", "English uses Times New Roman on a US QWERTY layout (12 pt, 1.5 line spacing on the real exam screen); Hindi uses Mangal on a Remington Gail layout — both already supported by this platform's existing Hindi input systems."],
    patternNotesHindi: ["चयन मेरिट सूची के लिए एक कंप्यूटर आधारित परीक्षा (सीबीटी) है, जिसके बाद केवल अर्हकारी (क्वालिफाइंग) टाइपिंग/कंप्यूटर कौशल परीक्षा होती है: यह मेरिट सूची में अपने कोई अंक नहीं जोड़ती, लेकिन इसमें असफल होने पर आपकी सीबीटी रैंक चाहे जो भी हो, आप अयोग्य हो जाते हैं। यह सीधे एनसीईआरटी की अपनी 2026 एलडीसी भर्ती प्रक्रिया (परिणाम घोषित, टाइपिंग टेस्ट एनसीईआरटी नई दिल्ली में निर्धारित) के विरुद्ध पुष्ट किया गया है, न कि केवल निकटतम तुलनीय परीक्षा परिवार से।", "अंग्रेज़ी में 35 डब्ल्यूपीएम या हिंदी में 30 डब्ल्यूपीएम, जो प्रति शब्द 5 की-डिप्रेशन (रिक्त स्थान और विराम चिह्नों सहित) की दर से 10,500 / 9,000 की-डिप्रेशन प्रति घंटा के बराबर है, 10 मिनट की परीक्षा में — यही व्यापक रूप से मानकीकृत सरकारी पैटर्न एसएससी और डीडीए के जूनियर सचिवालय सहायक पद में भी उपयोग होता है; एनसीईआरटी की अपनी अधिसूचना इन्हीं सटीक आंकड़ों और अवधि की पुष्टि करती है, और पूरी परीक्षा के लिए आपको केवल एक भाषा चुननी होती है (टाइम्स न्यू रोमन में अंग्रेज़ी, या यूनिकोड/कृति देव/मंगल में हिंदी)।", "वास्तविक स्कोरिंग सूत्र — डीडीए के आधिकारिक जेएसए टाइपिंग निर्देशों के विरुद्ध पुष्ट, जिनके समान मानक का पालन एनसीईआरटी की टाइपिंग परीक्षा भी करती है — है: नेट स्पीड = (सकल की-डिप्रेशन ÷ 5 − गलत शब्द × 10) ÷ मिनट: प्रत्येक गलत शब्द पर पूरे 10 शब्दों की कटौती होती है, चाहे गलती कितनी भी मामूली क्यों न हो — इस प्लेटफ़ॉर्म के डिफ़ॉल्ट पूर्ण/आधी गलती विभाजन के विपरीत। fullErrorPenalty और halfErrorPenalty दोनों को यहां 10 पर सेट किया गया है ताकि हर गलती श्रेणी समान रूप से स्कोर हो — यह अब वास्तविक सूत्र है, अनुमान नहीं।", "एनसीईआरटी की टाइपिंग परीक्षा वास्तव में टीसीएस-आयन (TCS-iON) प्लेटफ़ॉर्म पर आयोजित होती है (वही सॉफ़्टवेयर जो एसएससी/आरआरबी शैली की परीक्षाओं में उपयोग होता है), डीडीए के अपने पोर्टल पर नहीं — पुष्टि की गई है कि लाइव शब्द/त्रुटि हाइलाइटिंग और ऑटो-स्क्रॉलिंग दोनों बंद रहते हैं: गद्यांश स्थिर सादे पाठ के रूप में दिखता है और आपको टाइप करते समय नीचे की खाली जगह में अपनी स्थिति स्वयं पंक्ति-दर-पंक्ति ट्रैक करनी होती है, ठीक इस प्लेटफ़ॉर्म के अपने ले-आउट की तरह। किसी भी समय गलती ठीक करने के लिए बैकस्पेस पूरी तरह से सक्षम है।", "अंग्रेज़ी के लिए यूएस क्वर्टी (QWERTY) लेआउट पर टाइम्स न्यू रोमन फ़ॉन्ट (वास्तविक परीक्षा स्क्रीन पर 12 पॉइंट, 1.5 लाइन स्पेसिंग) उपयोग होता है; हिंदी के लिए रेमिंग्टन गेल लेआउट पर मंगल फ़ॉन्ट उपयोग होता है — दोनों इस प्लेटफ़ॉर्म की मौजूदा हिंदी इनपुट प्रणालियों में पहले से समर्थित हैं।"] },
  // The admin asked us to research which real Rajasthan/RSSB posts (beyond
  // the existing Rajasthan LDC category) involve typing, and add any
  // genuine gaps with real rules, not guesses. Clerk/Clerk Grade-II and
  // Personal Assistant Grade-II turned out to already be the SAME
  // recruitment as, respectively, "Rajasthan LDC" (RSSB's own posting is
  // titled "Clerk Grade-II / Junior Assistant") and the existing
  // stenography-module "RSMSSB Stenographer" category (RSMSSB's own
  // posting is titled "Stenographer & PA Grade-II") -- so no new category
  // was needed for either. Data Entry Operator and Tax Assistant are
  // genuinely separate posts with their own patterns; see each one's own
  // patternSourced flag and notes for exactly how confident that pattern is.
  { slug: "rajasthan-deo", name: "Rajasthan DEO", badge: "RSSB", fullName: "Rajasthan Staff Selection Board — Data Entry Operator", iconKind: "commission",
    // speedEnglish/speedHindi represent the pace needed for full marks
    // (25/25), matching the same convention as Rajasthan LDC: 1250 words /
    // 15 min = ~83 WPM in both languages (DEO's real passage is the same
    // length in both languages, unlike LDC's differing 500/400).
    speedEnglish: 83, speedHindi: 83, durationMinutes: 15, accuracy: 90, backspaceMode: "full", wordMethod: "spaces", highlightMode: "none", patternSourced: true,
    patternNotes: ["Corroborated across multiple independent sources (typing-practice platforms and 2025 admit-card notices citing RSSB's own recruitment cycle): a 1,250-word passage in each of English and Hindi, 15 minutes per language, marks-based (25 maximum per language, 10.5 to qualify) — genuinely different from Rajasthan LDC's shorter 500/400-word, 10-minute pattern, not the same exam.", "Marks are earned per correct word: 25 ÷ 1250 = 0.02 marks/word in both languages — you need 525 correct words (35 WPM) for the 10.5-mark minimum, matching the sourced \"minimum 35 WPM\" qualifying figure exactly.", "Backspace rules were not specified in any source found during this research pass — \"full\" backspace is used here as a reasonable default, not a confirmed figure; verify against the current notification.", "Word-separated counting and no on-screen highlight are assumed to match the same RSSB screen/software family as Rajasthan LDC, since both are administered by the same board — this is an extrapolation, not independently confirmed for DEO specifically."] },
  { slug: "rajasthan-tax-assistant", name: "Rajasthan Tax Assistant", badge: "RSMSSB", fullName: "Rajasthan Subordinate & Ministerial Services Selection Board — Tax Assistant", iconKind: "commission",
    speedEnglish: 20, speedHindi: 20, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: false,
    patternNotes: ["Only one source was found for this post's typing requirements during this research pass, and it wasn't independently cross-verified — treat every number here as provisional and confirm against the current official notification before relying on it.", "That source states 20 WPM required in both English and Hindi, 15 minutes per language, as part of a larger \"Computer Proficiency Test\" (Paper 4) worth 100 marks total with 40 to qualify — but the marks figure appears to cover typing AND a separate MS-Excel component together, not typing alone, so it isn't modelled as a per-word marks scheme here the way Rajasthan LDC and Rajasthan DEO are.", "The Excel component is a distinct skill from typing and isn't simulated by this typing category — see the Excel Efficiency Test patterns (shown to admins while authoring a test) for the separate, also-unconfirmed RSMSSB Excel task list.", "Backspace rules were not stated in the source found; \"full\" is used as the platform default, not a confirmed figure."] },
  { slug: "rajasthan-hc-system-assistant", name: "RHC System Assistant", badge: "RHC", fullName: "Rajasthan High Court — System Assistant", iconKind: "scales",
    // 8000 KDPH is the real published qualifying threshold, corroborated
    // across two independent sources with matching numbers -- converted at
    // the standard 5 keystrokes/word: 8000 / 60 / 5 = 26.67 WPM, rounded up.
    speedEnglish: 27, speedHindi: 27, durationMinutes: 5, accuracy: 90, backspaceMode: "word", patternSourced: true,
    patternNotes: ["The real speed test runs Hindi (5 min, Kruti Dev 010) then English (5 min, Calibri) separately with a 2-minute gap between them — this simulator runs one continuous language selection for the same 5-minute duration, like every other category here.", "8,000 KDPH (key depressions per hour) is the qualifying threshold for both languages — about 26.67 WPM at the standard 5-keystrokes-per-word conversion; real candidates are advised to target well above this (10,000–12,000 KDPH) since it's a disqualification floor, not a competitive target.", "Backspace only corrects the word currently being typed — once you press Space or Enter, that word is locked, matching the same rule already modelled for Rajasthan LDC/DEO.", "The real exam also disables arrow-key navigation, Delete, cut/copy/paste, right-click, and spellcheck during the speed test — this simulator doesn't specifically restrict those, so treat this as speed/backspace practice rather than an exact interface reproduction.", "Beyond the speed test, the real exam also has separate 10-minute MS Word and 10-minute MS Excel efficiency papers (50 marks total) — see the Excel Efficiency Test patterns (shown to admins while authoring a test) for that separate, also-sourced task list; this typing category only covers the speed-test half."] },
  { slug: "rssb-informatics-assistant", name: "RSSB Informatics Assistant", badge: "RSSB", fullName: "Rajasthan Staff Selection Board — Informatics Assistant", iconKind: "commission",
    speedEnglish: 20, speedHindi: 20, durationMinutes: 15, accuracy: 90, backspaceMode: "full", patternSourced: true,
    patternNotes: ["Corroborated across two independent sources with matching numbers: 15 minutes per language, 20 WPM required in both English and Hindi, and the test is qualifying only — no marks are awarded for typing speed itself, but failing disqualifies you regardless of your written-exam rank.", "English uses Courier New on a standard QWERTY layout; Hindi uses DevLys 010 on a Remington (typewriter) layout.", "Neither source found during this research pass stated an accuracy percentage or a backspace rule — the 90% accuracy and full backspace used here are the platform's own defaults, not confirmed figures. Verify against the current official notification."] },
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
  // Real reported bug: the Hindi half of the category rules page (and this
  // category's Hindi preset's own instructionNotes) rendered these same
  // fixed sentences in English -- only the heading above them ("हिंदी नियम
  // एवं शर्तें") was actually Hindi. These five sentences are now genuinely
  // translated; category.patternNotesHindi (falling back to the English
  // patternNotes when a category hasn't been translated yet) covers the
  // per-category detail notes.
  if (language === "Hindi") {
    return [
      `यह Samradhi Classes द्वारा बनाई गई ${category.fullName} टाइपिंग परीक्षा के लिए एक स्वतंत्र अभ्यास सिमुलेशन है। यह संबंधित भर्ती या परीक्षा प्राधिकरण से संबद्ध, अनुमोदित या उसका आधिकारिक उत्पाद नहीं है।`,
      `लक्ष्य पैटर्न: हिंदी में ${speed} शब्द प्रति मिनट (WPM), ${category.durationMinutes} मिनट, न्यूनतम ${category.accuracy}% सटीकता, बैकस्पेस ${category.backspaceMode === "disabled" ? "की अनुमति नहीं" : "की अनुमति"}।`,
      category.patternSourced
        ? "ये आंकड़े इस पद पर प्रकाशित परीक्षा-पैटर्न शोध पर आधारित हैं। सरकारी परीक्षा पैटर्न भर्ती चक्रों के बीच बदल सकते हैं — अपनी वास्तविक परीक्षा से पहले हमेशा मौजूदा आधिकारिक अधिसूचना से जांच करें।"
        : "इस सटीक पद के लिए कोई पुष्ट आधिकारिक पैटर्न नहीं मिला; ऊपर दिए गए आंकड़े निकटतम तुलनीय परीक्षा परिवार पर आधारित एक अनुमानित आधार रेखा हैं, न कि सत्यापित आधिकारिक पैटर्न। यदि आपके पास आधिकारिक अधिसूचना है तो कृपया हमें वास्तविक पैटर्न बताएं, और हम इसे अपडेट कर देंगे।",
      ...(category.patternNotesHindi ?? category.patternNotes),
      "टाइमर आपकी पहली कीस्ट्रोक से शुरू होता है, पेज लोड होने पर नहीं।",
      "ध्यान भटकाए बिना, परीक्षा जैसा माहौल पाने के लिए टूलबार से फ़ुल-स्क्रीन मोड उपलब्ध है, साथ ही फ़ुल स्क्रीन से बाहर निकलने के लिए एक समर्पित बटन भी है।",
    ];
  }
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

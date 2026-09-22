// WordTris: an original falling-word typing game (/typing/games/wordtris),
// content and difficulty-curve constants shared by the game client and the
// admin word-bank editor. Word banks are admin-editable (see
// app/admin/wordtris-words); the lists below are the bundled fallback used
// until the 202609171700 migration has published rows for a given
// language + category, mirroring lib/krutidev-tutor-content.ts's fallback
// role for the Kruti Dev tutor.

export type WordtrisLanguage = "hindi" | "english";
export type WordtrisCategory = "animals" | "cars" | "common" | "countries" | "easy_words" | "names" | "numbers";
// Real reported request: WordTris only ever drilled whole words, but raw
// per-keystroke reaction speed (the actual bottleneck for a working
// typist's finger drilling, as opposed to word recognition) needs single
// characters falling much faster than any whole word reasonably could.
// "Word" keeps the existing category-scoped word banks; "character" drops
// one keyboard key at a time, sourced from the same GLYPH_KEYS list the
// Kruti Dev / English tutors already use (see wordtris-game.tsx), so it's
// real, already-verified keyboard content, not a new hand-typed list.
export type WordtrisMode = "word" | "character";

export type CategoryInfo = { id: WordtrisCategory; hi: string; en: string };

export const CATEGORIES: CategoryInfo[] = [
  { id: "animals", hi: "जानवर", en: "Animals" },
  { id: "cars", hi: "वाहन", en: "Vehicles" },
  { id: "common", hi: "सामान्य शब्द", en: "Common" },
  { id: "countries", hi: "देश", en: "Countries" },
  { id: "easy_words", hi: "आसान शब्द", en: "Easy Words" },
  { id: "names", hi: "नाम", en: "Names" },
  { id: "numbers", hi: "संख्या", en: "Numbers" },
];

// Longer/rarer words are worth more -- a fixed base plus a per-character
// bonus, the same shape as a real WPM-style typing test rewarding longer
// correct words more than short ones.
export function wordtrisPoints(word: string) {
  return 10 + [...word].length * 2;
}

// Real reported request: the previous curve (a fixed base fall time
// shrinking by a constant exponential factor per catch) had no real
// relationship to an actual typing speed, and felt too fast from the very
// first drop. This is an explicit WPM ("words per minute") curve instead --
// every drop's fall time is computed FROM a target WPM (the standard
// formula: one "word" = 5 characters), so "speed" is always describable in
// the same units a student already understands, and the ramp shape is a
// plain, tunable milestone list rather than an opaque exponent. A round
// starts at the first milestone; every WORDTRIS_CATCHES_PER_MILESTONE
// catches in a row advances to the next (bigger jumps early, smaller ones
// as it approaches the cap); a miss instead backs the WPM off by
// WORDTRIS_MISS_WPM_PENALTY and restarts that catch count, so recovering
// back up always retraces the same ladder. Six missed drops (not five)
// end the round.
export const WORDTRIS_WPM_MILESTONES = [15, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30] as const;
// Real reported request: this used to be a fixed constant -- now
// adjustable at setup (like starting speed), 7-10 catches per bump.
export const WORDTRIS_CATCHES_PER_MILESTONE = 7;
export const WORDTRIS_MIN_CATCHES_PER_MILESTONE = 7;
export const WORDTRIS_MAX_CATCHES_PER_MILESTONE = 10;
export const WORDTRIS_MISS_WPM_PENALTY = 3;
export const WORDTRIS_STARTING_LIVES = 6;
export const WORDTRIS_MIN_WPM = 10;
export const WORDTRIS_MAX_WPM = 40;

// Reading/reaction time added on top of the raw keystroke time a drop's own
// text would take at the current WPM -- a real student needs to *see* and
// recognise it before typing, not just physically type it in the bare
// minimum time. Word mode shows a whole word to read; character mode shows
// one already-visible key, so it needs far less of a buffer.
export const WORDTRIS_READING_BUFFER_MS: Record<WordtrisMode, number> = { word: 1200, character: 400 };
export const WORDTRIS_MIN_FALL_MS = 900;

// The standard WPM definition (1 "word" = 5 characters) turned into a fall
// duration for one specific drop's text, at the given WPM.
export function wordtrisFallMs(text: string, wpm: number, mode: WordtrisMode) {
  const chars = [...text].length;
  const typingMs = (chars / 5 / wpm) * 60000;
  return Math.max(WORDTRIS_MIN_FALL_MS, WORDTRIS_READING_BUFFER_MS[mode] + typingMs);
}

// The next rung up the ladder from the current WPM -- used both for the
// normal every-7-catches advance and for climbing back up after a miss
// knocked the WPM down mid-ladder. Caps at the top milestone.
export function wordtrisNextMilestone(currentWpm: number): number {
  const next = WORDTRIS_WPM_MILESTONES.find((m) => m > currentWpm);
  return next ?? WORDTRIS_WPM_MILESTONES[WORDTRIS_WPM_MILESTONES.length - 1];
}

export const BUNDLED_WORDS: Record<WordtrisLanguage, Record<WordtrisCategory, string[]>> = {
  english: {
    animals: ["cat", "dog", "lion", "tiger", "horse", "sheep", "goat", "rabbit", "monkey", "elephant", "giraffe", "zebra", "panda", "wolf", "eagle"],
    cars: ["car", "bus", "train", "truck", "bike", "jeep", "taxi", "scooter", "tractor", "van", "wagon", "sedan", "coupe", "pickup", "trailer"],
    common: ["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out"],
    countries: ["india", "china", "japan", "france", "brazil", "canada", "russia", "germany", "mexico", "egypt", "kenya", "spain", "italy", "nepal", "bhutan"],
    easy_words: ["cat", "dog", "sun", "run", "big", "red", "hat", "box", "cup", "pen", "map", "top", "bed", "fan", "key"],
    names: ["john", "mary", "peter", "priya", "ravi", "sunil", "anita", "rahul", "sonia", "aman", "neha", "vikas", "pooja", "arjun", "meera"],
    numbers: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "twenty", "thirty", "hundred"],
  },
  hindi: {
    animals: ["बिल्ली", "कुत्ता", "शेर", "बाघ", "घोड़ा", "भेड़", "बकरी", "खरगोश", "बंदर", "हाथी", "जिराफ़", "ज़ेबरा", "भालू", "भेड़िया", "चील"],
    cars: ["कार", "बस", "ट्रेन", "ट्रक", "बाइक", "जीप", "टैक्सी", "स्कूटर", "ट्रैक्टर", "वैन", "ठेला", "साइकिल", "रिक्शा", "वैगन", "ट्रॉली"],
    common: ["और", "के", "का", "है", "में", "को", "से", "यह", "वह", "हैं", "पर", "कि", "ने", "तो", "भी"],
    countries: ["भारत", "चीन", "जापान", "फ्रांस", "ब्राज़ील", "कनाडा", "रूस", "जर्मनी", "मेक्सिको", "मिस्र", "केन्या", "स्पेन", "इटली", "नेपाल", "भूटान"],
    easy_words: ["घर", "कल", "अब", "यह", "वह", "कर", "जल", "फल", "नल", "कम", "दम", "रख", "चल", "बस", "गम"],
    names: ["राम", "श्याम", "गीता", "सीता", "राहुल", "प्रिया", "सुनील", "अनीता", "विकास", "पूजा", "अर्जुन", "मीरा", "अमन", "नेहा", "सोनिया"],
    numbers: ["एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ", "दस", "ग्यारह", "बारह", "बीस", "तीस", "सौ"],
  },
};

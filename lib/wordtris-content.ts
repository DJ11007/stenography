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

// Real reported request: an explicit, continuous ADAPTIVE speed curve --
// one clearly defined speed state (WPM, "words per minute", the same unit
// the HUD already shows and wordtrisFallMs already converts to a fall
// duration), nudged by a small PERCENTAGE on every single catch or miss,
// rather than the milestone ladder this replaced (flat until the 7th
// catch in a row, then a jump). A percentage keeps the ramp gradual and
// self-relative: the same 3% speed-up is a small nudge early on and a
// slightly bigger one once the student is already fast, and the 12%
// slow-down on a miss eases them back toward a speed they can actually
// recover from instead of a flat penalty that would hit hardest exactly
// when they're already struggling near the floor. These five constants
// are the ENTIRE curve -- min/start/max bound it, the two factors shape
// it -- change any of them to retune difficulty without touching game
// logic (see wordtrisSpeedUpOnCatch / wordtrisSlowDownOnMiss below, and
// their call sites in wordtris-game.tsx's onCatch/onMiss).
export const WORDTRIS_START_WPM = 15;
export const WORDTRIS_MIN_WPM = 10;
export const WORDTRIS_MAX_WPM = 30;
export const WORDTRIS_CATCH_SPEEDUP_FACTOR = 1.03; // +3% per successful catch
export const WORDTRIS_MISS_SLOWDOWN_FACTOR = 0.88; // -12% per miss
// Six missed drops (not five) end the round -- see WORDTRIS_STARTING_LIVES
// below, which doubles as both "lives left" and "misses stacked in the
// bucket" (they move in lockstep: every miss consumes exactly one life
// and adds exactly one block, see onMiss).
export const WORDTRIS_STARTING_LIVES = 6;

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

// Called once per successful catch (never mid-fall -- the caller only
// ever reads/writes this between drops, see spawnDrop's spawn-time-only
// read of the current speed in wordtris-game.tsx). A plain multiply, so
// repeated catches compound smoothly instead of adding a flat amount
// each time; clamped so a long streak can't overshoot the configured
// ceiling.
export function wordtrisSpeedUpOnCatch(currentWpm: number): number {
  return Math.min(WORDTRIS_MAX_WPM, currentWpm * WORDTRIS_CATCH_SPEEDUP_FACTOR);
}

// Called once per miss. A percentage of the CURRENT speed (not a flat
// subtraction) -- an already-slow round eases back by a proportionally
// smaller amount than a fast one, so one more miss near the floor can't
// overshoot past it the way a flat penalty could; clamped to the
// configured floor regardless.
export function wordtrisSlowDownOnMiss(currentWpm: number): number {
  return Math.max(WORDTRIS_MIN_WPM, currentWpm * WORDTRIS_MISS_SLOWDOWN_FACTOR);
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
    // Replaced 2026-09-22 with the admin's own 28-word vehicle/equipment
    // list -- see lib/kruti-dev-word-bank.ts for each word's verified
    // Kruti Dev 010 keystroke sequence (this array only holds the
    // display text; that file is the source of truth for what a
    // student must actually type).
    common: ["सीमेंट", "मिक्सर", "इलेक्ट्रिक", "नौका", "गर्म हवा का गुब्बारा", "गाड़ी", "ट्रक", "ई-रिक्शा", "रिक्शा", "स्कूटर", "कार", "फेरी", "ट्रॉली", "ग्लाइडर", "पनडुब्बी", "टैक्सी", "स्कूल बस", "एम्बुलेंस", "पुलिस जीप", "बैलगाड़ी", "क्रेन", "रोड रोलर", "मालगाड़ी", "पानी का टैंकर", "हवाई जहाज", "ऑटो", "नाव", "बुलडोजर"],
    countries: ["भारत", "चीन", "जापान", "फ्रांस", "ब्राज़ील", "कनाडा", "रूस", "जर्मनी", "मेक्सिको", "मिस्र", "केन्या", "स्पेन", "इटली", "नेपाल", "भूटान"],
    easy_words: ["घर", "कल", "अब", "यह", "वह", "कर", "जल", "फल", "नल", "कम", "दम", "रख", "चल", "बस", "गम"],
    names: ["राम", "श्याम", "गीता", "सीता", "राहुल", "प्रिया", "सुनील", "अनीता", "विकास", "पूजा", "अर्जुन", "मीरा", "अमन", "नेहा", "सोनिया"],
    numbers: ["एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ", "दस", "ग्यारह", "बारह", "बीस", "तीस", "सौ"],
  },
};

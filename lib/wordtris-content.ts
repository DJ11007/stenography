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
  { id: "cars", hi: "वाहन", en: "Cars" },
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

// Real reported request: rain of a single item at a time, however fast,
// never felt like "multiple drops" -- now up to MAX_CONCURRENT_DROPS fall
// at once (see wordtris-game.tsx), spawned on their own schedule
// (baseSpawnMs -> minSpawnMs) independent of how many are already on
// screen. Both spawn interval and each drop's own fall duration are driven
// by the same "speedLevel" (up one per catch, back down two per miss, the
// same forgiving "ease off after a miss, ramp up on catches" the admin
// originally asked for) so the round starts slow with drops arriving one
// at a time, then gradually thickens into genuine rain as the streak
// builds -- floored so it never becomes unfair. Six missed drops (not
// five) end the round.
export const WORDTRIS_DIFFICULTY = {
  startingLives: 6,
  baseFallMs: 7000,
  minFallMs: 2200,
  baseSpawnMs: 2600,
  minSpawnMs: 900,
  speedFactor: 0.93,
} as const;

// Character mode drills one keystroke at a time, not a whole word -- a
// single key needs a fraction of a word's reading-plus-typing time, so
// this curve starts and floors much faster than WORDTRIS_DIFFICULTY. Same
// shape, just rescaled.
export const WORDTRIS_CHARACTER_DIFFICULTY = {
  startingLives: 6,
  baseFallMs: 3200,
  minFallMs: 900,
  baseSpawnMs: 1400,
  minSpawnMs: 450,
  speedFactor: 0.9,
} as const;

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

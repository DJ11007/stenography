// WordTris: an original falling-word typing game (/typing/games/wordtris),
// content and difficulty-curve constants shared by the game client and the
// admin word-bank editor. Word banks are admin-editable (see
// app/admin/wordtris-words); the lists below are the bundled fallback used
// until the 202609171700 migration has published rows for a given
// language + category, mirroring lib/krutidev-tutor-content.ts's fallback
// role for the Kruti Dev tutor.

export type WordtrisLanguage = "hindi" | "english";
export type WordtrisCategory = "animals" | "cars" | "common" | "countries" | "easy_words" | "names" | "numbers";

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

// Difficulty curve (the admin's explicit request): fall duration shortens
// gradually on a catch streak, is floored so it never becomes unfair, and
// lengthens briefly right after a miss (a breather) before resuming the
// gradual speed-up from there.
export const WORDTRIS_DIFFICULTY = {
  startingLives: 5,
  baseFallMs: 6000,
  minFallMs: 1800,
  speedUpEveryStreak: 3,
  speedUpFactor: 0.92,
  missBreatherFactor: 1.2,
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

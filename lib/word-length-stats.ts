// "Word Length" the way government-exam typing software (e.g. Speedo) reports it for a passage: the average
// number of characters per word, including the space that follows each word -- the same convention this project
// already uses for passage_characters/passage_words (see validateMatterText in typing-matters.ts, characterCount:
// [...finalText].length, the whole text including spaces). Typing exams score speed with a fixed "5 characters =
// 1 word" rule precisely because real passages vary (English prose averages roughly 4.7 characters per word, or
// about 5.7 with the trailing space) -- this average tells whoever is setting up a passage how close it sits to
// that 5-character assumption, so different shifts/papers stay comparable. The shortest/longest word (in
// characters) is a second, simpler size check requested alongside it.
export type WordLengthStats = { avg: number; min?: number; max?: number };

/** Full stats computed directly from the passage/paragraph text (average + shortest/longest word). */
export function wordLengthStatsFromText(text: string): WordLengthStats | null {
  const words = text.trim() ? text.trim().split(/\s+/u) : [];
  if (!words.length) return null;
  const lengths = words.map((word) => [...word].length);
  const characters = [...text].length;
  return { avg: Math.round((characters / words.length) * 100) / 100, min: Math.min(...lengths), max: Math.max(...lengths) };
}

/** Cheaper variant for a dense list/card that only has the precomputed passage_characters/passage_words columns
 * (never loads the full passage text) -- same average, no min/max. */
export function wordLengthStatsFromCounts(characters: number | null | undefined, words: number | null | undefined): WordLengthStats | null {
  if (!characters || !words) return null;
  return { avg: Math.round((characters / words) * 100) / 100 };
}

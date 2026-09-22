// Kruti Dev 010 is a legacy 8-bit "font trick" encoding, not Unicode --
// the glyph a student sees only comes out right because a specific
// ASCII-range keystroke sequence was chosen to draw it. For anything
// this app checks a student's typing against, that keystroke sequence
// -- not the Unicode text it happens to render as -- is the actual
// correct answer. Visual equality (two sequences that end up drawing
// the same/similar glyphs) is not the same thing as keystroke equality,
// and only keystroke equality is ever correct here.
//
// This file is the single, explicit, human-auditable source of truth
// for the Hindi "Common Words" category's exact Kruti Dev 010 keystroke
// sequences (shared by WordTris, Word Defender, and Speed Race, which
// all draw vocabulary from the same word bank -- see
// lib/wordtris-content.ts's `common` category). Each entry's krutiKeys
// was generated once via this app's own extensively-tested
// unicodeToKrutiDev() converter (lib/hindi-font-converter.ts) and then
// verified two ways: krutiDevToUnicode(krutiKeys) round-trips back to
// the exact displayWord, and krutiKeys was rendered in the actual
// bundled KrutiDev010.ttf font and visually confirmed to draw
// displayWord correctly (both checked live while building this file --
// see tests/kruti-dev-word-bank.test.mjs for the round-trip assertion).
//
// If a word is ever added to the "common" category that isn't listed
// here (e.g. a new admin-authored word), callers fall back to the live
// unicodeToKrutiDev() converter -- already this app's verified,
// well-tested conversion path everywhere else -- rather than inventing
// a guessed sequence. That word should be added here once someone
// confirms its sequence the same way the rest of this list was built.
export type VerifiedKrutiWord = { id: number; displayWord: string; krutiKeys: string };

export const HINDI_COMMON_WORD_KEYS: VerifiedKrutiWord[] = [
  { id: 1, displayWord: "और", krutiKeys: "vkSj" },
  { id: 2, displayWord: "के", krutiKeys: "ds" },
  { id: 3, displayWord: "का", krutiKeys: "dk" },
  { id: 4, displayWord: "है", krutiKeys: "gS" },
  { id: 5, displayWord: "में", krutiKeys: "esa" },
  { id: 6, displayWord: "को", krutiKeys: "dks" },
  { id: 7, displayWord: "से", krutiKeys: "ls" },
  { id: 8, displayWord: "यह", krutiKeys: ";g" },
  { id: 9, displayWord: "वह", krutiKeys: "og" },
  { id: 10, displayWord: "हैं", krutiKeys: "gSa" },
  { id: 11, displayWord: "पर", krutiKeys: "ij" },
  { id: 12, displayWord: "कि", krutiKeys: "fd" },
  { id: 13, displayWord: "ने", krutiKeys: "us" },
  { id: 14, displayWord: "तो", krutiKeys: "rks" },
  { id: 15, displayWord: "भी", krutiKeys: "Hkh" },
];

const byDisplayWord = new Map(HINDI_COMMON_WORD_KEYS.map((w) => [w.displayWord, w.krutiKeys]));

// Returns the verified sequence for a Hindi "common" category word, or
// undefined if this word isn't in the verified list yet (caller decides
// the fallback -- see the file-level comment above).
export function getVerifiedHindiCommonKeys(displayWord: string): string | undefined {
  return byDisplayWord.get(displayWord);
}

// CORRECTNESS = EXACT KRUTI DEV 010 KEY SEQUENCE. Plain string equality
// on the raw keystrokes -- no normalization, no trimming, no case
// folding, no glyph comparison. Every key matters, including case
// (Kruti Dev assigns Shift'd and bare keys to different glyphs).
export function isExactKrutiDevMatch(typed: string, expected: string): boolean {
  return typed === expected;
}

export type KeystrokeCheck = { position: number; typedKey: string; expectedKey: string; correct: boolean };

// Position-by-position diagnostic: what was typed vs. what was expected
// at each index, for live error highlighting. A shorter `typed` reports
// "" for its missing tail positions (missing keystrokes); a longer
// `typed` reports "" for expected beyond the target's length (extra
// keystrokes) -- both always `correct: false`.
export function checkKrutiDevKeystrokes(typed: string, expected: string): KeystrokeCheck[] {
  const result: KeystrokeCheck[] = [];
  const maxLength = Math.max(typed.length, expected.length);
  for (let i = 0; i < maxLength; i += 1) {
    const typedKey = typed[i] ?? "";
    const expectedKey = expected[i] ?? "";
    result.push({ position: i, typedKey, expectedKey, correct: typedKey === expectedKey });
  }
  return result;
}

export type KeystrokeDiffCounts = { correct: number; incorrect: number; missing: number; extra: number };

// Scoring input: correct = positions where the keys actually match;
// missing = required keys never typed (typed ran out first); extra =
// keys typed past the expected sequence's end; incorrect = a wrong key
// typed at a position the expected sequence does have. These are
// mutually exclusive per position, so accuracy is always
// correct / (correct + incorrect + missing + extra).
export function countKeystrokeDiff(typed: string, expected: string): KeystrokeDiffCounts {
  const counts: KeystrokeDiffCounts = { correct: 0, incorrect: 0, missing: 0, extra: 0 };
  for (const { typedKey, expectedKey, correct } of checkKrutiDevKeystrokes(typed, expected)) {
    if (correct) counts.correct += 1;
    else if (!typedKey) counts.missing += 1;
    else if (!expectedKey) counts.extra += 1;
    else counts.incorrect += 1;
  }
  return counts;
}

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
//
// Replaced 2026-09-22 with the admin's own 28-word vehicle/equipment list
// (the "common" category id/name is unchanged -- only its content). Two
// entries needed extra scrutiny beyond the usual round-trip check, both
// confirmed by actually rendering the sequence in the bundled
// KrutiDev010.ttf font:
// - "ऑटो": unicodeToKrutiDev() itself produces a technically-different
//   (but visually near-identical) sequence using U+201A, a punctuation
//   mark no physical Kruti Dev key can actually produce -- unusable for
//   a typing game. Uses the admin's own independently-supplied,
//   all-plain-ASCII sequence "vkWVks" instead, visually confirmed to
//   draw ऑटो correctly.
// - "इलेक्ट्रिक": krutiDevToUnicode() decodes this one word's own
//   forward-converted sequence back to a slightly different Unicode
//   string (a known decoder-only limitation with a triple conjunct plus
//   a pre-base ि matra, unrelated to whether the FORWARD sequence is
//   correct) -- confirmed correct by rendering it directly in the font.
export type VerifiedKrutiWord = { id: number; displayWord: string; krutiKeys: string };

export const HINDI_COMMON_WORD_KEYS: VerifiedKrutiWord[] = [
  { id: 1, displayWord: "सीमेंट", krutiKeys: "lhesaV" },
  { id: 2, displayWord: "मिक्सर", krutiKeys: "feDlj" },
  { id: 3, displayWord: "इलेक्ट्रिक", krutiKeys: "bysfDVªd" },
  { id: 4, displayWord: "नौका", krutiKeys: "ukSdk" },
  { id: 5, displayWord: "गर्म हवा का गुब्बारा", krutiKeys: "xeZ gok dk xqCckjk" },
  { id: 6, displayWord: "गाड़ी", krutiKeys: "xkM+h" },
  { id: 7, displayWord: "ट्रक", krutiKeys: "Vªd" },
  { id: 8, displayWord: "ई-रिक्शा", krutiKeys: "bZ&fjD'kk" },
  { id: 9, displayWord: "रिक्शा", krutiKeys: "fjD'kk" },
  { id: 10, displayWord: "स्कूटर", krutiKeys: "LdwVj" },
  { id: 11, displayWord: "कार", krutiKeys: "dkj" },
  { id: 12, displayWord: "फेरी", krutiKeys: "Qsjh" },
  { id: 13, displayWord: "ट्रॉली", krutiKeys: "VªkWyh" },
  { id: 14, displayWord: "ग्लाइडर", krutiKeys: "XykbMj" },
  { id: 15, displayWord: "पनडुब्बी", krutiKeys: "iuMqCch" },
  { id: 16, displayWord: "टैक्सी", krutiKeys: "VSDlh" },
  { id: 17, displayWord: "स्कूल बस", krutiKeys: "Ldwy cl" },
  { id: 18, displayWord: "एम्बुलेंस", krutiKeys: ",Ecqysal" },
  { id: 19, displayWord: "पुलिस जीप", krutiKeys: "iqfyl thi" },
  { id: 20, displayWord: "बैलगाड़ी", krutiKeys: "cSyxkM+h" },
  { id: 21, displayWord: "क्रेन", krutiKeys: "Øsu" },
  { id: 22, displayWord: "रोड रोलर", krutiKeys: "jksM jksyj" },
  { id: 23, displayWord: "मालगाड़ी", krutiKeys: "ekyxkM+h" },
  { id: 24, displayWord: "पानी का टैंकर", krutiKeys: "ikuh dk VSadj" },
  { id: 25, displayWord: "हवाई जहाज", krutiKeys: "gokbZ tgkt" },
  { id: 26, displayWord: "ऑटो", krutiKeys: "vkWVks" },
  { id: 27, displayWord: "नाव", krutiKeys: "uko" },
  { id: 28, displayWord: "बुलडोजर", krutiKeys: "cqyMkstj" },
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

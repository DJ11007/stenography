import convertLegacy from "@anthro-ai/krutidev-unicode";
import legacyMapping from "@anthro-ai/krutidev-unicode/dictionary/main.js";

export type HindiTextFormat = "unicode" | "krutidev";
export type ConvertedHindiText = Readonly<{ text: string; encoding: HindiTextFormat }>;

const DEVANAGARI = /[\u0900-\u097f]/u;
const DEVANAGARI_GLOBAL = /[\u0900-\u097f]/gu;
// The trailing `?` on [dD][kZ]? was a bug: it made the second character
// optional, so this matched on a bare "d"/"D" alone -- degenerately common
// in ordinary English/transliterated text (e.g. any title containing the
// word "Hindi" itself), unlike every other alternative here, which all
// require a specific multi-character Kruti Dev garbage sequence. Real
// legacy-encoded text pairs "d"/"D" with "k" or "Z" (Devanagari half-forms
// rendered from those byte combinations); a lone "d" proves nothing.
export const LEGACY_SIGNAL = /(?:f['{kTtM<;]|O;fDr|vkSj|gS|\{kk|\.[k]|[dD][kZ])/;

const preferredLegacy = new Map<string, string>();
for (const [legacy, unicode] of legacyMapping) {
  if (!DEVANAGARI.test(unicode) || !legacy || unicode.includes("f")) continue;
  const current = preferredLegacy.get(unicode);
  if (!current || legacy.length < current.length) preferredLegacy.set(unicode, legacy);
}
preferredLegacy.set("ः", "%");
preferredLegacy.set(",", "]");
preferredLegacy.set("?", "\\");
preferredLegacy.set("-", "&");
// Real reported bug: an admin's word-set drill wrapped every word in
// typographic quotes ('कमल' 'कलम' ...), and the Kruti Dev preview showed
// garbage glyphs around each word instead of quote marks. These curly
// quotes aren't Devanagari, so the general loop above (which only keeps
// entries whose *decoded* side contains a Devanagari character) never
// mapped them, and unicodeToKrutiDev passed the raw ' '/' ' Unicode code
// points straight through -- codepoints the bundled Kruti Dev 010 font has
// no sensible glyph for. The @anthro-ai dictionary confirms the correct
// legacy bytes: krutiDevToUnicode("^") decodes to '‘' and
// krutiDevToUnicode("*") decodes to '’', and both are already
// ordinary keyboard keys, needing no further Alt-code folding.
preferredLegacy.set("‘", "^");
preferredLegacy.set("’", "*");
const unicodeTokens = [...preferredLegacy].sort(([a], [b]) => b.length - a.length);

// The @anthro-ai dictionary optimises for the shortest byte sequence,
// which for a number of consonants and clusters is a single Latin-1
// "ligature" byte: Ò for भ, è for ध, ç for प्र, Ä for घ, Ã for ई, ª for
// the ट-cluster rakar, ® for ैं ... A student types Hindi on the Kruti
// Dev / Remington keyboard, where those forms are ordinary key sequences
// (Hk, /k, iz, ?k, bZ, z, Sa ...) -- the ligature bytes need Alt codes,
// and some (®) do not even have a glyph in the bundled KrutiDev010 font,
// so a passage stored with them both mis-renders and can never be matched
// by a correctly-typed answer. unicodeToKrutiDev folds every ligature to
// its keyboard sequence as its last step; each pair is verified to decode
// back to the same Unicode through krutiDevToUnicode.
// Real reported bug, confirmed by rendering every candidate byte order
// directly through the bundled Kruti Dev 010 webfont: क्र (Ø) is the one
// ligature in this table whose keyboard-typeable fold ("dz") the font
// mis-renders when the pre-base ि marker ("f") immediately precedes it --
// "प्रक्रिया" (izfØ;k, correct) folds to "izfdz;k" and renders as "प्रकिया"
// (the ्र is dropped visually), and "क्रिकेट" the same way renders
// "किकेट". Every OTHER ligature in this table -- प्र/ग्र/त्र/श्र (iz/xz/=/J),
// tested the same way -- renders correctly after "f" (e.g. "प्रिय",
// "ग्रिड", "त्रिवेणी", "श्रिया" all display correctly), so this is a
// narrow, font-specific limitation of "dz" specifically, not a general
// "any ligature after f" problem. Scoring is unaffected either way --
// krutiDevToUnicode("izfØ;k") and krutiDevToUnicode("izfdz;k") both decode
// to the identical "प्रक्रिया", and a student can only ever type the
// keyboard-typeable "dz" form anyway -- so keeping Ø unfolded here only
// changes how the REFERENCE PASSAGE renders, fixing the visual corruption
// with zero effect on typing/scoring compatibility.
const KEYBOARD_KEY_SEQUENCES: Array<[RegExp, string]> = [
  [/Ùk/g, "Rr"], [/Ò/g, "Hk"], [/è/g, "/k"], [/Ä/g, "?k"], [/Ã/g, "bZ"],
  [/ç/g, "iz"], [/æ/g, "nz"], [/(?<!f)Ø/g, "dz"], [/—/g, "d`"],
  [/ä/g, "Dr"], [/®/g, "Sa"], [/È/g, "ha"], [/ª/g, "z"],
  [/ê/g, "V~V"], [/î/g, "~;"],
];

// Retained name -- unicodeToKrutiDev now always produces keyboard-typeable
// output, so this is a straight alias for callers that asked for it by
// intent (the Kruti Dev learn simulator).
export function toTypeableKrutiDev(unicode: string) {
  return unicodeToKrutiDev(unicode);
}

// The dependency searches globally and then replaces the first matching text,
// so one word can accidentally mutate a later word in a long passage. Decode
// lexical tokens independently. Keep verified non-injective spellings explicit:
// round-tripping alone cannot distinguish their correct Unicode ordering.
const legacyDecodeOverrides = new Map<string, string>([
  ["f[kykM+f;kas", "खिलाड़ियों"],
]);
const legacyOverrideTokens = [...legacyDecodeOverrides].sort(([a], [b]) => b.length - a.length);

function decodeLegacyWord(rawWord: string) {
  let output = "";
  for (let index = 0; index < rawWord.length;) {
    const override = legacyOverrideTokens.find(([legacy]) => rawWord.startsWith(legacy, index));
    if (override) {
      output += override[1];
      index += override[0].length;
      continue;
    }
    let nextOverride = rawWord.length;
    for (const [legacy] of legacyOverrideTokens) {
      const candidate = rawWord.indexOf(legacy, index + 1);
      if (candidate >= 0 && candidate < nextOverride) nextOverride = candidate;
    }
    output += convertLegacy(rawWord.slice(index, nextOverride).replaceAll("%", "\uE000")).replaceAll("\uE000", "ः");
    index = nextOverride;
  }
  return repairDecodedWord(output);
}

// Repairs applied to each decoded token. Every rule below only rewrites a
// token that is ALREADY impossible in Devanagari -- two stacked vowel
// signs, a word that opens with a मात्रा, an independent vowel carrying a
// मात्रा -- so it can never disturb a well-formed word; it only mends, or
// at worst re-mangles, a token that came in broken. The patterns are from
// auditing the Rajasthan LDC Hindi chapters, hand-typed in Kruti Dev with
// a recurring set of slips: a stray "aa" keystroke stacking two signs
// ("धीरे" -> धाीरे, "अधिकार" -> अधिाकार), the k key one keystroke early
// ("कार्य" -> ाकर्य), the s/l mirror-swap at a word start ("समाज" -> ेमाज),
// and f + m for f + e ("मिल" -> the impossible उि).
function repairDecodedWord(word: string) {
  return word
    // "ा" wedged before another vowel sign (è+k+h -> धाी).
    .replace(/ा(?=[ि-ौ])/gu, "")
    // doubled "ा" (/k + extra k -> धाा).
    .replace(/ा{2,}/gu, "ा")
    // A word cannot begin with a मात्रा. The Kruti Dev "ा" key (k) pressed
    // one keystroke early lands before its consonant -- "कार्य" stored as
    // k + d + ... decodes with a leading ा; move it after the consonant.
    .replace(/^ा([क-हक़-य़])/u, "$1ा")
    // Nor with "े". Kruti Dev स is the l key and े the mirror-image s key;
    // typing s for l at a word start is the most common slip in these
    // chapters ("सभी" -> ेभी, "समाज" -> ेमाज, "सुरक्षा" -> ेुरक्षा). Restore स.
    .replace(/^े/u, "स")
    // The pre-base ि marker (the f key) then उ (m) instead of म (e): ि
    // cannot ride an independent vowel, so it renders as the impossible
    // उ + ि -- every observed case is मिलना / मिलकर / मिला.
    .replace(/उि/gu, "मि")
    // A nukta letter directly followed by "यि" -- the @anthro-ai decoder
    // misplaces the pre-base ि onto य for ड़ि / ढ़ि / क़ि clusters, so
    // "सीढ़ियों" comes back as सीढ़यिों and "पीढ़ियों" as पीढ़यिों. The ि
    // belongs on the nukta letter; put it there. (matches ़ decomposed or
    // a pre-composed क़-य़.)
    .replace(/([़क़-य़])यि/gu, "$1िय")
    // "ा" trailing another vowel sign, before a consonant (अधिाकार) or at a
    // word / clause boundary (अवधिा), optionally with anusvara/visarga on
    // it. Chandrabindu (ँ) is deliberately NOT a boundary here: it keeps a
    // real "...ि" + "याँ" (already mis-joined upstream for nukta letters)
    // from losing its "ाँ".
    .replace(/(?<=[ि-ौ])ा(?=[ंः]?(?:[क-हक़-य़\s।,;:!?)"'-]|$))/gu, "");
}

export function detectHindiTextFormat(text: string): HindiTextFormat | "empty" | "mixed" | "unknown" {
  if (!text.trim()) return "empty";
  const unicode = DEVANAGARI.test(text);
  const legacy = LEGACY_SIGNAL.test(text);
  if (unicode && legacy) return "mixed";
  if (unicode) return "unicode";
  if (legacy) return "krutidev";
  return "unknown";
}

export function normalizeUnicodeHindi(text: string) {
  return text.replace(/\r\n?/g, "\n").normalize("NFC");
}

export function krutiDevToUnicode(text: string) {
  if (!text) return "";
  return text
    .replace(/\r\n?/g, "\n")
    .split(/(\s+)/u)
    .map((token) => (/^\s+$/u.test(token) ? token : decodeLegacyWord(token)))
    .join("")
    .normalize("NFC");
}

export function unicodeToKrutiDev(text: string) {
  let working = normalizeUnicodeHindi(text);
  // Kruti Dev stores reph after the complete orthographic syllable.
  working = working.replace(/र्([क-हक़-य़](?:्[क-हक़-य़])*(?:[ािीुूृॄेैोौॅॉंःँ]*)?)/gu, "$1Z");
  // Its pre-base i-matra marker is stored before the consonant cluster.
  working = working.replace(/([क-हक़-य़](?:्[क-हक़-य़])*)ि/gu, "ि$1");
  let output = "";
  for (let index = 0; index < working.length;) {
    if (working[index] === "ि") { output += "f"; index += 1; continue; }
    let matched = false;
    for (const [unicode, legacy] of unicodeTokens) {
      if (working.startsWith(unicode, index)) { output += legacy; index += unicode.length; matched = true; break; }
    }
    if (!matched) {
      const char = working[index];
      if (DEVANAGARI.test(char)) throw new Error(`This Devanagari sign is not supported by Kruti Dev 010: ${char}`);
      output += char; index += 1;
    }
  }
  for (const [ligature, keys] of KEYBOARD_KEY_SEQUENCES) output = output.replace(ligature, keys);
  return output;
}

export function convertHindiText(text: string, source: HindiTextFormat, output: HindiTextFormat) {
  if (source === output) return source === "unicode" ? normalizeUnicodeHindi(text) : text.replace(/\r\n?/g, "\n");
  return source === "unicode" ? unicodeToKrutiDev(text) : krutiDevToUnicode(text);
}

export function convertHindiTextWithMarker(text: string, source: HindiTextFormat, output: HindiTextFormat): ConvertedHindiText {
  return Object.freeze({ text: convertHindiText(text,source,output), encoding: output });
}

export function encodingValidationMessage(text: string, expected: HindiTextFormat) {
  const detected = detectHindiTextFormat(text);
  if (detected === "empty" || detected === "unknown") return null;
  if (expected === "krutidev" && (detected === "unicode" || detected === "mixed")) return "Convert to Kruti Dev before saving.";
  if (expected === "unicode" && (detected === "krutidev" || detected === "mixed")) return "Convert to Unicode before saving.";
  return null;
}

export function countHindiText(text: string) {
  return { characters: [...text].length, words: text.trim() ? text.trim().split(/\s+/u).length : 0, devanagariCharacters: text.match(DEVANAGARI_GLOBAL)?.length ?? 0 };
}
